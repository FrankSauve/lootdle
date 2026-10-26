/**
 * Headless simulation check: `npm run sim:check` (plain Node, no browser needed).
 *
 * 1. Determinism: runs the same seeded run twice with scripted movement and compares state hashes.
 * 2. Survival sample: how long the scripted "player" lasts with the seed's loadout.
 * 3. Load test: a god-mode run to 6:00 that reports entity counts and time per tick.
 * 4. Loot: loadouts are deterministic, varied, and don't make survival a function of rarity.
 * 5. Stress: the most effect-heavy loadout we can find still runs inside the frame budget.
 */
import { compileBuild } from '../src/sim/build.ts';
import { RARITY_NAMES } from '../src/sim/items.ts';
import { createRng } from '../src/sim/rng.ts';
import { DT, TICK_RATE, createSim, elapsedSeconds, stepSim } from '../src/sim/sim.ts';
import { generateLoadout } from '../src/sim/sim.ts';
import type { Loadout, MoveInput, SimState } from '../src/sim/sim.ts';

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

function run(maxSeconds: number, godMode: boolean, playerSeed = PLAYER_SEED, loadout?: Loadout) {
  const state = createSim({ worldSeed: WORLD_SEED, playerSeed, godMode, ...(loadout ? { loadout } : {}) });
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

// 4: loot
const SAMPLE = 60;
const rarityCounts = [0, 0, 0, 0, 0];
const families = new Map<string, number>();
const quirked = { items: 0, total: 0 };
const points: { loot: number; survived: number }[] = [];
let lootDeterministic = true;
for (let seed = 1; seed <= SAMPLE; seed++) {
  const l = generateLoadout(seed);
  if (JSON.stringify(l) !== JSON.stringify(generateLoadout(seed))) lootDeterministic = false;
  for (const item of [l.weapon, l.armor, l.trinket]) {
    rarityCounts[item.rarity]!++;
    quirked.total++;
    if (item.quirk) quirked.items++;
  }
  families.set(l.family, (families.get(l.family) ?? 0) + 1);
  const r = run(240, false, seed);
  if (!Number.isFinite(r.stats.damageDealt) || !Number.isFinite(r.survived)) {
    console.log(`Seed ${seed}: non-finite result`);
    failed = true;
  }
  points.push({ loot: l.weapon.rarity + l.armor.rarity + l.trinket.rarity, survived: r.survived });
}
console.log(`Loot determinism: ${lootDeterministic ? 'OK' : 'MISMATCH'}`);
if (!lootDeterministic) failed = true;
console.log(
  `Rarity mix over ${SAMPLE * 3} items: ` +
    RARITY_NAMES.map((n, i) => `${n} ${rarityCounts[i]}`).join(', ') +
    `; ${quirked.items} have a drawback`,
);
console.log(`Build families: ${[...families].map(([f, c]) => `${f} ${c}`).join(', ')}`);
const times = points.map((p) => p.survived).sort((x, y) => x - y);
console.log(
  `Scripted survival across ${SAMPLE} loadouts: min ${fmt(times[0]!)}, median ${fmt(times[Math.floor(SAMPLE / 2)]!)}, ` +
    `max ${fmt(times[SAMPLE - 1]!)}`,
);
console.log(`Correlation of total rarity with survival: ${correlation(points).toFixed(2)} (closer to 0 is better)`);

// 5: stress test with the most effect-heavy loadout among many seeds
let stress: Loadout | undefined;
let stressScore = -1;
for (let seed = 1; seed <= 3000; seed++) {
  const b = compileBuild(generateLoadout(seed));
  const score =
    (b.explodeDamage > 0 ? 4 : 0) + (b.shockFrac > 0 ? 2 : 0) + (b.poisonDps > 0 ? 1 : 0) +
    (b.burnDps > 0 ? 1 : 0) + (b.thornsDamage > 0 ? 2 : 0) + b.count + (b.echoEvery > 0 ? 2 : 0) + b.explodeDamage / 10;
  if (score > stressScore) {
    stressScore = score;
    stress = generateLoadout(seed);
  }
}
const s = run(240, true, 1, stress);
console.log(
  `Stress loadout "${stress!.buildName}" (${stress!.weapon.name} / ${stress!.armor.name} / ${stress!.trinket.name}): ` +
    `${s.stats.kills} kills in ${fmt(s.survived)}, ${s.avgTickMs.toFixed(3)} ms/tick avg, ` +
    `${s.slowestTickMs.toFixed(2)} ms slowest`,
);
if (s.avgTickMs > 4) {
  console.log('Stress loadout is too slow');
  failed = true;
}

function correlation(pts: { loot: number; survived: number }[]): number {
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.loot, 0) / n;
  const my = pts.reduce((a, p) => a + p.survived, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of pts) {
    sxy += (p.loot - mx) * (p.survived - my);
    sxx += (p.loot - mx) ** 2;
    syy += (p.survived - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

process.exit(failed ? 1 : 0);
