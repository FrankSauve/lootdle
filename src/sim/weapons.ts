import { DT } from './config.ts';
import type { SimState, WeaponState } from './state.ts';

/** Placeholder starting weapon until loot generation exists. */
export function createThrowingKnives(): WeaponState {
  return {
    name: 'Throwing Knives',
    cooldown: 0.35,
    timer: 0.2,
    projectilesPerVolley: 2,
    damage: 12,
    projectileSpeed: 720,
    projectileRadius: 6,
    projectileLife: 1.1,
    pierce: 0,
    range: 520,
  };
}

const MAX_TARGETS = 16;
const targetIdx = new Int32Array(MAX_TARGETS);
const targetDist = new Float64Array(MAX_TARGETS);

/** Fires a volley at the nearest enemies whenever the weapon is ready. */
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
  w.timer += w.cooldown;

  for (let n = 0; n < w.projectilesPerVolley; n++) {
    const t = targetIdx[n % found]!;
    let dx = e.x[t]! - p.x;
    let dy = e.y[t]! - p.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len;
    dy /= len;
    state.projectiles.spawn(
      p.x,
      p.y,
      dx * w.projectileSpeed,
      dy * w.projectileSpeed,
      w.damage,
      w.projectileRadius,
      w.projectileLife,
      w.pierce,
    );
  }
}
