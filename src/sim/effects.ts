/**
 * Item effects at runtime: explosions, status damage, shock arcs, knockback, healing, and the
 * signature powers (orbiting blades, vortex, aura, ...).
 *
 * Chains are capped (see the MAX_ constants) so a lucky explosive build can't loop forever or
 * melt the browser. Everything here is deterministic: no Math.random and no trigonometry.
 */
import { ARENA_HEIGHT, ARENA_WIDTH, DT } from './config.ts';
import { damageEnemy } from './combat.ts';
import { MAX_ENEMY_RADIUS } from './enemies.ts';
import type { SimState } from './state.ts';

/** How many explosions may chain from one another. */
export const MAX_EFFECT_DEPTH = 3;
/** Hard cap on explosions per tick, however they were triggered. */
export const MAX_EXPLOSIONS_PER_TICK = 24;
/** Hard cap on shock arcs per tick. */
export const MAX_ZAPS_PER_TICK = 40;
/** Anything bigger than this is a boss and shrugs off most displacement. */
const BOSS_RADIUS = 30;

/** Explosion flags: what extra things an explosion does to the enemies it hits. */
const FLAG_POISON = 1;
const FLAG_BURN = 2;
const FLAG_HEAL = 4;

/** Damage source ids, used by the renderer to color floating numbers. */
export const SRC_WEAPON = 0;
export const SRC_EXPLOSION = 1;
export const SRC_ZAP = 2;
export const SRC_EXECUTE = 3;

const STORM_WARD_DAMAGE = 45;
const STORM_WARD_TARGETS = 5;
const STORM_WARD_RANGE = 280;
const BLADE_RADIUS = 16;
/** Orbit speed: 3.2 rad/s, as exact per-tick rotation constants (no trig at runtime). */
const ORBIT_COS = 0.998578114865157;
const ORBIT_SIN = 0.05330805297841217;
/** Rotation of one blade slot relative to the previous one, for 3, 4 and 5 blades. */
const SLOT_ROT: Record<number, readonly [number, number]> = {
  3: [-0.5, 0.8660254037844386],
  4: [0, 1],
  5: [0.30901699437494745, 0.9510565162951535],
};

const fanTargets = new Int32Array(8);
const visited = new Int32Array(64);

export function explode(
  state: SimState,
  x: number,
  y: number,
  radius: number,
  damage: number,
  push = 0,
  flags = 0,
): void {
  if (state.effectDepth >= MAX_EFFECT_DEPTH || state.explosionsThisTick >= MAX_EXPLOSIONS_PER_TICK) return;
  state.explosionsThisTick++;
  state.events.push({ type: 'explosion', x, y, radius });

  const b = state.build;
  const buf = state.blastBufs[state.effectDepth]!;
  state.effectDepth++;
  const e = state.enemies;
  const n = state.grid.query(x, y, radius + MAX_ENEMY_RADIUS, buf);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const j = buf[k]!;
    if (e.dead[j]) continue;
    const dx = e.x[j]! - x;
    const dy = e.y[j]! - y;
    const reach = radius + e.radius[j]!;
    const distSq = dx * dx + dy * dy;
    if (distSq > reach * reach) continue;
    hits++;
    damageEnemy(state, j, damage, true, SRC_EXPLOSION);
    if (e.dead[j]) continue;
    if (push > 0 && distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const r = e.radius[j]!;
      const amount = r > BOSS_RADIUS ? push * 0.2 : push;
      e.x[j] = clamp(e.x[j]! + (dx / dist) * amount, r, ARENA_WIDTH - r);
      e.y[j] = clamp(e.y[j]! + (dy / dist) * amount, r, ARENA_HEIGHT - r);
    }
    if (flags & FLAG_POISON && b.poisonDps > 0) poison(state, j);
    if (flags & FLAG_BURN && b.burnDps > 0) ignite(state, j);
  }
  state.effectDepth--;

  if (flags & FLAG_HEAL && hits > 0) {
    healPlayer(state, Math.min(hits, 6) * (b.bloodsplosionHeal + (b.bloodNova ? 1 : 0)));
  }
}

function poison(state: SimState, j: number): void {
  const e = state.enemies;
  e.poisonT[j] = state.build.poisonSecs;
  e.poisonDps[j] = state.build.poisonDps;
}

function ignite(state: SimState, j: number): void {
  const e = state.enemies;
  e.burnT[j] = state.build.burnSecs;
  e.burnDps[j] = state.build.burnDps;
}

export function healPlayer(state: SimState, amount: number): void {
  const p = state.player;
  const healed = Math.min(amount, p.maxHp - p.hp);
  if (healed <= 0) return;
  p.hp += healed;
  state.events.push({ type: 'heal', amount: healed });
}

/** Called whenever an enemy dies, wherever the damage came from. */
export function onEnemyKilled(state: SimState, x: number, y: number, poisoned: boolean): void {
  const b = state.build;
  if (b.healKills > 0 && ++state.killsSinceHeal >= b.healKills) {
    state.killsSinceHeal = 0;
    healPlayer(state, b.healAmount);
  }

  // Plague Bearer: poisoned enemies burst when they die.
  if (b.plagueDamage > 0 && poisoned) {
    explode(state, x, y, b.plagueRadius, b.plagueDamage, 0, FLAG_POISON);
  }

  if (b.explodeDamage > 0) {
    let damage = b.explodeDamage;
    let radius = b.explodeRadius;
    let flags = 0;
    if (b.plagueBlast && poisoned) {
      damage *= 1.5;
      radius *= 1.3;
      flags |= FLAG_POISON;
    }
    if (b.napalm) flags |= FLAG_BURN;
    if (b.bloodsplosionHeal > 0 || b.bloodNova) flags |= FLAG_HEAL;
    explode(state, x, y, radius, damage, b.concussive ? 45 : 0, flags);
  }
}

/**
 * Called after a weapon hit lands on enemy `j`. (dirX, dirY) is the unit direction of the hit,
 * `damage` is how much it dealt. Applies execution, knockback, poison, burn and shock arcs.
 */
export function applyHitEffects(state: SimState, j: number, dirX: number, dirY: number, damage: number): void {
  const b = state.build;
  const e = state.enemies;

  // Executioner: finish off weakened enemies (not bosses).
  if (b.execute > 0 && !e.dead[j] && e.radius[j]! <= BOSS_RADIUS && e.hp[j]! < e.maxHp[j]! * b.execute) {
    damageEnemy(state, j, e.hp[j]! + 1, true, SRC_EXECUTE);
  }

  const x = e.x[j]!;
  const y = e.y[j]!;
  if (!e.dead[j]) {
    if (b.knockback > 0) {
      const r = e.radius[j]!;
      const push = r > BOSS_RADIUS ? b.knockback * 0.2 : b.knockback;
      e.x[j] = clamp(x + dirX * push, r, ARENA_WIDTH - r);
      e.y[j] = clamp(y + dirY * push, r, ARENA_HEIGHT - r);
    }
    if (b.poisonDps > 0) poison(state, j);
    if (b.burnDps > 0) ignite(state, j);
  }

  if (b.shockFrac > 0) zap(state, j, x, y, damage * b.shockFrac);
}

/** One lightning arc from (x, y) to enemy `t`. Returns false if the per-tick cap was reached. */
function arc(state: SimState, x: number, y: number, t: number, damage: number): boolean {
  if (state.zapsThisTick >= MAX_ZAPS_PER_TICK) return false;
  state.zapsThisTick++;
  const e = state.enemies;
  state.events.push({ type: 'zap', x, y, toX: e.x[t]!, toY: e.y[t]! });
  damageEnemy(state, t, damage, true, SRC_ZAP);
  if (!e.dead[t]) {
    const b = state.build;
    if (b.toxicStorm && b.poisonDps > 0) poison(state, t);
    if (b.plasma && b.burnDps > 0) ignite(state, t);
  }
  return true;
}

/** Shock: arcs to a few nearby enemies, then (Tesla Storm) keeps jumping from each of them. */
function zap(state: SimState, from: number, x: number, y: number, damage: number): void {
  const b = state.build;
  const e = state.enemies;
  const buf = state.zapBuf;
  const n = state.grid.query(x, y, b.shockRange + MAX_ENEMY_RADIUS, buf);
  const rangeSq = b.shockRange * b.shockRange;
  let fan = 0;
  for (let k = 0; k < n && fan < b.shockTargets && fan < fanTargets.length; k++) {
    const t = buf[k]!;
    if (t === from || e.dead[t]) continue;
    const dx = e.x[t]! - x;
    const dy = e.y[t]! - y;
    if (dx * dx + dy * dy > rangeSq) continue;
    fanTargets[fan++] = t;
  }
  for (let f = 0; f < fan; f++) {
    if (!arc(state, x, y, fanTargets[f]!, damage)) return;
  }
  if (b.teslaJumps > 0) {
    visited[0] = from;
    for (let f = 0; f < fan; f++) visited[1 + f] = fanTargets[f]!;
    const base = 1 + fan;
    for (let f = 0; f < fan; f++) chain(state, fanTargets[f]!, damage, base);
  }
}

/** A single chain of jumps starting at enemy `start`, each hit weaker than the last. */
function chain(state: SimState, start: number, damage: number, visitedBase: number): void {
  const b = state.build;
  const e = state.enemies;
  const buf = state.zapBuf;
  let visitedCount = visitedBase;
  let cur = start;
  let dmg = damage;
  const rangeSq = b.shockRange * b.shockRange;
  for (let jump = 0; jump < b.teslaJumps && visitedCount < visited.length; jump++) {
    dmg *= 0.75;
    const x = e.x[cur]!;
    const y = e.y[cur]!;
    const n = state.grid.query(x, y, b.shockRange + MAX_ENEMY_RADIUS, buf);
    let best = -1;
    let bestD = rangeSq;
    for (let k = 0; k < n; k++) {
      const t = buf[k]!;
      if (e.dead[t] || isVisited(t, visitedCount)) continue;
      const dx = e.x[t]! - x;
      const dy = e.y[t]! - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best < 0) return;
    visited[visitedCount++] = best;
    if (!arc(state, x, y, best, dmg)) return;
    cur = best;
  }
}

function isVisited(t: number, count: number): boolean {
  for (let i = 0; i < count; i++) if (visited[i] === t) return true;
  return false;
}

/** Storm Ward: lightning from the player to nearby enemies. */
export function stormStrike(state: SimState): void {
  const p = state.player;
  const e = state.enemies;
  const buf = state.zapBuf;
  const n = state.grid.query(p.x, p.y, STORM_WARD_RANGE + MAX_ENEMY_RADIUS, buf);
  const rangeSq = STORM_WARD_RANGE * STORM_WARD_RANGE;
  let fan = 0;
  for (let k = 0; k < n && fan < STORM_WARD_TARGETS; k++) {
    const t = buf[k]!;
    if (e.dead[t]) continue;
    const dx = e.x[t]! - p.x;
    const dy = e.y[t]! - p.y;
    if (dx * dx + dy * dy > rangeSq) continue;
    fanTargets[fan++] = t;
  }
  for (let f = 0; f < fan; f++) {
    if (!arc(state, p.x, p.y, fanTargets[f]!, STORM_WARD_DAMAGE)) return;
  }
}

/** Ticks poison and burn on every afflicted enemy. */
export function tickStatuses(state: SimState): void {
  const e = state.enemies;
  for (let i = 0; i < e.count; i++) {
    if (e.dead[i]) continue;
    let dps = 0;
    if (e.poisonT[i]! > 0) {
      e.poisonT[i] = e.poisonT[i]! - DT;
      dps += e.poisonDps[i]!;
    }
    if (e.burnT[i]! > 0) {
      e.burnT[i] = e.burnT[i]! - DT;
      dps += e.burnDps[i]!;
    }
    if (dps > 0) damageEnemy(state, i, dps * DT, false);
  }
}

/** Per-tick player upkeep: regeneration and the barrier cooldown. */
export function tickBuild(state: SimState): void {
  const b = state.build;
  const p = state.player;
  const regen = b.regen + state.upgrades.regen;
  if (regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + regen * DT);
  if (state.barrierTimer > 0) state.barrierTimer = Math.max(0, state.barrierTimer - DT);
}

/** Signature powers that act every tick: orbiting blades, burning aura, black hole. */
export function tickAuras(state: SimState): void {
  const b = state.build;
  const p = state.player;
  const e = state.enemies;

  if (b.orbitBlades > 0) {
    // Spin the blade direction a fixed step and keep it exactly unit length.
    const nx = state.orbitX * ORBIT_COS - state.orbitY * ORBIT_SIN;
    const ny = state.orbitX * ORBIT_SIN + state.orbitY * ORBIT_COS;
    const l = Math.sqrt(nx * nx + ny * ny) || 1;
    state.orbitX = nx / l;
    state.orbitY = ny / l;

    const [rc, rs] = SLOT_ROT[b.orbitBlades] ?? SLOT_ROT[3]!;
    let vx = state.orbitX;
    let vy = state.orbitY;
    const buf = state.nearby;
    for (let k = 0; k < b.orbitBlades; k++) {
      const bx = p.x + vx * b.orbitRadius;
      const by = p.y + vy * b.orbitRadius;
      state.orbitPos[k * 2] = bx;
      state.orbitPos[k * 2 + 1] = by;
      const n = state.grid.query(bx, by, BLADE_RADIUS + MAX_ENEMY_RADIUS, buf);
      for (let q = 0; q < n; q++) {
        const j = buf[q]!;
        if (e.dead[j]) continue;
        const dx = e.x[j]! - bx;
        const dy = e.y[j]! - by;
        const reach = BLADE_RADIUS + e.radius[j]!;
        if (dx * dx + dy * dy <= reach * reach) damageEnemy(state, j, b.orbitDps * DT, false);
      }
      const tx = vx * rc - vy * rs;
      vy = vx * rs + vy * rc;
      vx = tx;
    }
  }

  if (b.scorchDps > 0) {
    const buf = state.nearby;
    const n = state.grid.query(p.x, p.y, b.scorchRadius + MAX_ENEMY_RADIUS, buf);
    for (let q = 0; q < n; q++) {
      const j = buf[q]!;
      if (e.dead[j]) continue;
      const dx = e.x[j]! - p.x;
      const dy = e.y[j]! - p.y;
      const reach = b.scorchRadius + e.radius[j]!;
      if (dx * dx + dy * dy > reach * reach) continue;
      if (e.burnT[j]! < 0.3) e.burnT[j] = 0.3;
      if (e.burnDps[j]! < b.scorchDps) e.burnDps[j] = b.scorchDps;
    }
  }

  if (b.vortexEvery > 0) {
    state.vortexTimer -= DT;
    if (state.vortexTimer <= 0) {
      state.vortexTimer += b.vortexEvery;
      vortex(state);
    }
  }
}

/** Black Hole: drags every nearby enemy to the player and blasts them. Bosses resist. */
function vortex(state: SimState): void {
  const b = state.build;
  const p = state.player;
  const e = state.enemies;
  const buf = state.nearby;
  const n = state.grid.query(p.x, p.y, b.vortexPull + MAX_ENEMY_RADIUS, buf);
  const pullSq = b.vortexPull * b.vortexPull;
  state.events.push({ type: 'vortex', x: p.x, y: p.y, radius: b.vortexPull });
  for (let q = 0; q < n; q++) {
    const j = buf[q]!;
    if (e.dead[j] || e.radius[j]! > BOSS_RADIUS) continue;
    const dx = e.x[j]! - p.x;
    const dy = e.y[j]! - p.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > pullSq || distSq < 1e-6) continue;
    const dist = Math.sqrt(distSq);
    const target = Math.max(50, dist * 0.25);
    e.x[j] = clamp(p.x + (dx / dist) * target, e.radius[j]!, ARENA_WIDTH - e.radius[j]!);
    e.y[j] = clamp(p.y + (dy / dist) * target, e.radius[j]!, ARENA_HEIGHT - e.radius[j]!);
    damageEnemy(state, j, b.vortexDamage, true, SRC_EXPLOSION);
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
