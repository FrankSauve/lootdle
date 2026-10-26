/**
 * Item effects at runtime: explosions, status damage, shock arcs, knockback, healing.
 *
 * Chains are capped (see MAX_EFFECT_DEPTH / MAX_EXPLOSIONS_PER_TICK) so a lucky explosive build
 * can't loop forever or melt the browser. Everything here is deterministic: no Math.random and
 * no trigonometry.
 */
import { ARENA_HEIGHT, ARENA_WIDTH, DT } from './config.ts';
import { damageEnemy } from './combat.ts';
import { MAX_ENEMY_RADIUS } from './enemies.ts';
import type { SimState } from './state.ts';

/** How many explosions may chain from one another. */
export const MAX_EFFECT_DEPTH = 3;
/** Hard cap on explosions per tick, however they were triggered. */
export const MAX_EXPLOSIONS_PER_TICK = 24;
/** Bosses shrug off most knockback. */
const BOSS_KNOCKBACK_RADIUS = 30;

export function explode(state: SimState, x: number, y: number, radius: number, damage: number): void {
  if (state.effectDepth >= MAX_EFFECT_DEPTH || state.explosionsThisTick >= MAX_EXPLOSIONS_PER_TICK) return;
  state.explosionsThisTick++;
  state.events.push({ type: 'explosion', x, y, radius });

  const buf = state.blastBufs[state.effectDepth]!;
  state.effectDepth++;
  const e = state.enemies;
  const n = state.grid.query(x, y, radius + MAX_ENEMY_RADIUS, buf);
  for (let k = 0; k < n; k++) {
    const j = buf[k]!;
    if (e.dead[j]) continue;
    const dx = e.x[j]! - x;
    const dy = e.y[j]! - y;
    const reach = radius + e.radius[j]!;
    if (dx * dx + dy * dy <= reach * reach) damageEnemy(state, j, damage);
  }
  state.effectDepth--;
}

export function healPlayer(state: SimState, amount: number): void {
  const p = state.player;
  const healed = Math.min(amount, p.maxHp - p.hp);
  if (healed <= 0) return;
  p.hp += healed;
  state.events.push({ type: 'heal', amount: healed });
}

/** Called whenever an enemy dies, wherever the damage came from. */
export function onEnemyKilled(state: SimState, x: number, y: number): void {
  const b = state.build;
  if (b.healKills > 0 && ++state.killsSinceHeal >= b.healKills) {
    state.killsSinceHeal = 0;
    healPlayer(state, b.healAmount);
  }
  if (b.explodeDamage > 0) explode(state, x, y, b.explodeRadius, b.explodeDamage);
}

/**
 * Called after a weapon hit lands on enemy `j`. (dirX, dirY) is the unit direction of the hit,
 * `damage` is how much it dealt. Applies knockback, poison, burn and shock arcs.
 */
export function applyHitEffects(state: SimState, j: number, dirX: number, dirY: number, damage: number): void {
  const b = state.build;
  const e = state.enemies;
  const x = e.x[j]!;
  const y = e.y[j]!;

  if (!e.dead[j]) {
    if (b.knockback > 0) {
      const r = e.radius[j]!;
      const push = r > BOSS_KNOCKBACK_RADIUS ? b.knockback * 0.2 : b.knockback;
      e.x[j] = clamp(x + dirX * push, r, ARENA_WIDTH - r);
      e.y[j] = clamp(y + dirY * push, r, ARENA_HEIGHT - r);
    }
    if (b.poisonDps > 0) {
      e.poisonT[j] = b.poisonSecs;
      e.poisonDps[j] = b.poisonDps;
    }
    if (b.burnDps > 0) {
      e.burnT[j] = b.burnSecs;
      e.burnDps[j] = b.burnDps;
    }
  }

  if (b.shockFrac > 0) zap(state, j, x, y, damage * b.shockFrac);
}

/** Chain lightning: hits up to `shockTargets` other enemies near (x, y). Never chains further. */
function zap(state: SimState, from: number, x: number, y: number, damage: number): void {
  const b = state.build;
  const e = state.enemies;
  const buf = state.zapBuf;
  const n = state.grid.query(x, y, b.shockRange + MAX_ENEMY_RADIUS, buf);
  const rangeSq = b.shockRange * b.shockRange;
  let hits = 0;
  for (let k = 0; k < n && hits < b.shockTargets; k++) {
    const t = buf[k]!;
    if (t === from || e.dead[t]) continue;
    const dx = e.x[t]! - x;
    const dy = e.y[t]! - y;
    if (dx * dx + dy * dy > rangeSq) continue;
    hits++;
    state.events.push({ type: 'zap', x, y, toX: e.x[t]!, toY: e.y[t]! });
    damageEnemy(state, t, damage);
  }
}

/** Ticks poison and burn on every afflicted enemy. */
export function tickStatuses(state: SimState): void {
  const b = state.build;
  if (b.poisonDps <= 0 && b.burnDps <= 0) return;
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
  if (b.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + b.regen * DT);
  if (state.barrierTimer > 0) state.barrierTimer = Math.max(0, state.barrierTimer - DT);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
