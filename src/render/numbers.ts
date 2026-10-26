import { Container, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';

const MAX_POPUPS = 48;
const LIFE = 0.55;
const RISE = 46;
const DIGIT_ADVANCE = 4;

interface Popup {
  x: number;
  y: number;
  life: number;
  sprites: Sprite[];
}

/**
 * Floating damage numbers drawn with a pixel font. Pooled: at most MAX_POPUPS are alive, and the
 * oldest is recycled when more arrive. Purely visual.
 */
export class NumberPopups {
  readonly container = new Container();
  private readonly digits: readonly Texture[];
  private readonly pixelSize: number;
  private readonly popups: Popup[] = [];
  private readonly spare: Sprite[] = [];

  constructor(digits: readonly Texture[], pixelSize: number) {
    this.digits = digits;
    this.pixelSize = pixelSize;
  }

  spawn(x: number, y: number, amount: number, color: number): void {
    if (this.popups.length >= MAX_POPUPS) this.release(this.popups.shift()!);
    const text = String(Math.min(9999, Math.max(1, Math.round(amount))));
    const sprites: Sprite[] = [];
    for (let i = 0; i < text.length; i++) {
      const s = this.spare.pop() ?? this.makeSprite();
      s.texture = this.digits[text.charCodeAt(i) - 48]!;
      s.tint = color;
      s.alpha = 1;
      s.visible = true;
      sprites.push(s);
    }
    const popup: Popup = { x, y, life: LIFE, sprites };
    this.layout(popup, 0);
    this.popups.push(popup);
  }

  update(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p);
        this.popups.splice(i, 1);
        continue;
      }
      this.layout(p, LIFE - p.life);
      // Blink out at the end instead of fading, to stay pixel-crisp.
      const visible = p.life > 0.15 || Math.floor(p.life * 40) % 2 === 0;
      for (const s of p.sprites) s.visible = visible;
    }
  }

  clear(): void {
    for (const p of this.popups) this.release(p);
    this.popups.length = 0;
  }

  private layout(p: Popup, age: number): void {
    const step = DIGIT_ADVANCE * this.pixelSize;
    const y = Math.round((p.y - 14 - RISE * age) / this.pixelSize) * this.pixelSize;
    const left = p.x - ((p.sprites.length - 1) * step) / 2;
    p.sprites.forEach((s, i) => s.position.set(Math.round((left + i * step) / this.pixelSize) * this.pixelSize, y));
  }

  private release(p: Popup): void {
    for (const s of p.sprites) {
      s.visible = false;
      this.spare.push(s);
    }
  }

  private makeSprite(): Sprite {
    const s = new Sprite(this.digits[0]!);
    s.anchor.set(0.5);
    s.scale.set(this.pixelSize);
    this.container.addChild(s);
    return s;
  }
}
