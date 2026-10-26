import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BOSS_INTERVAL_SECONDS,
  DOOM_SECONDS,
  DT,
  TICK_RATE,
} from './config.ts';
import { ENEMY_DEFS, EnemyKind } from './enemies.ts';
import type { SimState } from './state.ts';

/**
 * The spawn director: regular waves, a boss every 20 seconds, and the Doom transition at 2:00.
 * Every formula here is a function of time only, so all players face the same schedule.
 *
 * It always consumes the same number of worldRng values per spawn regardless of where the player
 * is, so the shared daily schedule never drifts between players.
 */

const BOSS_INTERVAL_TICKS = BOSS_INTERVAL_SECONDS * TICK_RATE;
const DOOM_TICK = DOOM_SECONDS * TICK_RATE;

/** Regular enemies stop spawning above this, leaving room for bosses and splits. */
const REGULAR_ENEMY_CAP = 600;
/** Regular spawns are moved to the opposite side of the arena when this close to the player. */
const SAFE_SPAWN_DISTANCE = 300;

/** Regular enemies per second at time t (seconds). */
export function spawnRate(t: number): number {
  let rate = 1.2 + 0.05 * t;
  if (t >= DOOM_SECONDS) rate += 1.5 + 0.08 * (t - DOOM_SECONDS);
  return rate;
}

/** Enemy HP multiplier at time t. */
export function hpMultiplier(t: number): number {
  let m = 1 + (0.6 * t) / 60;
  if (t >= DOOM_SECONDS) m += (0.9 * (t - DOOM_SECONDS)) / 60;
  return m;
}

/** Enemy contact-damage multiplier at time t. */
export function damageMultiplier(t: number): number {
  let m = 1 + (0.25 * t) / 60;
  if (t >= DOOM_SECONDS) m += 0.5 + (0.3 * (t - DOOM_SECONDS)) / 60;
  return m;
}

export function updateDirector(state: SimState): void {
  const tick = state.tick;
  const t = tick * DT;

  if (tick === DOOM_TICK) {
    state.doom = true;
    state.events.push({ type: 'doom' });
  }

  if (tick > 0 && tick % BOSS_INTERVAL_TICKS === 0) spawnBoss(state, t);

  state.spawnBudget += spawnRate(t) * DT;
  while (state.spawnBudget >= 1) {
    state.spawnBudget -= 1;
    spawnRegular(state, t);
  }
}

function pickRegularKind(roll: number, t: number, doom: boolean): EnemyKind {
  const bruteChance = doom ? 0.15 : t >= 60 ? 0.08 : 0;
  const flankerChance = t >= 30 ? 0.25 : 0;
  if (roll < bruteChance) return EnemyKind.Brute;
  if (roll < bruteChance + flankerChance) return EnemyKind.Flanker;
  return EnemyKind.Chaser;
}

function spawnRegular(state: SimState, t: number): void {
  const rng = state.worldRng;
  // Draw all values up front so rng consumption never depends on game state.
  const kindRoll = rng();
  const side = Math.floor(rng() * 4);
  const along = rng();

  if (state.enemies.count >= REGULAR_ENEMY_CAP) return;

  const kind = pickRegularKind(kindRoll, t, state.doom);
  const r = ENEMY_DEFS[kind].radius;
  let { x, y } = edgePoint(side, along, r);

  const p = state.player;
  const dx = x - p.x;
  const dy = y - p.y;
  if (dx * dx + dy * dy < SAFE_SPAWN_DISTANCE * SAFE_SPAWN_DISTANCE) {
    x = ARENA_WIDTH - x;
    y = ARENA_HEIGHT - y;
  }

  state.enemies.spawn(kind, x, y, hpMultiplier(t), damageMultiplier(t));
}

function spawnBoss(state: SimState, t: number): void {
  const number = ++state.bossesSpawned;
  const kind = EnemyKind.GiantSlime;
  const def = ENEMY_DEFS[kind];
  const r = def.radius;

  // Enter from the edge midpoint farthest from the player.
  const p = state.player;
  const candidates = [
    { x: ARENA_WIDTH / 2, y: r },
    { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - r },
    { x: r, y: ARENA_HEIGHT / 2 },
    { x: ARENA_WIDTH - r, y: ARENA_HEIGHT / 2 },
  ];
  let best = candidates[0]!;
  let bestDist = -1;
  for (const c of candidates) {
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    const d = dx * dx + dy * dy;
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }

  const hpMul = (1 + 0.6 * (number - 1)) * (state.doom ? 1.4 : 1);
  state.enemies.spawn(kind, best.x, best.y, hpMul, damageMultiplier(t));
  state.events.push({ type: 'bossSpawned', number, name: def.name });
}

/** A point on the given arena side (0 top, 1 right, 2 bottom, 3 left), inset by radius r. */
function edgePoint(side: number, along: number, r: number): { x: number; y: number } {
  switch (side) {
    case 0:
      return { x: r + along * (ARENA_WIDTH - 2 * r), y: r };
    case 1:
      return { x: ARENA_WIDTH - r, y: r + along * (ARENA_HEIGHT - 2 * r) };
    case 2:
      return { x: r + along * (ARENA_WIDTH - 2 * r), y: ARENA_HEIGHT - r };
    default:
      return { x: r, y: r + along * (ARENA_HEIGHT - 2 * r) };
  }
}
