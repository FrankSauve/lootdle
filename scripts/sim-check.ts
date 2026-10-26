/**
 * Headless simulation check: `npm run sim:check` (plain Node, no browser needed).
 *
 * 1. Determinism: runs the same seeded run twice with scripted movement and compares state hashes.
 * 2. Survival sample: how long the scripted "player" lasts with the starting weapon.
 * 3. Load test: a god-mode run to 6:00 that reports entity counts and time per tick.
 */
import { createRng } from '../src/sim/rng.ts';
import { DT, TICK_RATE, createSim, elapsedSeconds, stepSim } from '../src/sim/sim.ts';
import type { MoveInput, SimState } from '../src/sim/sim.ts';

const WORLD_SEED = 20261026;
const PLAYER_SEED = 12345;

/** Scripted input: a new random 8-way direction every 1.5 s, steering away from walls. */
function makeScriptedInput(seed: number) {
  const rng = createRng(seed);
  const dirs: MoveInput[] = [
    { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
    { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  ];
  let current: MoveInput = { x: 0, y: 0 };
  return (state: SimState): MoveInput => {
    if (state.tick % 90 === 0) current = dirs[Math.floor(rng() * dirs.length)]!;
    const p = state.player;
    const x = p.x < 150 ? 1 : p.x > 1450 ? -1 : current.x;
    const y = p.y < 150 ? 1 : p.y > 750 ? -1 : current.y;
    return { x, y };
  };
}

/** FNV-1a over the raw bits of the parts of the state that matter. */
function hashState(state: SimState, h: number): number {
  const mix = (n: number) => {
    const f = new Float64Array([n]);
    const u = new Uint32Array(f.buffer);
    h = Math.imul(h ^ u[0]!, 0x01000193);
    h = Math.imul(h ^ u[1]!, 0x01000193);
  };
  mix(state.player.x);
  mix(state.player.y);
  mix(state.player.hp);
  mix(state.enemies.count);
  mix(state.projectiles.count);
  mix(state.stats.kills);
  mix(state.stats.damageDealt);
  for (let i = 0; i < state.enemies.count; i++) {
    mix(state.enemies.x[i]!);
    mix(state.enemies.y[i]!);
    mix(state.enemies.hp[i]!);
  }
  return h >>> 0;
}

function run(maxSeconds: number, godMode: boolean) {
  const state = createSim({ worldSeed: WORLD_SEED, playerSeed: PLAYER_SEED, godMode });
  const input = makeScriptedInput(99);
  let hash = 0x811c9dc5;
  let maxEnemies = 0;
  let maxProjectiles = 0;
  let bossesSpawned = 0;
  let doomAt = -1;
  const start = performance.now();
  let slowestTickMs = 0;
  const maxTicks = maxSeconds * TICK_RATE;

  while (!state.over && state.tick < maxTicks) {
    const t0 = performance.now();
    stepSim(state, input(state));
    const dt = performance.now() - t0;
    if (dt > slowestTickMs) slowestTickMs = dt;

    for (const ev of state.events) {
      if (ev.type === 'bossSpawned') bossesSpawned++;
      if (ev.type === 'doom') doomAt = (state.tick - 1) * DT;
    }
    if (state.tick % TICK_RATE === 0) hash = hashState(state, hash);
    maxEnemies = Math.max(maxEnemies, state.enemies.count);
    maxProjectiles = Math.max(maxProjectiles, state.projectiles.count);
  }

  const totalMs = performance.now() - start;
  return {
    survived: elapsedSeconds(state),
    over: state.over,
    hash: hashState(state, hash),
    stats: state.stats,
    bossesSpawned,
    doomAt,
    maxEnemies,
    maxProjectiles,
    avgTickMs: totalMs / Math.max(1, state.tick),
    slowestTickMs,
  };
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

let failed = false;

// 1 + 2: determinism and survival sample
const a = run(600, false);
const b = run(600, false);
const same = a.hash === b.hash && a.survived === b.survived;
console.log(`Determinism: ${same ? 'OK' : 'MISMATCH'} (hash ${a.hash.toString(16)} vs ${b.hash.toString(16)})`);
if (!same) failed = true;
console.log(
  `Scripted run: survived ${fmt(a.survived)}, ${a.stats.kills} kills, ` +
    `${a.stats.bossesDefeated}/${a.bossesSpawned} bosses defeated, ` +
    `${Math.round(a.stats.damageDealt)} damage dealt, ${Math.round(a.stats.damageTaken)} taken`,
);

// 3: load test
const g = run(360, true);
console.log(
  `God-mode load test to ${fmt(g.survived)}: peak ${g.maxEnemies} enemies / ${g.maxProjectiles} projectiles, ` +
    `${g.stats.kills} kills, ${g.bossesSpawned} bosses spawned, ${g.stats.bossesDefeated} defeated, ` +
    `Doom at ${g.doomAt >= 0 ? fmt(g.doomAt) : 'never'}`,
);
console.log(
  `Sim cost: ${g.avgTickMs.toFixed(3)} ms/tick average, ${g.slowestTickMs.toFixed(2)} ms slowest ` +
    `(budget at 60 Hz is ${(DT * 1000).toFixed(1)} ms per tick)`,
);
if (g.doomAt !== 120) {
  console.log('Expected Doom at 2:00');
  failed = true;
}

process.exit(failed ? 1 : 0);
