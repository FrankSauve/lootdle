import { ARENA_HEIGHT, ARENA_WIDTH, DT } from './config.ts';
import { SRC_CRIT, SRC_WEAPON, applyHitEffects, explode, onEnemyKilled, stormStrike } from './effects.ts';
import { ENEMY_DEFS, EnemyKind, MAX_ENEMY_RADIUS } from './enemies.ts';
import { BASE_CRIT_DAMAGE, MAX_ARMOR, MAX_CRIT_CHANCE, MAX_LIFESTEAL } from './upgrades.ts';
import { ENEMY_SHOT_RADIUS } from './enemyShots.ts';
import type { SimState } from './state.ts';

const PLAYER_INVULNERABLE_SECONDS = 0.5;
const RICOCHET_RANGE = 260;
const HIT_FLASH_SECONDS = 0.08;
/**
 * Pushes overlapping enemies apart so crowds stay readable. Bigger enemies get pushed less.
 * Expects the grid to have been built from current enemy positions.
 */
export function separateEnemies(state: SimState): void {
  const e = state.enemies;
  const buf = state.nearby;
  for (let i = 0; i < e.count; i++) {
    const ri = e.radius[i]!;
    const n = state.grid.query(e.x[i]!, e.y[i]!, ri + MAX_ENEMY_RADIUS, buf);
    for (let k = 0; k < n; k++) {
      const j = buf[k]!;
      if (j === i) continue;
      const rj = e.radius[j]!;
      const dx = e.x[i]! - e.x[j]!;
      const dy = e.y[i]! - e.y[j]!;
      const minDist = ri + rj;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist) continue;
      if (distSq < 1e-9) {
        // Exactly stacked: nudge apart along a direction derived from the ids.
        e.x[i] = e.x[i]! + (e.id[i]! > e.id[j]! ? 0.5 : -0.5);
        continue;
      }
      const dist = Math.sqrt(distSq);
      const push = ((minDist - dist) * (rj / minDist)) * 0.5;
      e.x[i] = e.x[i]! + (dx / dist) * push;
      e.y[i] = e.y[i]! + (dy / dist) * push;
    }
    e.x[i] = clamp(e.x[i]!, ri, ARENA_WIDTH - ri);
    e.y[i] = clamp(e.y[i]!, ri, ARENA_HEIGHT - ri);
  }
}

/** Moves projectiles, expires old ones, and resolves hits against enemies. */
export function updateProjectiles(state: SimState): void {
  const pr = state.projectiles;
  const e = state.enemies;
  const buf = state.nearby;

  for (let i = 0; i < pr.count; i++) {
    pr.life[i] = pr.life[i]! - DT;
    pr.x[i] = pr.x[i]! + pr.vx[i]! * DT;
    pr.y[i] = pr.y[i]! + pr.vy[i]! * DT;
    const x = pr.x[i]!;
    const y = pr.y[i]!;
    if (pr.life[i]! <= 0 || x < 0 || y < 0 || x > ARENA_WIDTH || y > ARENA_HEIGHT) {
      pr.dead[i] = 1;
      continue;
    }

    const r = pr.radius[i]!;
    const n = state.grid.query(x, y, r + MAX_ENEMY_RADIUS, buf);
    for (let k = 0; k < n; k++) {
      const j = buf[k]!;
      if (e.dead[j] || e.id[j] === pr.lastHitId[i] || e.id[j] === pr.lastHitId2[i]) continue;
      const dx = e.x[j]! - x;
      const dy = e.y[j]! - y;
      const hitDist = r + e.radius[j]!;
      if (dx * dx + dy * dy > hitDist * hitDist) continue;

      const dmg = weaponHit(state, j, pr.damage[i]!);
      const speed = Math.sqrt(pr.vx[i]! * pr.vx[i]! + pr.vy[i]! * pr.vy[i]!) || 1;
      applyHitEffects(state, j, pr.vx[i]! / speed, pr.vy[i]! / speed, dmg);
      if (pr.gen[i] === 0) {
        const b = state.build;
        if (b.impact > 0) {
          explode(state, x, y, b.impact * (1 + 0.5 * state.upgrades.range), dmg * 0.75, 25);
        }
        if (b.splinter > 0) splinter(state, i, j, pr.vx[i]!, pr.vy[i]!, pr.damage[i]!);
      }
      pr.lastHitId2[i] = pr.lastHitId[i]!;
      pr.lastHitId[i] = e.id[j]!;
      if (pr.pierce[i]! <= 0) {
        if (!ricochet(state, i, j, speed)) pr.dead[i] = 1;
        break;
      }
      pr.pierce[i] = pr.pierce[i]! - 1;
    }
  }
}

const SPLIT_COS: readonly number[] = [0.8660254037844386, 0.5];
const SPLIT_SIN: readonly number[] = [0.5, 0.8660254037844386];

/** Splinter: a hit bursts into fragments fanned out around the shot's direction. */
function splinter(state: SimState, i: number, hit: number, vx: number, vy: number, damage: number): void {
  const pr = state.projectiles;
  const pairs = Math.min(2, state.build.splinter >> 1);
  const id = state.enemies.id[hit]!;
  const x = pr.x[i]!;
  const y = pr.y[i]!;
  const radius = Math.max(4, pr.radius[i]! * 0.6);
  for (let k = 0; k < pairs; k++) {
    const c = SPLIT_COS[k]!;
    const s = SPLIT_SIN[k]!;
    for (const sign of [1, -1]) {
      const child = pr.spawn(x, y, vx * c - vy * s * sign, vy * c + vx * s * sign, damage * 0.5, radius, 0.5, 0);
      if (child < 0) return;
      pr.gen[child] = 1;
      pr.lastHitId[child] = id;
    }
  }
}

/**
 * A direct hit from the player's weapon: may crit, and heals the player for a share of the damage
 * actually dealt (lifesteal). Returns the damage rolled, which on-hit effects scale from.
 */
export function weaponHit(state: SimState, j: number, base: number): number {
  const u = state.upgrades;
  let amount = base;
  let src = SRC_WEAPON;
  if (u.critChance > 0 && state.critRng() < Math.min(MAX_CRIT_CHANCE, u.critChance)) {
    amount = base * (BASE_CRIT_DAMAGE + u.critDamage);
    src = SRC_CRIT;
  }
  const e = state.enemies;
  const before = e.hp[j]!;
  damageEnemy(state, j, amount, true, src);
  if (u.lifesteal > 0 && !(before <= 0)) {
    const dealt = before - Math.max(0, e.hp[j]!);
    const p = state.player;
    const healed = Math.min(dealt * Math.min(MAX_LIFESTEAL, u.lifesteal), p.maxHp - p.hp);
    if (healed > 0) {
      p.hp += healed;
      // Show a heal effect now and then, not on every hit.
      state.lifestealShown += healed;
      if (state.lifestealShown >= 3) {
        state.lifestealShown = 0;
        state.events.push({ type: 'heal', amount: healed });
      }
    }
  }
  return amount;
}

/** Ricochet: redirect a spent projectile toward another nearby enemy instead of removing it. */
function ricochet(state: SimState, i: number, hit: number, speed: number): boolean {
  const b = state.build;
  const pr = state.projectiles;
  if (b.ricochet <= 0 || pr.bounces[i]! >= b.ricochet) return false;
  const e = state.enemies;
  const buf = state.zapBuf;
  const x = pr.x[i]!;
  const y = pr.y[i]!;
  const n = state.grid.query(x, y, RICOCHET_RANGE + MAX_ENEMY_RADIUS, buf);
  let best = -1;
  let bestD = RICOCHET_RANGE * RICOCHET_RANGE;
  for (let k = 0; k < n; k++) {
    const t = buf[k]!;
    if (t === hit || e.dead[t]) continue;
    const dx = e.x[t]! - x;
    const dy = e.y[t]! - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (best < 0) return false;
  const len = Math.sqrt(bestD) || 1;
  pr.vx[i] = ((e.x[best]! - x) / len) * speed;
  pr.vy[i] = ((e.y[best]! - y) / len) * speed;
  pr.bounces[i] = pr.bounces[i]! + 1;
  pr.life[i] = Math.max(pr.life[i]!, 0.6);
  return true;
}

/**
 * Damages enemy `i`. `flash: false` is for damage-over-time, which shouldn't strobe the sprite
 * (and doesn't produce floating numbers). `src` says where the damage came from (for colors).
 */
export function damageEnemy(
  state: SimState,
  i: number,
  amount: number,
  flash = true,
  src: number = SRC_WEAPON,
): void {
  const e = state.enemies;
  if (e.dead[i]) return;
  // Armored enemies shrug off part of every direct weapon hit (not explosions, arcs or DOT).
  if (flash && (src === SRC_WEAPON || src === SRC_CRIT)) amount *= ENEMY_DEFS[e.kind[i]! as EnemyKind].armor;
  const dealt = Math.min(amount, e.hp[i]!);
  e.hp[i] = e.hp[i]! - amount;
  if (flash) {
    e.flash[i] = HIT_FLASH_SECONDS;
    state.events.push({ type: 'hit', x: e.x[i]!, y: e.y[i]!, amount, src });
  }
  state.stats.damageDealt += dealt;
  if (e.hp[i]! <= 0) killEnemy(state, i);
}

export function killEnemy(state: SimState, i: number): void {
  const e = state.enemies;
  e.dead[i] = 1;
  const kind = e.kind[i]! as EnemyKind;
  const x = e.x[i]!;
  const y = e.y[i]!;
  state.stats.kills++;
  state.events.push({ type: 'kill', x, y, kind });

  const def = ENEMY_DEFS[kind];
  if (def.boss) {
    state.stats.bossesDefeated++;
    state.events.push({ type: 'bossDefeated', x, y, name: def.name });
  }

  if (kind === EnemyKind.GiantSlime) {
    // Splits into four slimelets, scaled like the boss that spawned them.
    const hpMul = e.maxHp[i]! / def.hp;
    const dmgMul = e.damage[i]! / def.damage;
    const o = def.radius * 0.5;
    e.spawn(EnemyKind.Slimelet, x - o, y - o, hpMul * 0.5, dmgMul);
    e.spawn(EnemyKind.Slimelet, x + o, y - o, hpMul * 0.5, dmgMul);
    e.spawn(EnemyKind.Slimelet, x - o, y + o, hpMul * 0.5, dmgMul);
    e.spawn(EnemyKind.Slimelet, x + o, y + o, hpMul * 0.5, dmgMul);
  }

  if (kind === EnemyKind.Bomber) {
    // Detonates on death: dangerous up close, harmless if shot from afar.
    const p = state.player;
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy <= BOMB_RADIUS * BOMB_RADIUS) hurtPlayer(state, e.damage[i]!);
    state.events.push({ type: 'enemyBlast', x, y, radius: BOMB_RADIUS, style: 0 });
  }

  onEnemyKilled(state, x, y, e.poisonT[i]! > 0);
}

const BOMB_RADIUS = 80;

/** Contact damage from enemies touching the player, with brief invulnerability after each hit. */
export function updatePlayerContact(state: SimState): void {
  const p = state.player;
  if (p.invulnerable > 0) {
    p.invulnerable = Math.max(0, p.invulnerable - DT);
    return;
  }

  const e = state.enemies;
  const buf = state.nearby;
  const n = state.grid.query(p.x, p.y, p.radius + MAX_ENEMY_RADIUS, buf);
  let worst = 0;
  for (let k = 0; k < n; k++) {
    const j = buf[k]!;
    if (e.dead[j]) continue;
    const dx = e.x[j]! - p.x;
    const dy = e.y[j]! - p.y;
    if (e.kind[j] === EnemyKind.Bomber) continue; // bombers hurt by exploding, not by touching
    const hitDist = p.radius + e.radius[j]!;
    if (dx * dx + dy * dy <= hitDist * hitDist && e.damage[j]! > worst) worst = e.damage[j]!;
  }
  if (worst <= 0) return;
  hurtPlayer(state, worst);
}

/** Applies one hit of `damage` to the player: barrier, bastion, thorns, phoenix and invulnerability. */
export function hurtPlayer(state: SimState, damage: number): void {
  const p = state.player;
  if (p.invulnerable > 0 || state.over) return;
  const b = state.build;
  p.invulnerable = PLAYER_INVULNERABLE_SECONDS;

  // A ready barrier soaks the whole hit; Bastion halves damage while standing still.
  const still = p.x === p.prevX && p.y === p.prevY;
  let taken = damage * b.damageTakenMul * (1 - Math.min(MAX_ARMOR, state.upgrades.armor)) * (still ? b.bastionMul : 1);
  if (b.barrierCooldown > 0 && state.barrierTimer <= 0) {
    state.barrierTimer = b.barrierCooldown;
    state.events.push({ type: 'blocked' });
    taken = 0;
  } else {
    state.events.push({ type: 'playerHit', damage: taken });
  }

  // Thorns and Storm Ward retaliate whether or not the hit got through.
  if (b.thornsDamage > 0) explode(state, p.x, p.y, b.thornsRadius, b.thornsDamage);
  if (b.stormWard) stormStrike(state);

  if (state.godMode || taken <= 0) return;
  p.hp = Math.max(0, p.hp - taken);
  state.stats.damageTaken += taken;

  // Phoenix Heart: once per run, death is cheated.
  if (p.hp <= 0 && b.phoenixHeal > 0 && !state.phoenixUsed) {
    state.phoenixUsed = true;
    p.hp = Math.max(1, p.maxHp * b.phoenixHeal);
    p.invulnerable = 2;
    state.events.push({ type: 'revive' });
    explode(state, p.x, p.y, b.phoenixRadius, b.phoenixDamage, 90);
  }
}

/** Moves hostile projectiles and applies their hits to the player. */
export function updateEnemyShots(state: SimState): void {
  const s = state.enemyShots;
  const p = state.player;
  const reach = p.radius + ENEMY_SHOT_RADIUS;
  for (let i = 0; i < s.count; i++) {
    s.x[i] = s.x[i]! + s.vx[i]! * DT;
    s.y[i] = s.y[i]! + s.vy[i]! * DT;
    s.life[i] = s.life[i]! - DT;
    const x = s.x[i]!;
    const y = s.y[i]!;
    if (s.life[i]! <= 0 || x < -20 || y < -20 || x > ARENA_WIDTH + 20 || y > ARENA_HEIGHT + 20) {
      s.dead[i] = 1;
      continue;
    }
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy <= reach * reach && p.invulnerable <= 0) {
      s.dead[i] = 1;
      hurtPlayer(state, s.damage[i]!);
    }
  }
}

export function updateFlashes(state: SimState): void {
  const e = state.enemies;
  for (let i = 0; i < e.count; i++) {
    if (e.flash[i]! > 0) e.flash[i] = Math.max(0, e.flash[i]! - DT);
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
