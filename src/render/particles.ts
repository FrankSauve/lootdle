import { Container, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';

/** Hard cap on live particles so huge chain reactions can't tank the frame rate. */
const MAX_PARTICLES = 1500;

/**
 * Purely visual pixel debris (death bursts etc.). Not part of the simulation, so it can use
 * Math.random and real frame time. Sprites are pooled and reused.
 */
export class Particles {
  readonly container = new Container();
  private readonly texture: Texture;
  /** World units per art pixel, so particles are whole art pixels in size. */
  private readonly pixelSize: number;
  private readonly sprites: Sprite[] = [];
  private readonly vx: number[] = [];
  private readonly vy: number[] = [];
  private readonly life: number[] = [];
  private live = 0;

  /** @param texture a 1x1 white pixel */
  constructor(texture: Texture, pixelSize: number) {
    this.texture = texture;
    this.pixelSize = pixelSize;
  }

  burst(x: number, y: number, colors: readonly number[], count: number, speed: number): void {
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
      this.vy[i] = Math.sin(angle) * v - speed * 0.3;
      this.life[i] = 0.3 + Math.random() * 0.4;
      s.scale.set(this.pixelSize * (Math.random() < 0.3 ? 2 : 1));
      s.position.set(x, y);
      s.tint = colors[Math.floor(Math.random() * colors.length)]!;
      s.alpha = 1;
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
      s.x += this.vx[i]! * dt;
      s.y += this.vy[i]! * dt;
      this.vx[i]! *= 0.88;
      this.vy[i] = this.vy[i]! * 0.88 + 600 * dt; // a little gravity so debris settles
      // Blink out instead of fading, to stay pixel-crisp.
      if (this.life[i]! < 0.12) s.alpha = Math.floor(this.life[i]! * 50) % 2 ? 1 : 0;
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
    if (i !== last) {
      this.sprites[i] = this.sprites[last]!;
      this.sprites[last] = s;
      this.vx[i] = this.vx[last]!;
      this.vy[i] = this.vy[last]!;
      this.life[i] = this.life[last]!;
    }
    s.visible = false;
  }
}
