import { Container, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';

/** Hard cap on live particles so huge chain reactions can't tank the frame rate. */
const MAX_PARTICLES = 1500;

/**
 * Purely visual particles (death bursts etc.). Not part of the simulation, so they can use
 * Math.random and real frame time. Sprites are pooled and reused.
 */
export class Particles {
  readonly container = new Container();
  private readonly texture: Texture;
  private readonly textureRadius: number;
  private readonly sprites: Sprite[] = [];
  private readonly vx: number[] = [];
  private readonly vy: number[] = [];
  private readonly life: number[] = [];
  private readonly maxLife: number[] = [];
  private readonly size: number[] = [];
  private live = 0;

  constructor(texture: Texture, textureRadius: number) {
    this.texture = texture;
    this.textureRadius = textureRadius;
  }

  burst(x: number, y: number, color: number, count: number, speed: number): void {
    for (let n = 0; n < count; n++) {
      if (this.live >= MAX_PARTICLES) return;
      const i = this.live++;
      let s = this.sprites[i];
      if (!s) {
        s = new Sprite(this.texture);
        s.anchor.set(0.5);
        this.sprites.push(s);
        this.container.addChild(s);
      }
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.vx[i] = Math.cos(angle) * v;
      this.vy[i] = Math.sin(angle) * v;
      this.maxLife[i] = this.life[i] = 0.25 + Math.random() * 0.35;
      this.size[i] = 2 + Math.random() * 3;
      s.position.set(x, y);
      s.tint = color;
      s.visible = true;
    }
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.live) {
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) {
        this.removeAt(i);
        continue;
      }
      const s = this.sprites[i]!;
      const t = this.life[i]! / this.maxLife[i]!;
      s.x += this.vx[i]! * dt;
      s.y += this.vy[i]! * dt;
      this.vx[i]! *= 0.9;
      this.vy[i]! *= 0.9;
      s.alpha = t;
      s.scale.set((this.size[i]! * (0.5 + 0.5 * t)) / this.textureRadius);
      i++;
    }
  }

  clear(): void {
    for (let i = 0; i < this.live; i++) this.sprites[i]!.visible = false;
    this.live = 0;
  }

  /** Swap-removes particle i with the last live particle (order doesn't matter for visuals). */
  private removeAt(i: number): void {
    const last = --this.live;
    const s = this.sprites[i]!;
    const sl = this.sprites[last]!;
    if (i !== last) {
      this.sprites[i] = sl;
      this.sprites[last] = s;
      this.vx[i] = this.vx[last]!;
      this.vy[i] = this.vy[last]!;
      this.life[i] = this.life[last]!;
      this.maxLife[i] = this.maxLife[last]!;
      this.size[i] = this.size[last]!;
    }
    s.visible = false;
  }
}
