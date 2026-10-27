import type { Build } from './build.ts';
import { DT } from './config.ts';
import { weaponHit } from './combat.ts';
import { applyHitEffects, explode } from './effects.ts';
import { MAX_ENEMY_RADIUS } from './enemies.ts';
import type { SimState, WeaponState } from './state.ts';

export function createWeapon(build: Build, name: string): WeaponState {
  return {
    name,
    cooldown: build.cooldown,
    timer: 0.2,
    projectilesPerVolley: build.count,
    damage: build.damage,
    projectileSpeed: build.projectileSpeed,
    projectileRadius: build.projectileRadius,
    projectileLife: build.projectileLife,
    pierce: build.pierce,
    range: build.range,
    melee: build.melee,
    meleeRadius: build.meleeRadius,
    meleeOffset: build.meleeOffset,
  };
}

const MAX_TARGETS = 16;
/** A weapon can fire at most this many volleys in a single tick. */
const MAX_VOLLEYS_PER_TICK = 4;
const targetIdx = new Int32Array(MAX_TARGETS);
const targetDist = new Float64Array(MAX_TARGETS);
/** Scratch aim direction (avoids allocating per shot). */
let aimX = 0;
let aimY = 0;

/** Fires (or swings) at the nearest enemies whenever the weapon is ready. */
export function updateWeapon(state: SimState): void {
  const w = state.weapon;
  w.timer -= DT;
  if (w.timer > 0) return;

  const p = state.player;
  const e = state.enemies;
  const wanted = Math.min(w.projectilesPerVolley, MAX_TARGETS);
  const rangeSq = w.range * w.range;

  // Keep the `wanted` nearest enemies in a small sorted list (insertion sort).
  let found = 0;
  for (let i = 0; i < e.count; i++) {
    if (e.dead[i]) continue;
    const dx = e.x[i]! - p.x;
    const dy = e.y[i]! - p.y;
    const d = dx * dx + dy * dy;
    if (d > rangeSq) continue;
    if (found === wanted && d >= targetDist[found - 1]!) continue;
    let k = found < wanted ? found++ : found - 1;
    while (k > 0 && targetDist[k - 1]! > d) {
      targetDist[k] = targetDist[k - 1]!;
      targetIdx[k] = targetIdx[k - 1]!;
      k--;
    }
    targetDist[k] = d;
    targetIdx[k] = i;
  }

  if (found === 0) {
    w.timer = 0; // stay ready and fire as soon as something is in range
    return;
  }

  // Very fast weapons fire several volleys in one tick (up to the cap).
  let rounds = 0;
  do {
    w.timer += w.cooldown;
    volley(state, found);
  } while (w.timer <= 0 && ++rounds < MAX_VOLLEYS_PER_TICK);
  if (w.timer < 0) w.timer = 0;
}

/** One volley at the targets already found. */
function volley(state: SimState, found: number): void {
  const w = state.weapon;
  const p = state.player;
  const b = state.build;
  if (b.bloodPrice && p.hp > 1) p.hp = Math.max(1, p.hp - 1);

  const count = w.projectilesPerVolley;
  for (let n = 0; n < count; n++) {
    if (b.fan > 0 && !w.melee) {
      // A fan: everything aims at the nearest enemy, spread evenly either side.
      fireAt(state, targetIdx[0]!, (n - (count - 1) / 2) * b.fan);
    } else {
      fireAt(state, targetIdx[n % found]!, 0);
    }
    state.shots++;
    if (b.echoEvery > 0 && state.shots % b.echoEvery === 0) {
      // Echo: a duplicate toward the next target (or slightly off to the side if there's only one).
      fireAt(state, targetIdx[(n + 1) % found]!, found === 1 ? 0.35 : 0);
    }
  }

  state.volleys++;
  if (b.novaEvery > 0 && state.volleys % b.novaEvery === 0) nova(state);
}

/** Berserker: damage climbs as the player's HP drops. */
function attackDamage(state: SimState): number {
  const b = state.build;
  const p = state.player;
  if (b.berserker <= 0) return state.weapon.damage;
  return state.weapon.damage * (1 + b.berserker * (1 - p.hp / p.maxHp));
}

/** Eight exact directions (no trigonometry needed). */
const R = 0.7071067811865476;
const NOVA_DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [R, R], [0, 1], [-R, R], [-1, 0], [-R, -R], [0, -1], [R, -R],
];

/** Nova: a ring of projectiles, or a heavy shockwave for melee weapons. */
function nova(state: SimState): void {
  const w = state.weapon;
  const p = state.player;
  const damage = attackDamage(state);
  if (w.melee) {
    explode(state, p.x, p.y, w.meleeRadius * 1.9, damage * 1.5, 40);
    return;
  }
  for (const [dx, dy] of NOVA_DIRS) {
    state.projectiles.spawn(
      p.x,
      p.y,
      dx * w.projectileSpeed,
      dy * w.projectileSpeed,
      damage,
      w.projectileRadius,
      w.projectileLife,
      w.pierce,
    );
  }
}

/** Aims at enemy `t`, adds any extra angle and jitter, then fires or swings. */
function fireAt(state: SimState, t: number, extraAngle: number): void {
  const w = state.weapon;
  const p = state.player;
  const e = state.enemies;
  let dx = e.x[t]! - p.x;
  let dy = e.y[t]! - p.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  aimX = dx / len;
  aimY = dy / len;
  if (extraAngle !== 0) rotate(extraAngle);
  if (state.build.spread > 0) rotate((state.playerRng() - 0.5) * 2 * state.build.spread);
  dx = aimX;
  dy = aimY;

  if (w.melee) {
    swing(state, dx, dy);
    return;
  }
  state.projectiles.spawn(
    p.x,
    p.y,
    dx * w.projectileSpeed,
    dy * w.projectileSpeed,
    attackDamage(state),
    w.projectileRadius,
    w.projectileLife,
    w.pierce,
  );
}

/** Small-angle rotation of the scratch aim direction (a is in radians, kept small and exact). */
function rotate(a: number): void {
  const nx = aimX - aimY * a;
  const ny = aimY + aimX * a;
  const l = Math.sqrt(nx * nx + ny * ny) || 1;
  aimX = nx / l;
  aimY = ny / l;
}

/** Melee strike: hits every enemy inside a circle in front of the player, once. */
function swing(state: SimState, dx: number, dy: number): void {
  const w = state.weapon;
  const p = state.player;
  const e = state.enemies;
  const damage = attackDamage(state);
  const cx = p.x + dx * w.meleeOffset;
  const cy = p.y + dy * w.meleeOffset;
  state.events.push({ type: 'slash', x: cx, y: cy, dx, dy, radius: w.meleeRadius });

  const buf = state.nearby;
  const n = state.grid.query(cx, cy, w.meleeRadius + MAX_ENEMY_RADIUS, buf);
  for (let k = 0; k < n; k++) {
    const j = buf[k]!;
    if (e.dead[j]) continue;
    const ex = e.x[j]! - cx;
    const ey = e.y[j]! - cy;
    const reach = w.meleeRadius + e.radius[j]!;
    if (ex * ex + ey * ey > reach * reach) continue;
    const dealt = weaponHit(state, j, damage);
    applyHitEffects(state, j, dx, dy, dealt);
  }
}
