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
 * The spawn director: regular waves, rat swarms, a boss every 20 seconds, and the Doom transition at 2:00.
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
  let rate = 2.0 + 0.09 * t;
  if (t >= DOOM_SECONDS) rate += 2 + 0.1 * (t - DOOM_SECONDS);
  return rate;
}

/** Enemy HP multiplier at time t. */
export function hpMultiplier(t: number): number {
  let m = 1 + t / 50 + (t * t) / 9000;
  if (t >= DOOM_SECONDS) m += (1.3 * (t - DOOM_SECONDS)) / 60;
  return m;
}

/** Enemy contact-damage multiplier at time t. */
export function damageMultiplier(t: number): number {
  let m = 1 + (0.35 * t) / 60;
  if (t >= DOOM_SECONDS) m += 0.6 + (0.4 * (t - DOOM_SECONDS)) / 60;
  return m;
}

/** A swarm of rats floods in from every side every 30 seconds, starting at 0:25. */
const SWARM_FIRST_TICK = 25 * TICK_RATE;
const SWARM_INTERVAL_TICKS = 30 * TICK_RATE;

/** Bosses cycle through this list; from the fifth boss on, two arrive at once. */
const BOSS_ORDER: readonly EnemyKind[] = [
  EnemyKind.GiantSlime,
  EnemyKind.Juggernaut,
  EnemyKind.HiveQueen,
  EnemyKind.Lich,
];
const DOUBLE_BOSS_FROM = 5;

export function updateDirector(state: SimState): void {
  const tick = state.tick;
  const t = tick * DT;

  if (tick === DOOM_TICK) {
    state.doom = true;
    state.events.push({ type: 'doom' });
  }

  if (tick > 0 && tick % BOSS_INTERVAL_TICKS === 0) spawnBossWave(state, t, tick / BOSS_INTERVAL_TICKS);
  if (tick >= SWARM_FIRST_TICK && (tick - SWARM_FIRST_TICK) % SWARM_INTERVAL_TICKS === 0) spawnSwarm(state, t);

  state.spawnBudget += spawnRate(t) * DT;
  while (state.spawnBudget >= 1) {
    state.spawnBudget -= 1;
    spawnRegular(state, t);
  }
}

/**
 * The regular roster: each kind joins the mix at `from` seconds with a relative `weight`.
 * Tougher kinds get more common once Doom starts.
 */
interface RosterEntry {
  kind: EnemyKind;
  from: number;
  weight: number;
  doomWeight: number;
}
const ROSTER: readonly RosterEntry[] = [
  { kind: EnemyKind.Chaser, from: 0, weight: 10, doomWeight: 6 },
  { kind: EnemyKind.Rat, from: 8, weight: 3, doomWeight: 4 },
  { kind: EnemyKind.Flanker, from: 15, weight: 4, doomWeight: 4 },
  { kind: EnemyKind.Spitter, from: 25, weight: 3, doomWeight: 4 },
  { kind: EnemyKind.Bomber, from: 35, weight: 2.5, doomWeight: 3 },
  { kind: EnemyKind.Brute, from: 40, weight: 2, doomWeight: 3.5 },
  { kind: EnemyKind.Boar, from: 50, weight: 2.5, doomWeight: 3.5 },
  { kind: EnemyKind.Knight, from: 65, weight: 2, doomWeight: 3.5 },
  { kind: EnemyKind.Shaman, from: 80, weight: 1.2, doomWeight: 2 },
];
/** Rats arrive in packs of this size (one spawn "ticket" pays for all of them). */
const RAT_PACK = 5;

function pickRegularKind(roll: number, t: number, doom: boolean): EnemyKind {
  let total = 0;
  for (const r of ROSTER) if (t >= r.from) total += doom ? r.doomWeight : r.weight;
  let x = roll * total;
  for (const r of ROSTER) {
    if (t < r.from) continue;
    x -= doom ? r.doomWeight : r.weight;
    if (x < 0) return r.kind;
  }
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

  const hpMul = hpMultiplier(t);
  const dmgMul = damageMultiplier(t);
  if (kind === EnemyKind.Rat) {
    // A tight pack: offset sideways along the edge the pack came from.
    const horizontal = side === 0 || side === 2;
    for (let k = 0; k < RAT_PACK; k++) {
      const o = (k - (RAT_PACK - 1) / 2) * 16;
      state.enemies.spawn(kind, horizontal ? clampTo(x + o, r, ARENA_WIDTH - r) : x, horizontal ? y : clampTo(y + o, r, ARENA_HEIGHT - r), hpMul, dmgMul);
    }
    state.spawnBudget -= RAT_PACK - 1;
    return;
  }
  state.enemies.spawn(kind, x, y, hpMul, dmgMul);
}

/** Rats pour in along all four edges at once. */
function spawnSwarm(state: SimState, t: number): void {
  state.events.push({ type: 'swarm' });
  const perSide = 6 + Math.floor(t / 15);
  const r = ENEMY_DEFS[EnemyKind.Rat].radius;
  const hpMul = hpMultiplier(t);
  const dmgMul = damageMultiplier(t);
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < perSide; k++) {
      if (state.enemies.count >= REGULAR_ENEMY_CAP) return;
      const { x, y } = edgePoint(side, (k + 0.5) / perSide, r);
      state.enemies.spawn(EnemyKind.Rat, x, y, hpMul, dmgMul);
    }
  }
}

function spawnBossWave(state: SimState, t: number, wave: number): void {
  const count = wave >= DOUBLE_BOSS_FROM ? 2 : 1;
  for (let k = 0; k < count; k++) {
    const kind = BOSS_ORDER[(wave - 1 + k * 2) % BOSS_ORDER.length]!;
    spawnBoss(state, t, wave, kind, k);
  }
}

function spawnBoss(state: SimState, t: number, wave: number, kind: EnemyKind, rank: number): void {
  const number = ++state.bossesSpawned;
  const def = ENEMY_DEFS[kind];
  const r = def.radius;

  // Enter from the edge midpoint farthest from the player (the second boss takes the next farthest).
  const p = state.player;
  const candidates = [
    { x: ARENA_WIDTH / 2, y: r },
    { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - r },
    { x: r, y: ARENA_HEIGHT / 2 },
    { x: ARENA_WIDTH - r, y: ARENA_HEIGHT / 2 },
  ].map((c) => ({ c, d: (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y) }));
  candidates.sort((a, b) => b.d - a.d);
  const best = candidates[rank % candidates.length]!.c;

  const hpMul = (1 + 0.8 * (wave - 1)) * (state.doom ? 1.4 : 1);
  state.enemies.spawn(kind, best.x, best.y, hpMul, damageMultiplier(t));
  state.events.push({ type: 'bossSpawned', number, name: def.name });
}

function clampTo(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
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
