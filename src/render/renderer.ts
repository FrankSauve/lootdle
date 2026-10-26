import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { ENEMY_DEFS, EnemyKind } from '../sim/enemies.ts';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../sim/sim.ts';
import type { SimEvent, SimState } from '../sim/sim.ts';
import { Particles } from './particles.ts';

/** Radius of the shared circle texture; sprites are scaled from it. */
const CIRCLE_RADIUS = 32;

const ENEMY_COLORS: Record<EnemyKind, number> = {
  [EnemyKind.Chaser]: 0xe5534b,
  [EnemyKind.Flanker]: 0xb15ee8,
  [EnemyKind.Brute]: 0xd9822b,
  [EnemyKind.Slimelet]: 0x7be37b,
  [EnemyKind.GiantSlime]: 0x3fbf5a,
};
const PLAYER_COLOR = 0xffc94a;
const KNIFE_COLOR = 0xdfe8ff;
const ARENA_COLOR = 0x1d1728;
const DOOM_ARENA_TINT = 0xff9a9a;

/**
 * Draws the simulation. It only reads SimState (positions are interpolated between the last two
 * ticks) and turns SimEvents into visual effects; it never changes the simulation.
 * Effects here may use Math.random freely because they don't affect gameplay.
 */
export class GameRenderer {
  private readonly app: Application;
  private readonly world = new Container();
  private readonly arena: Graphics;
  private readonly enemyLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly overlay = new Graphics();
  private readonly player: Sprite;
  private readonly circleTexture: Texture;
  private readonly knifeTexture: Texture;
  private readonly particles: Particles;

  private readonly enemySprites: Sprite[] = [];
  private readonly projectileSprites: Sprite[] = [];

  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private fittedWidth = 0;
  private fittedHeight = 0;
  private shake = 0;

  constructor(app: Application) {
    this.app = app;
    this.circleTexture = app.renderer.generateTexture(
      new Graphics().circle(0, 0, CIRCLE_RADIUS).fill(0xffffff),
    );
    this.knifeTexture = app.renderer.generateTexture(
      new Graphics().roundRect(0, 0, 18, 5, 2).fill(0xffffff),
    );

    this.arena = new Graphics()
      .rect(0, 0, ARENA_WIDTH, ARENA_HEIGHT)
      .fill(ARENA_COLOR)
      .stroke({ width: 4, color: 0x3a2f52 });

    this.player = this.makeSprite(this.circleTexture, PLAYER_COLOR);
    this.particles = new Particles(this.circleTexture, CIRCLE_RADIUS);

    this.world.addChild(
      this.arena,
      this.particles.container,
      this.enemyLayer,
      this.projectileLayer,
      this.player,
      this.overlay,
    );
    app.stage.addChild(this.world);
  }

  /** Clears per-run visuals before a new run starts. */
  reset(): void {
    this.arena.tint = 0xffffff;
    this.particles.clear();
    this.shake = 0;
  }

  /** Turns simulation events into effects. Call once per simulated tick with that tick's events. */
  handleEvents(events: readonly SimEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'kill': {
          const def = ENEMY_DEFS[ev.kind];
          this.particles.burst(ev.x, ev.y, ENEMY_COLORS[ev.kind], def.boss ? 40 : 7, def.boss ? 260 : 140);
          break;
        }
        case 'bossDefeated':
          this.shake = Math.max(this.shake, 12);
          break;
        case 'playerHit':
          this.shake = Math.max(this.shake, 7);
          break;
        case 'doom':
          this.arena.tint = DOOM_ARENA_TINT;
          this.shake = Math.max(this.shake, 16);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Draws the current state. `alpha` (0..1) is how far we are between the previous tick and the
   * current one; `frameSeconds` is real time since the last frame (for effects only).
   */
  render(state: SimState, alpha: number, frameSeconds: number): void {
    this.fitToScreen();
    this.updateShake(frameSeconds);

    // Player (blinks while invulnerable).
    const p = state.player;
    this.player.position.set(lerp(p.prevX, p.x, alpha), lerp(p.prevY, p.y, alpha));
    this.player.scale.set(p.radius / CIRCLE_RADIUS);
    this.player.alpha = p.invulnerable > 0 && Math.floor(p.invulnerable * 20) % 2 === 0 ? 0.35 : 1;

    // Enemies.
    const e = state.enemies;
    this.ensureSprites(this.enemySprites, this.enemyLayer, e.count, this.circleTexture);
    for (let i = 0; i < this.enemySprites.length; i++) {
      const s = this.enemySprites[i]!;
      if (i >= e.count) {
        s.visible = false;
        continue;
      }
      s.visible = true;
      s.position.set(lerp(e.prevX[i]!, e.x[i]!, alpha), lerp(e.prevY[i]!, e.y[i]!, alpha));
      s.scale.set(e.radius[i]! / CIRCLE_RADIUS);
      s.tint = e.flash[i]! > 0 ? 0xffffff : ENEMY_COLORS[e.kind[i]! as EnemyKind];
    }

    // Projectiles, rotated along their velocity.
    const pr = state.projectiles;
    this.ensureSprites(this.projectileSprites, this.projectileLayer, pr.count, this.knifeTexture, KNIFE_COLOR);
    for (let i = 0; i < this.projectileSprites.length; i++) {
      const s = this.projectileSprites[i]!;
      if (i >= pr.count) {
        s.visible = false;
        continue;
      }
      s.visible = true;
      s.position.set(lerp(pr.prevX[i]!, pr.x[i]!, alpha), lerp(pr.prevY[i]!, pr.y[i]!, alpha));
      s.rotation = Math.atan2(pr.vy[i]!, pr.vx[i]!);
    }

    this.drawBossBars(state, alpha);
    this.particles.update(frameSeconds);
  }

  private drawBossBars(state: SimState, alpha: number): void {
    const g = this.overlay.clear();
    const e = state.enemies;
    for (let i = 0; i < e.count; i++) {
      if (!ENEMY_DEFS[e.kind[i]! as EnemyKind].boss) continue;
      const x = lerp(e.prevX[i]!, e.x[i]!, alpha);
      const y = lerp(e.prevY[i]!, e.y[i]!, alpha);
      const r = e.radius[i]!;
      const w = r * 2;
      const frac = Math.max(0, e.hp[i]! / e.maxHp[i]!);
      g.rect(x - r, y - r - 14, w, 6).fill({ color: 0x000000, alpha: 0.6 });
      g.rect(x - r, y - r - 14, w * frac, 6).fill(0xff4d6d);
    }
  }

  private ensureSprites(
    pool: Sprite[],
    layer: Container,
    needed: number,
    texture: Texture,
    tint = 0xffffff,
  ): void {
    while (pool.length < needed) {
      const s = this.makeSprite(texture, tint);
      pool.push(s);
      layer.addChild(s);
    }
  }

  private makeSprite(texture: Texture, tint: number): Sprite {
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.tint = tint;
    return s;
  }

  /** Scales the arena to fit the window, centered. */
  private fitToScreen(): void {
    const { width, height } = this.app.screen;
    if (width === this.fittedWidth && height === this.fittedHeight) return;
    this.fittedWidth = width;
    this.fittedHeight = height;
    this.scale = Math.min(width / ARENA_WIDTH, height / ARENA_HEIGHT) * 0.95;
    this.offsetX = (width - ARENA_WIDTH * this.scale) / 2;
    this.offsetY = (height - ARENA_HEIGHT * this.scale) / 2;
    this.world.scale.set(this.scale);
  }

  private updateShake(frameSeconds: number): void {
    this.shake = Math.max(0, this.shake - 60 * frameSeconds);
    const sx = this.shake > 0 ? (Math.random() * 2 - 1) * this.shake * this.scale : 0;
    const sy = this.shake > 0 ? (Math.random() * 2 - 1) * this.shake * this.scale : 0;
    this.world.position.set(this.offsetX + sx, this.offsetY + sy);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
