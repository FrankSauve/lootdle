import { MAX_PROJECTILES } from './config.ts';

/** Struct-of-arrays player projectile storage, packed in [0, count) like EnemyPool. */
export class ProjectilePool {
  readonly capacity: number;
  count = 0;

  readonly dead: Uint8Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly prevX: Float64Array;
  readonly prevY: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly damage: Float64Array;
  readonly radius: Float64Array;
  /** Seconds left before the projectile expires. */
  readonly life: Float64Array;
  /** Extra enemies this projectile may pass through after its first hit. */
  readonly pierce: Int32Array;
  /** Id of the last enemy hit, so a piercing projectile doesn't hit the same enemy every tick. */
  readonly lastHitId: Uint32Array;
  /** The hit before that, so a piercing projectile overlapping two enemies doesn't ping-pong. */
  readonly lastHitId2: Uint32Array;
  /** How many times a ricocheting projectile has bounced. */
  readonly bounces: Uint8Array;

  constructor(capacity = MAX_PROJECTILES) {
    this.capacity = capacity;
    this.dead = new Uint8Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.prevX = new Float64Array(capacity);
    this.prevY = new Float64Array(capacity);
    this.vx = new Float64Array(capacity);
    this.vy = new Float64Array(capacity);
    this.damage = new Float64Array(capacity);
    this.radius = new Float64Array(capacity);
    this.life = new Float64Array(capacity);
    this.pierce = new Int32Array(capacity);
    this.lastHitId = new Uint32Array(capacity);
    this.lastHitId2 = new Uint32Array(capacity);
    this.bounces = new Uint8Array(capacity);
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    radius: number,
    life: number,
    pierce: number,
  ): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.dead[i] = 0;
    this.x[i] = this.prevX[i] = x;
    this.y[i] = this.prevY[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.damage[i] = damage;
    this.radius[i] = radius;
    this.life[i] = life;
    this.pierce[i] = pierce;
    this.lastHitId[i] = 0;
    this.lastHitId2[i] = 0;
    this.bounces[i] = 0;
    return i;
  }

  compact(): void {
    let w = 0;
    for (let r = 0; r < this.count; r++) {
      if (this.dead[r]) continue;
      if (w !== r) {
        this.dead[w] = 0;
        this.x[w] = this.x[r]!;
        this.y[w] = this.y[r]!;
        this.prevX[w] = this.prevX[r]!;
        this.prevY[w] = this.prevY[r]!;
        this.vx[w] = this.vx[r]!;
        this.vy[w] = this.vy[r]!;
        this.damage[w] = this.damage[r]!;
        this.radius[w] = this.radius[r]!;
        this.life[w] = this.life[r]!;
        this.pierce[w] = this.pierce[r]!;
        this.lastHitId[w] = this.lastHitId[r]!;
        this.lastHitId2[w] = this.lastHitId2[r]!;
        this.bounces[w] = this.bounces[r]!;
      }
      w++;
    }
    this.count = w;
  }
}
