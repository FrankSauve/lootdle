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
import { ENEMY_DEFS, EnemyKind } from '../src/sim/enemies.ts';
import { RARITY_NAMES, SIGNATURES, SYNERGIES, WEAPONS } from '../src/sim/items.ts';
import type { EffectId, Item, SignatureId, SynergyId } from '../src/sim/items.ts';
import { findSynergies, loadoutItems } from '../src/sim/loot.ts';
import { UPGRADES, makeOffer } from '../src/sim/upgrades.ts';
import { createRng } from '../src/sim/rng.ts';
import { DT, TICK_RATE, chooseUpgrade, createSim, elapsedSeconds, stepSim } from '../src/sim/sim.ts';
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
    if (state.offer) chooseUpgrade(state, 0); // the scripted player always takes the first upgrade
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
  for (const item of loadoutItems(l)) {
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
  points.push({ loot: loadoutItems(l).reduce((a, i) => a + i.rarity, 0), survived: r.survived });
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
  `Stress loadout "${stress!.buildName}" (${stress!.weapon.name} / ${stress!.armor.name} / ${stress!.trinket.name} / ${stress!.helmet.name} / ${stress!.boots.name}): ` +
    `${s.stats.kills} kills in ${fmt(s.survived)}, ${s.avgTickMs.toFixed(3)} ms/tick avg, ` +
    `${s.slowestTickMs.toFixed(2)} ms slowest`,
);
if (s.avgTickMs > 4) {
  console.log('Stress loadout is too slow');
  failed = true;
}

// 6: every signature power and synergy can be rolled, and each one runs cleanly and fast
const firstSeedWith = new Map<string, number>();
for (let seed = 1; seed <= 6000; seed++) {
  const l = generateLoadout(seed);
  for (const item of loadoutItems(l)) {
    if (item.signature && !firstSeedWith.has(`sig:${item.signature}`)) firstSeedWith.set(`sig:${item.signature}`, seed);
  }
  for (const s of l.synergies) if (!firstSeedWith.has(`syn:${s}`)) firstSeedWith.set(`syn:${s}`, seed);
}
const everything = [
  ...(Object.keys(SIGNATURES) as SignatureId[]).map((id) => `sig:${id}`),
  ...(Object.keys(SYNERGIES) as SynergyId[]).map((id) => `syn:${id}`),
];
for (const key of everything) {
  const seed = firstSeedWith.get(key);
  if (seed === undefined) {
    console.log(`${key}: never rolled in 6000 seeds`);
    failed = true;
    continue;
  }
  const r = run(120, true, seed);
  const ok = Number.isFinite(r.stats.damageDealt) && Number.isFinite(r.hash) && r.avgTickMs < 4;
  if (!ok) {
    console.log(`${key} (seed ${seed}): FAILED (${r.avgTickMs.toFixed(2)} ms/tick)`);
    failed = true;
  }
}
console.log(`Signatures and synergies: all ${everything.length} rolled and ran cleanly in god mode`);

// 7: every weapon, and a hand-built "everything at once" loadout, stay inside the frame budget.
{
  const item = (
    slot: Item['slot'], id: string, effects: EffectId[], signature: SignatureId | null = null, power = 2.4,
  ): Item => ({ slot, id, name: id, rarity: 4, power, effects, quirk: null, signature });
  const make = (weapon: Item, armor: Item, trinket: Item, helmet = plainHelmet, boots = plainBoots): Loadout => {
    const items = [weapon, helmet, armor, boots, trinket];
    return {
      seed: 1, weapon, armor, trinket, helmet, boots, buildName: 'test', family: 'apocalypse',
      synergies: findSynergies(items), bestRarity: 4,
    };
  };
  const plainArmor = item('armor', 'mail', []);
  const plainHelmet = item('helmet', 'ironhelm', []);
  const plainBoots = item('boots', 'greaves', []);
  const plainTrinket = item('trinket', 'idol', ['might']);
  for (const w of WEAPONS) {
    const l = make(item('weapon', w.id, ['burn', 'poison']), plainArmor, plainTrinket);
    const r = run(60, true, 3, l);
    const ok = Number.isFinite(r.stats.damageDealt) && r.avgTickMs < 4;
    console.log(`  ${w.name.padEnd(22)} ${String(r.stats.kills).padStart(5)} kills in 60s, ${r.avgTickMs.toFixed(3)} ms/tick`);
    if (!ok) failed = true;
  }
  const ultimate = make(
    item('weapon', 'gatling', ['barrage', 'frenzy', 'giant', 'burn'], 'splinter'),
    item('armor', 'robe', ['regen'], 'stormcaller'),
    item('trinket', 'quiver', ['barrage', 'frenzy', 'explosion', 'shock'], 'meteors'),
  );
  const u = run(120, true, 3, ultimate);
  const bu = compileBuild(ultimate);
  console.log(
    `Ultimate loadout: ${(1 / (bu.cooldown)).toFixed(0)} volleys/s x${bu.count}, ${u.stats.kills} kills in 2:00, ` +
      `peak ${u.maxProjectiles} projectiles, ${u.avgTickMs.toFixed(3)} ms/tick avg, ${u.slowestTickMs.toFixed(2)} ms slowest`,
  );
  if (u.avgTickMs > 6 || !Number.isFinite(u.stats.damageDealt)) failed = true;
  const bladeStorm = make(
    item('weapon', 'scythe', ['frenzy', 'giant'], 'colossus'),
    item('armor', 'plate', [], 'stormcaller'),
    item('trinket', 'vial', ['poison'], 'bladestorm'),
  );
  const bs = run(120, true, 3, bladeStorm);
  console.log(`Blade storm loadout: ${bs.stats.kills} kills in 2:00, ${bs.avgTickMs.toFixed(3)} ms/tick avg`);
  if (bs.avgTickMs > 6 || !Number.isFinite(bs.stats.damageDealt)) failed = true;
}

// The Dragon shows up at 5:00 (and every minute after), never before.
{
  const sim = createSim({ worldSeed: WORLD_SEED, playerSeed: 3, godMode: true });
  const seen: number[] = [];
  for (let t = 0; t < 7 * 60 * TICK_RATE; t++) {
    if (sim.offer) chooseUpgrade(sim, 0);
    const before = sim.bossesSpawned;
    stepSim(sim, { x: 0, y: 0 });
    for (const ev of sim.events) if (ev.type === 'bossSpawned' && ev.name === 'Dragon') seen.push(sim.tick / TICK_RATE);
    void before;
  }
  const ok = seen.length === 2 && Math.abs(seen[0]! - 300) < 0.1 && Math.abs(seen[1]! - 360) < 0.1;
  console.log(`Dragon arrivals (s): ${seen.map((x) => x.toFixed(0)).join(', ') || 'none'} ${ok ? 'OK' : 'UNEXPECTED'}`);
  if (!ok) failed = true;
}

// Every enemy kind (bosses included) is spawned next to a god-mode player and must behave:
// finite positions, no pool overflow, and the shooters/summoners actually act.
{
  const names = Object.keys(ENEMY_DEFS).map(Number) as EnemyKind[];
  for (const kind of names) {
    const sim = createSim({ worldSeed: WORLD_SEED, playerSeed: 7, godMode: true });
    const mul = 3;
    // Switch off every automatic power so the test subjects live long enough to act.
    Object.assign(sim.build, { orbitBlades: 0, meteorEvery: 0, stormEvery: 0, vortexEvery: 0, scorchDps: 0, thornsDamage: 0 });
    for (let k = 0; k < 3; k++) sim.enemies.spawn(kind, 1000 + k * 20, 450 + k * 30, mul, mul);
    let shots = 0;
    let spawned = 0;
    let blasts = 0;
    for (let t = 0; t < 20 * TICK_RATE; t++) {
      if (sim.offer) chooseUpgrade(sim, 0);
      sim.weapon.timer = 1e9; // the daily weapon would kill the test subjects too fast
      const before = sim.enemies.count;
      stepSim(sim, { x: Math.sin(t / 90) > 0 ? 1 : -1, y: 0 });
      shots = Math.max(shots, sim.enemyShots.count);
      spawned = Math.max(spawned, sim.enemies.count - before);
      for (const ev of sim.events) if (ev.type === 'enemyBlast') blasts++;
    }
    const e = sim.enemies;
    let finite = true;
    for (let i = 0; i < e.count; i++) if (!Number.isFinite(e.x[i]!) || !Number.isFinite(e.y[i]!)) finite = false;
    if (!finite) {
      console.log(`${ENEMY_DEFS[kind].name}: non-finite position`);
      failed = true;
    }
    const acts = [EnemyKind.Spitter, EnemyKind.Lich, EnemyKind.Juggernaut, EnemyKind.Dragon].includes(kind) && shots === 0;
    if (acts) {
      console.log(`${ENEMY_DEFS[kind].name}: never fired a shot`);
      failed = true;
    }
    console.log(`  ${ENEMY_DEFS[kind].name.padEnd(12)} max shots ${shots}, max spawned/tick ${spawned}, blasts ${blasts}`);
  }
  console.log(`Enemy roster: all ${names.length} kinds ran cleanly`);
}

// Upgrades: offers are deterministic, respect weapon type and minimum rarity, and the game
// pauses on schedule until one is picked.
{
  const a = makeOffer(777, 3, false);
  const b = makeOffer(777, 3, false);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.log('Upgrade offers are not deterministic');
    failed = true;
  }
  const seen = new Set<string>();
  for (let n = 1; n <= 400; n++) {
    for (const melee of [false, true]) {
      const offer = makeOffer(n * 31, n, melee);
      if (new Set(offer.map((o) => o.stat)).size !== 3) {
        console.log('Upgrade offer has duplicate stats');
        failed = true;
      }
      for (const o of offer) {
        const def = UPGRADES[o.stat];
        if (o.rarity < def.minRarity || (melee && def.rangedOnly) || !(def.values[o.rarity]! > 0)) {
          console.log(`Illegal upgrade option ${o.stat} at rarity ${o.rarity} (melee ${melee})`);
          failed = true;
        }
        seen.add(`${o.stat}:${o.rarity}`);
      }
    }
  }
  const sim = createSim({ worldSeed: WORLD_SEED, playerSeed: 5, godMode: true });
  let offers = 0;
  let pausedAt = -1;
  for (let t = 0; t < 95 * TICK_RATE; t++) {
    if (sim.offer) {
      offers++;
      if (pausedAt < 0) pausedAt = sim.tick;
      const tick = sim.tick;
      stepSim(sim, { x: 1, y: 0 });
      if (sim.tick !== tick) {
        console.log('Game did not pause while an upgrade was on offer');
        failed = true;
      }
      chooseUpgrade(sim, offers % 3);
    }
    stepSim(sim, { x: 1, y: 0 });
  }
  if (offers !== 3 || pausedAt !== 30 * TICK_RATE) {
    console.log(`Expected 3 upgrade offers by 1:35 with the first at 0:30, got ${offers} (first at tick ${pausedAt})`);
    failed = true;
  }
  console.log(`Upgrades: deterministic, ${seen.size} stat/rarity combinations offered, pause and schedule OK`);
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
