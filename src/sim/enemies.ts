import { MAX_ENEMIES } from './config.ts';

export const EnemyKind = {
  Chaser: 0,
  Flanker: 1,
  Brute: 2,
  Slimelet: 3,
  GiantSlime: 4,
} as const;
export type EnemyKind = (typeof EnemyKind)[keyof typeof EnemyKind];

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number; // units per second
  radius: number;
  damage: number; // contact damage per hit
  boss: boolean;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  [EnemyKind.Chaser]: { name: 'Chaser', hp: 18, speed: 85, radius: 12, damage: 8, boss: false },
  [EnemyKind.Flanker]: { name: 'Flanker', hp: 10, speed: 150, radius: 10, damage: 6, boss: false },
  [EnemyKind.Brute]: { name: 'Brute', hp: 110, speed: 55, radius: 22, damage: 16, boss: false },
  [EnemyKind.Slimelet]: { name: 'Slimelet', hp: 40, speed: 95, radius: 14, damage: 8, boss: false },
  [EnemyKind.GiantSlime]: { name: 'Giant Slime', hp: 450, speed: 60, radius: 48, damage: 25, boss: true },
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
      }
      w++;
    }
    this.count = w;
  }
}
