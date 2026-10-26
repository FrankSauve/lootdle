import { ARENA_HEIGHT, ARENA_WIDTH, DT } from './config.ts';
import { applyHitEffects, explode, onEnemyKilled } from './effects.ts';
import { ENEMY_DEFS, EnemyKind, MAX_ENEMY_RADIUS } from './enemies.ts';
import type { SimState } from './state.ts';

const PLAYER_INVULNERABLE_SECONDS = 0.5;
const HIT_FLASH_SECONDS = 0.08;
/** Flankers aim this far to the side of the player until they get close. */
const FLANK_OFFSET = 140;
const FLANK_COMMIT_DISTANCE = 180;

/** Moves every enemy toward the player (flankers swing wide first). */
export function moveEnemies(state: SimState): void {
  const e = state.enemies;
  const p = state.player;
  for (let i = 0; i < e.count; i++) {
    let dx = p.x - e.x[i]!;
    let dy = p.y - e.y[i]!;
    let len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) continue;

    if (e.kind[i] === EnemyKind.Flanker && len > FLANK_COMMIT_DISTANCE) {
      // Perpendicular offset; the side depends on the enemy id so flankers split left and right.
      const side = e.id[i]! & 1 ? 1 : -1;
      const tx = p.x + (-dy / len) * side * FLANK_OFFSET;
      const ty = p.y + (dx / len) * side * FLANK_OFFSET;
      dx = tx - e.x[i]!;
      dy = ty - e.y[i]!;
      len = Math.sqrt(dx * dx + dy * dy) || 1;
    }

    const step = (e.speed[i]! * DT) / len;
    e.x[i] = e.x[i]! + dx * step;
    e.y[i] = e.y[i]! + dy * step;
  }
}

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

      const dmg = pr.damage[i]!;
      damageEnemy(state, j, dmg);
      const speed = Math.sqrt(pr.vx[i]! * pr.vx[i]! + pr.vy[i]! * pr.vy[i]!) || 1;
      applyHitEffects(state, j, pr.vx[i]! / speed, pr.vy[i]! / speed, dmg);
      pr.lastHitId2[i] = pr.lastHitId[i]!;
      pr.lastHitId[i] = e.id[j]!;
      if (pr.pierce[i]! <= 0) {
        pr.dead[i] = 1;
        break;
      }
      pr.pierce[i] = pr.pierce[i]! - 1;
    }
  }
}

/** Damages enemy `i`. `flash: false` is for damage-over-time, which shouldn't strobe the sprite. */
export function damageEnemy(state: SimState, i: number, amount: number, flash = true): void {
  const e = state.enemies;
  if (e.dead[i]) return;
  const dealt = Math.min(amount, e.hp[i]!);
  e.hp[i] = e.hp[i]! - amount;
  if (flash) e.flash[i] = HIT_FLASH_SECONDS;
  state.stats.damageDealt += dealt;
  if (e.hp[i]! <= 0) killEnemy(state, i);
}

function killEnemy(state: SimState, i: number): void {
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

  onEnemyKilled(state, x, y);
}

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
    const hitDist = p.radius + e.radius[j]!;
    if (dx * dx + dy * dy <= hitDist * hitDist && e.damage[j]! > worst) worst = e.damage[j]!;
  }
  if (worst <= 0) return;

  const b = state.build;
  p.invulnerable = PLAYER_INVULNERABLE_SECONDS;

  // A ready barrier soaks the whole hit.
  let taken = worst * b.damageTakenMul;
  if (b.barrierCooldown > 0 && state.barrierTimer <= 0) {
    state.barrierTimer = b.barrierCooldown;
    state.events.push({ type: 'blocked' });
    taken = 0;
  } else {
    state.events.push({ type: 'playerHit', damage: taken });
  }

  // Thorns retaliate whether or not the hit got through.
  if (b.thornsDamage > 0) explode(state, p.x, p.y, b.thornsRadius, b.thornsDamage);

  if (state.godMode || taken <= 0) return;
  p.hp = Math.max(0, p.hp - taken);
  state.stats.damageTaken += taken;
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
