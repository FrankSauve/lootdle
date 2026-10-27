/**
 * Pure, fixed-step game simulation. No rendering, DOM, timers or Math.random() here.
 *
 * Determinism rules (needed for replays and server-side validation):
 * - Advance only through stepSim(), exactly once per fixed tick.
 * - Use +, -, *, / and Math.sqrt freely; they are exact IEEE operations in every browser.
 * - Avoid Math.sin/cos/atan2/exp/pow/hypot: their results can differ between JS engines.
 *   Add deterministic helpers (lookup tables or fixed-point) when they are needed.
 * - All randomness comes from state.worldRng (shared daily schedule) or state.playerRng (loot).
 */
import {
  updateFlashes,
  updateEnemyShots,
  separateEnemies,
  updatePlayerContact,
  updateProjectiles,
} from './combat.ts';
import { ARENA_HEIGHT, ARENA_WIDTH, DT, GRID_CELL_SIZE, MAX_ENEMIES, TICK_RATE } from './config.ts';
import { compileBuild } from './build.ts';
import { updateDirector } from './director.ts';
import { tickAuras, tickBuild, tickStatuses } from './effects.ts';
import { updateEnemyAbilities, moveEnemies } from './enemyAI.ts';
import { EnemyPool } from './enemies.ts';
import { EnemyShotPool } from './enemyShots.ts';
import { SpatialGrid } from './grid.ts';
import { generateLoadout } from './loot.ts';
import type { Loadout } from './loot.ts';
import { ProjectilePool } from './projectiles.ts';
import { createRng, hashSeed } from './rng.ts';
import { UPGRADE_INTERVAL_SECONDS, emptyTotals, openUpgradeOffer } from './upgrades.ts';
import type { MoveInput, SimState } from './state.ts';
import { createWeapon, updateWeapon } from './weapons.ts';

export * from './config.ts';
export type { MoveInput, SimEvent, SimState } from './state.ts';
export type { Loadout } from './loot.ts';
export { generateLoadout } from './loot.ts';
export { chooseUpgrade, openUpgradeOffer } from './upgrades.ts';

export interface SimOptions {
  /** Seed for the shared daily schedule (derived from the date). */
  worldSeed: number;
  /** Seed for this player's loot and upgrades. */
  playerSeed: number;
  /** Override the rolled loadout (tests); by default it is rolled from `playerSeed`. */
  loadout?: Loadout;
  godMode?: boolean;
}

export function createSim(options: SimOptions): SimState {
  const loadout = options.loadout ?? generateLoadout(options.playerSeed);
  const build = compileBuild(loadout);
  return {
    tick: 0,
    over: false,
    doom: false,
    godMode: options.godMode ?? false,
    worldRng: createRng(options.worldSeed),
    playerRng: createRng(options.playerSeed),
    critRng: createRng(hashSeed(`crit:${options.playerSeed}`)),
    lifestealShown: 0,
    seed: options.playerSeed,
    upgrades: emptyTotals(),
    offer: null,
    offerCount: 0,
    picked: [],
    loadout,
    build,
    player: {
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
      prevX: ARENA_WIDTH / 2,
      prevY: ARENA_HEIGHT / 2,
      radius: 14,
      speed: build.moveSpeed,
      hp: build.maxHp,
      maxHp: build.maxHp,
      invulnerable: 0,
    },
    weapon: createWeapon(build, loadout.weapon.name),
    enemies: new EnemyPool(),
    projectiles: new ProjectilePool(),
    enemyShots: new EnemyShotPool(),
    grid: new SpatialGrid(ARENA_WIDTH, ARENA_HEIGHT, GRID_CELL_SIZE, MAX_ENEMIES),
    nearby: new Int32Array(MAX_ENEMIES),
    shots: 0,
    killsSinceHeal: 0,
    volleys: 0,
    phoenixUsed: false,
    vortexTimer: build.vortexEvery,
    orbitX: 1,
    orbitY: 0,
    orbitPos: new Float64Array(10),
    zapsThisTick: 0,
    barrierTimer: 0,
    explosionsThisTick: 0,
    effectDepth: 0,
    blastBufs: [0, 1, 2].map(() => new Int32Array(MAX_ENEMIES)),
    zapBuf: new Int32Array(MAX_ENEMIES),
    spawnBudget: 0,
    bossesSpawned: 0,
    stats: { kills: 0, bossesDefeated: 0, damageDealt: 0, damageTaken: 0 },
    events: [],
  };
}

/** Seconds survived so far. */
export function elapsedSeconds(state: SimState): number {
  return state.tick * DT;
}

const UPGRADE_INTERVAL_TICKS = UPGRADE_INTERVAL_SECONDS * TICK_RATE;

export function stepSim(state: SimState, input: MoveInput): void {
  if (state.over) return;
  // Paused while the player is choosing an upgrade.
  if (state.offer) {
    state.events.length = 0;
    return;
  }
  state.events.length = 0;
  state.explosionsThisTick = 0;
  state.zapsThisTick = 0;
  state.effectDepth = 0;

  savePreviousPositions(state);
  movePlayer(state, input);
  tickBuild(state);

  updateDirector(state);
  moveEnemies(state);

  const e = state.enemies;
  state.grid.build(e.x, e.y, e.count);
  separateEnemies(state);
  updateEnemyAbilities(state);

  updateWeapon(state);
  tickAuras(state);
  updateProjectiles(state);
  tickStatuses(state);
  updatePlayerContact(state);
  updateEnemyShots(state);
  updateFlashes(state);

  e.compact();
  state.projectiles.compact();
  state.enemyShots.compact();

  state.tick++;
  if (state.tick % UPGRADE_INTERVAL_TICKS === 0 && state.player.hp > 0) openUpgradeOffer(state);

  if (state.player.hp <= 0) {
    state.over = true;
    state.events.push({ type: 'playerDied' });
  }
}

function savePreviousPositions(state: SimState): void {
  const p = state.player;
  p.prevX = p.x;
  p.prevY = p.y;

  const e = state.enemies;
  e.prevX.set(e.x.subarray(0, e.count));
  e.prevY.set(e.y.subarray(0, e.count));

  const pr = state.projectiles;
  pr.prevX.set(pr.x.subarray(0, pr.count));
  pr.prevY.set(pr.y.subarray(0, pr.count));
  const es = state.enemyShots;
  es.prevX.set(es.x.subarray(0, es.count));
  es.prevY.set(es.y.subarray(0, es.count));
}

function movePlayer(state: SimState, input: MoveInput): void {
  const p = state.player;
  let dx = input.x;
  let dy = input.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  p.x = clamp(p.x + dx * p.speed * DT, p.radius, ARENA_WIDTH - p.radius);
  p.y = clamp(p.y + dy * p.speed * DT, p.radius, ARENA_HEIGHT - p.radius);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
