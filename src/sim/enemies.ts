import { MAX_ENEMIES } from './config.ts';

export const EnemyKind = {
  Chaser: 0,
  Flanker: 1,
  Brute: 2,
  Slimelet: 3,
  GiantSlime: 4,
  Rat: 5,
  Boar: 6,
  Spitter: 7,
  Bomber: 8,
  Knight: 9,
  Shaman: 10,
  Juggernaut: 11,
  HiveQueen: 12,
  Lich: 13,
} as const;
export type EnemyKind = (typeof EnemyKind)[keyof typeof EnemyKind];

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number; // units per second
  radius: number;
  damage: number; // contact damage per hit
  boss: boolean;
  /** Direct weapon hits are multiplied by this (1 = none). Explosions, arcs and DOT bypass it. */
  armor: number;
}

const def = (
  name: string,
  hp: number,
  speed: number,
  radius: number,
  damage: number,
  boss = false,
  armor = 1,
): EnemyDef => ({ name, hp, speed, radius, damage, boss, armor });

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  [EnemyKind.Chaser]: def('Chaser', 18, 85, 12, 8),
  [EnemyKind.Flanker]: def('Flanker', 10, 150, 10, 6),
  [EnemyKind.Brute]: def('Brute', 110, 55, 22, 16),
  [EnemyKind.Slimelet]: def('Slimelet', 40, 95, 14, 8),
  [EnemyKind.GiantSlime]: def('Giant Slime', 550, 60, 48, 25, true),
  [EnemyKind.Rat]: def('Rat', 7, 175, 8, 5),
  [EnemyKind.Boar]: def('Boar', 75, 70, 17, 18),
  [EnemyKind.Spitter]: def('Spitter', 26, 70, 11, 6),
  [EnemyKind.Bomber]: def('Bomber', 16, 125, 11, 22),
  [EnemyKind.Knight]: def('Knight', 150, 62, 18, 14, false, 0.55),
  [EnemyKind.Shaman]: def('Shaman', 42, 65, 12, 5),
  [EnemyKind.Juggernaut]: def('Juggernaut', 800, 50, 40, 30, true, 0.7),
  [EnemyKind.HiveQueen]: def('Hive Queen', 650, 45, 34, 22, true),
  [EnemyKind.Lich]: def('Lich', 700, 60, 28, 24, true),
};

/** Largest radius of any enemy; used to pad spatial queries. */
export const MAX_ENEMY_RADIUS = Math.max(...Object.values(ENEMY_DEFS).map((d) => d.radius));

/**
 * Struct-of-arrays enemy storage. Live enemies are packed in [0, count).
 * Killed enemies are flagged `dead` during a tick and removed by compact() at the end of it,
 * which keeps the order stable (and therefore deterministic).
 */
export class EnemyPool {
  readonly capacity: number;
  count = 0;
  nextId = 1;

  readonly id: Uint32Array;
  readonly kind: Uint8Array;
  readonly dead: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly prevX: Float64Array;
  readonly prevY: Float64Array;
  readonly hp: Float64Array;
  readonly maxHp: Float64Array;
  readonly speed: Float64Array;
  readonly radius: Float64Array;
  readonly damage: Float64Array;
  /** Seconds of hit-flash remaining (drives the white flash when an enemy is hit). */
  readonly flash: Float64Array;
  /** Poison / burn damage-over-time: seconds left and damage per second. */
  readonly poisonT: Float64Array;
  readonly poisonDps: Float64Array;
  readonly burnT: Float64Array;
  readonly burnDps: Float64Array;
  /** Behavior state: a countdown, a mode (0 normal, 1 winding up, 2 charging) and a locked direction. */
  readonly timer: Float64Array;
  readonly mode: Uint8Array;
  readonly dirX: Float64Array;
  readonly dirY: Float64Array;

  constructor(capacity = MAX_ENEMIES) {
    this.capacity = capacity;
    this.id = new Uint32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.dead = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.prevX = new Float64Array(capacity);
    this.prevY = new Float64Array(capacity);
    this.hp = new Float64Array(capacity);
    this.maxHp = new Float64Array(capacity);
    this.speed = new Float64Array(capacity);
    this.radius = new Float64Array(capacity);
    this.damage = new Float64Array(capacity);
    this.flash = new Float64Array(capacity);
    this.poisonT = new Float64Array(capacity);
    this.poisonDps = new Float64Array(capacity);
    this.burnT = new Float64Array(capacity);
    this.burnDps = new Float64Array(capacity);
    this.timer = new Float64Array(capacity);
    this.mode = new Uint8Array(capacity);
    this.dirX = new Float64Array(capacity);
    this.dirY = new Float64Array(capacity);
  }

  /** Adds an enemy and returns its index, or -1 when the pool is full. */
  spawn(kind: EnemyKind, x: number, y: number, hpMul: number, damageMul: number): number {
    if (this.count >= this.capacity) return -1;
    const def = ENEMY_DEFS[kind];
    const i = this.count++;
    this.id[i] = this.nextId++;
    this.kind[i] = kind;
    this.dead[i] = 0;
    this.x[i] = this.prevX[i] = x;
    this.y[i] = this.prevY[i] = y;
    this.hp[i] = this.maxHp[i] = def.hp * hpMul;
    this.speed[i] = def.speed;
    this.radius[i] = def.radius;
    this.damage[i] = def.damage * damageMul;
    this.flash[i] = 0;
    this.poisonT[i] = this.poisonDps[i] = this.burnT[i] = this.burnDps[i] = 0;
    // Staggered first action so groups don't all act on the same tick (ids are deterministic).
    this.timer[i] = 1.2 + (this.id[i]! % 7) * 0.35;
    this.mode[i] = 0;
    this.dirX[i] = this.dirY[i] = 0;
    return i;
  }

  /** Removes dead enemies, preserving the order of the survivors. */
  compact(): void {
    let w = 0;
    for (let r = 0; r < this.count; r++) {
      if (this.dead[r]) continue;
      if (w !== r) {
        this.id[w] = this.id[r]!;
        this.kind[w] = this.kind[r]!;
        this.dead[w] = 0;
        this.x[w] = this.x[r]!;
        this.y[w] = this.y[r]!;
        this.prevX[w] = this.prevX[r]!;
        this.prevY[w] = this.prevY[r]!;
        this.hp[w] = this.hp[r]!;
        this.maxHp[w] = this.maxHp[r]!;
        this.speed[w] = this.speed[r]!;
        this.radius[w] = this.radius[r]!;
        this.damage[w] = this.damage[r]!;
        this.flash[w] = this.flash[r]!;
        this.poisonT[w] = this.poisonT[r]!;
        this.poisonDps[w] = this.poisonDps[r]!;
        this.burnT[w] = this.burnT[r]!;
        this.burnDps[w] = this.burnDps[r]!;
        this.timer[w] = this.timer[r]!;
        this.mode[w] = this.mode[r]!;
        this.dirX[w] = this.dirX[r]!;
        this.dirY[w] = this.dirY[r]!;
      }
      w++;
    }
    this.count = w;
  }
}
