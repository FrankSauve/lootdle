import type { EnemyKind, EnemyPool } from './enemies.ts';
import type { SpatialGrid } from './grid.ts';
import type { ProjectilePool } from './projectiles.ts';
import type { Rng } from './rng.ts';

/** Movement intent for one tick; each axis in the range -1..1. */
export interface MoveInput {
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  radius: number;
  speed: number; // units per second
  hp: number;
  maxHp: number;
  /** Seconds of invulnerability left after taking a hit. */
  invulnerable: number;
}

export interface WeaponState {
  name: string;
  /** Seconds between volleys. */
  cooldown: number;
  /** Seconds until the next volley. */
  timer: number;
  projectilesPerVolley: number;
  damage: number;
  projectileSpeed: number;
  projectileRadius: number;
  projectileLife: number;
  pierce: number;
  /** Only targets enemies within this distance. */
  range: number;
}

export interface RunStats {
  kills: number;
  bossesDefeated: number;
  damageDealt: number;
  damageTaken: number;
}

/**
 * Things that happened during a tick. The renderer turns these into effects;
 * later they will also feed the post-run timeline.
 */
export type SimEvent =
  | { type: 'kill'; x: number; y: number; kind: EnemyKind }
  | { type: 'playerHit'; damage: number }
  | { type: 'bossSpawned'; number: number; name: string }
  | { type: 'bossDefeated'; x: number; y: number; name: string }
  | { type: 'doom' }
  | { type: 'playerDied' };

export interface SimState {
  tick: number;
  over: boolean;
  doom: boolean;
  /** Debug/testing only: the player can't take damage. */
  godMode: boolean;

  /** Shared daily stream: spawns and the enemy schedule (same for every player). */
  worldRng: Rng;
  /** Per-player stream: loot and upgrades (used once those systems exist). */
  playerRng: Rng;

  player: PlayerState;
  weapon: WeaponState;
  enemies: EnemyPool;
  projectiles: ProjectilePool;
  grid: SpatialGrid;
  /** Scratch buffer for grid queries. */
  nearby: Int32Array;

  /** Fractional enemies owed by the spawn director. */
  spawnBudget: number;
  bossesSpawned: number;

  stats: RunStats;
  /** Events produced by the most recent tick; cleared at the start of every tick. */
  events: SimEvent[];
}
