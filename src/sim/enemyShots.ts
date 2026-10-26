/** Hostile projectiles (spitters, the Lich, ...). Struct-of-arrays like the other pools. */
export const MAX_ENEMY_SHOTS = 500;
export const ENEMY_SHOT_RADIUS = 6;

export class EnemyShotPool {
  count = 0;
  readonly x = new Float64Array(MAX_ENEMY_SHOTS);
  readonly y = new Float64Array(MAX_ENEMY_SHOTS);
  readonly prevX = new Float64Array(MAX_ENEMY_SHOTS);
  readonly prevY = new Float64Array(MAX_ENEMY_SHOTS);
  readonly vx = new Float64Array(MAX_ENEMY_SHOTS);
  readonly vy = new Float64Array(MAX_ENEMY_SHOTS);
  readonly damage = new Float64Array(MAX_ENEMY_SHOTS);
  readonly life = new Float64Array(MAX_ENEMY_SHOTS);
  readonly dead = new Uint8Array(MAX_ENEMY_SHOTS);

  spawn(x: number, y: number, vx: number, vy: number, damage: number, life: number): void {
    if (this.count >= MAX_ENEMY_SHOTS) return;
    const i = this.count++;
    this.x[i] = this.prevX[i] = x;
    this.y[i] = this.prevY[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.damage[i] = damage;
    this.life[i] = life;
    this.dead[i] = 0;
  }

  compact(): void {
    let w = 0;
    for (let r = 0; r < this.count; r++) {
      if (this.dead[r]) continue;
      if (w !== r) {
        this.x[w] = this.x[r]!;
        this.y[w] = this.y[r]!;
        this.prevX[w] = this.prevX[r]!;
        this.prevY[w] = this.prevY[r]!;
        this.vx[w] = this.vx[r]!;
        this.vy[w] = this.vy[r]!;
        this.damage[w] = this.damage[r]!;
        this.life[w] = this.life[r]!;
        this.dead[w] = 0;
      }
      w++;
    }
    this.count = w;
  }
}
