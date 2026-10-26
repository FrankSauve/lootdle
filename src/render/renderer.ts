import { Application, Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { ENEMY_DEFS, EnemyKind } from '../sim/enemies.ts';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../sim/sim.ts';
import type { SimEvent, SimState } from '../sim/sim.ts';
import { generateDungeon } from './art/dungeon.ts';
import { digitImages } from './art/digits.ts';
import { arcImage, orbImage } from './art/effects.ts';
import { silhouette } from './art/pixels.ts';
import { buildArtCatalog } from './art/sprites.ts';
import type { SpriteArt } from './art/sprites.ts';
import { NumberPopups } from './numbers.ts';
import { Particles } from './particles.ts';
import { glowTexture, pixelTexture, vignetteTexture } from './textures.ts';

/**
 * The game draws at a low "art" resolution (one art pixel = 2 simulation units) and the canvas is
 * scaled up with nearest-neighbour filtering, so everything is made of crisp, chunky pixels.
 */
const ART_SCALE = 0.5;
/** World units per art pixel. */
const PX = 1 / ART_SCALE;
/** Wall thickness around the arena, in art pixels. */
const WALL = 16;
export const CANVAS_WIDTH = ARENA_WIDTH * ART_SCALE + WALL * 2;
export const CANVAS_HEIGHT = ARENA_HEIGHT * ART_SCALE + WALL * 2;
const DUNGEON_SEED = 0x10071;

interface AnimatedTextures {
  frames: Texture[];
  flash: Texture[];
  shadow: Texture;
  /** Offset from the entity center to its shadow, in world units. */
  shadowOffset: number;
}

const KIND_DEBRIS: Record<EnemyKind, readonly number[]> = {
  [EnemyKind.Chaser]: [0xe5534b, 0x9e2b33, 0xffe14a],
  [EnemyKind.Flanker]: [0xb15ee8, 0x6c2f9e],
  [EnemyKind.Brute]: [0xd9822b, 0x8a8fa3, 0x5c6070],
  [EnemyKind.Slimelet]: [0x6fd36a, 0x9be895, 0x3f8f3b],
  [EnemyKind.GiantSlime]: [0x3fbf5a, 0x6fd36a, 0xffc94a, 0x2a7a3a],
};

/** Projectiles up to this radius are drawn as thrown blades/arrows, bigger ones as orbs. */
const BLADE_MAX_RADIUS = 8;
const ORB_DIAMETER = 18;
const EXPLOSION_COLORS = [0xffc94a, 0xff8a2b, 0xff4d2b, 0xfff6c0];
const HEAL_COLORS = [0x62d96b, 0xb6f5b0, 0xffffff];
const BLOCK_COLORS = [0x4da6ff, 0xb6dcff, 0xffffff];
const POISON_TINT = 0xa8ff9a;
const BURN_TINT = 0xffb070;
const BOTH_TINT = 0xd8d868;

interface Ring {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: number;
  /** Shrinks toward the center instead of expanding (black hole). */
  inward?: boolean;
}

/** Floating-number colors by damage source (weapon, explosion, lightning). */
const HIT_COLORS = [0xffffff, 0xffc94a, 0xfff06a];
const VORTEX_COLORS = [0xb06bff, 0x6a3fc2, 0xe6d0ff];
const REVIVE_COLORS = [0xffc94a, 0xfff6c0, 0xff8a2b];
/** At most this many floating numbers per rendered frame, so crowds stay readable. */
const NUMBERS_PER_FRAME = 8;
interface Bolt {
  x: number;
  y: number;
  toX: number;
  toY: number;
  life: number;
  midX: number;
  midY: number;
}
interface Slash {
  sprite: Sprite;
  life: number;
}

const TORCH_GLOW = 0xff9a3c;
const DOOM_TORCH_GLOW = 0xff3b3b;
const DOOM_TINT = 0xffb0b0;

/**
 * Draws the simulation. It only reads SimState (positions are interpolated between the last two
 * ticks) and turns SimEvents into visual effects; it never changes the simulation.
 * Effects here may use Math.random freely because they don't affect gameplay.
 */
export class GameRenderer {
  private readonly app: Application;
  /** Everything that shakes. */
  private readonly scene = new Container();
  /** Simulation space (arena units), positioned inside the walls. */
  private readonly world = new Container();
  private readonly backdrop: Sprite;
  private readonly shadowLayer = new Container();
  private readonly enemyLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly overlay = new Graphics();
  private readonly player: Sprite;
  private readonly playerShadow: Sprite;
  private readonly particles: Particles;
  private readonly torches: { flame: Sprite; glow: Sprite; phase: number }[] = [];

  private readonly kinds: Record<EnemyKind, AnimatedTextures>;
  private readonly playerArt: AnimatedTextures;
  private readonly torchFrames: Texture[];
  private readonly knifeTexture: Texture;
  private readonly orbTexture: Texture;
  private readonly arcTextures = new Map<number, Texture>();
  private readonly rings: Ring[] = [];
  private readonly bolts: Bolt[] = [];
  private readonly slashes: Slash[] = [];
  private readonly slashLayer = new Container();
  private playerX = 0;
  private playerY = 0;
  private readonly numbers: NumberPopups;
  private numberBudget = NUMBERS_PER_FRAME;
  private readonly bladeSprites: Sprite[] = [];

  private readonly enemySprites: Sprite[] = [];
  private readonly enemyShadows: Sprite[] = [];
  private readonly projectileSprites: Sprite[] = [];

  private time = 0;
  private shake = 0;
  private shakeEnabled = true;
  private facing = 1;
  private doom = false;

  constructor(app: Application) {
    this.app = app;
    const art = buildArtCatalog();

    const animated = (a: SpriteArt): AnimatedTextures => {
      const tallest = Math.max(...a.frames.map((f) => f.height));
      return {
        frames: a.frames.map(pixelTexture),
        flash: a.frames.map((f) => pixelTexture(silhouette(f))),
        shadow: pixelTexture(art.shadows.get(a.shadowWidth)!),
        shadowOffset: (tallest / 2) * PX,
      };
    };
    this.playerArt = animated(art.player);
    this.kinds = {
      [EnemyKind.Chaser]: animated(art.chaser),
      [EnemyKind.Flanker]: animated(art.flanker),
      [EnemyKind.Brute]: animated(art.brute),
      [EnemyKind.Slimelet]: animated(art.slimelet),
      [EnemyKind.GiantSlime]: animated(art.giantSlime),
    };
    this.torchFrames = art.torch.map(pixelTexture);
    this.knifeTexture = pixelTexture(art.knife);
    this.orbTexture = pixelTexture(orbImage(ORB_DIAMETER));

    // Static dungeon backdrop (floor + walls), drawn once.
    const dungeon = generateDungeon(ARENA_WIDTH * ART_SCALE, ARENA_HEIGHT * ART_SCALE, WALL, DUNGEON_SEED);
    this.backdrop = new Sprite(pixelTexture(dungeon.image));
    this.scene.addChild(this.backdrop);

    // Torches with flickering light.
    const glow = glowTexture(96);
    const glowLayer = new Container();
    const torchLayer = new Container();
    for (const t of dungeon.torches) {
      const flame = new Sprite(this.torchFrames[0]!);
      flame.anchor.set(0.5);
      flame.position.set(Math.round(t.x), Math.round(t.y));
      const light = new Sprite(glow);
      light.anchor.set(0.5);
      light.position.set(t.x, t.y + 4);
      light.blendMode = 'add';
      light.tint = TORCH_GLOW;
      glowLayer.addChild(light);
      torchLayer.addChild(flame);
      this.torches.push({ flame, glow: light, phase: Math.random() * 10 });
    }

    this.world.position.set(WALL, WALL);
    this.world.scale.set(ART_SCALE);

    this.playerShadow = this.makeSprite(this.playerArt.shadow);
    this.playerShadow.alpha = 0.35;
    this.shadowLayer.addChild(this.playerShadow);
    this.player = this.makeSprite(this.playerArt.frames[0]!);
    this.particles = new Particles(pixelTexture(art.pixel), PX);
    this.numbers = new NumberPopups(digitImages().map(pixelTexture), PX);

    this.world.addChild(
      this.shadowLayer,
      this.enemyLayer,
      this.player,
      this.projectileLayer,
      this.slashLayer,
      this.particles.container,
      this.numbers.container,
      this.overlay,
    );
    this.scene.addChild(glowLayer, this.world, torchLayer);

    const vignette = new Sprite(vignetteTexture(CANVAS_WIDTH, CANVAS_HEIGHT));
    app.stage.addChild(this.scene, vignette);
  }

  /** Scales the low-resolution canvas up to fit the given area, using whole-number scales when close. */
  fitCanvas(availableCssWidth: number, availableCssHeight: number): void {
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min((availableCssWidth * dpr) / CANVAS_WIDTH, (availableCssHeight * dpr) / CANVAS_HEIGHT);
    const whole = Math.floor(fit);
    const scale = whole >= 1 && whole / fit >= 0.8 ? whole : fit;
    const canvas = this.app.canvas;
    canvas.style.width = `${(CANVAS_WIDTH * scale) / dpr}px`;
    canvas.style.height = `${(CANVAS_HEIGHT * scale) / dpr}px`;
  }

  /** Clears per-run visuals before a new run starts. */
  reset(): void {
    this.setDoom(false);
    this.particles.clear();
    this.numbers.clear();
    this.shake = 0;
    this.rings.length = 0;
    this.bolts.length = 0;
    for (const s of this.slashes) this.slashLayer.removeChild(s.sprite);
    this.slashes.length = 0;
  }

  /** Turns simulation events into effects. Call once per simulated tick with that tick's events. */
  handleEvents(events: readonly SimEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'kill': {
          const boss = ENEMY_DEFS[ev.kind].boss;
          this.particles.burst(ev.x, ev.y, KIND_DEBRIS[ev.kind], boss ? 60 : 8, boss ? 420 : 220);
          break;
        }
        case 'bossDefeated':
          this.shake = Math.max(this.shake, 5);
          break;
        case 'explosion':
          this.particles.burst(ev.x, ev.y, EXPLOSION_COLORS, 6 + Math.round(ev.radius / 10), 240);
          this.rings.push({ x: ev.x, y: ev.y, radius: ev.radius, life: 0.22, maxLife: 0.22, color: 0xffc94a });
          this.shake = Math.max(this.shake, Math.min(5, 1 + ev.radius / 60));
          break;
        case 'hit':
          if (this.numberBudget > 0) {
            this.numberBudget--;
            this.numbers.spawn(ev.x, ev.y, ev.amount, HIT_COLORS[ev.src] ?? 0xffffff);
          }
          break;
        case 'vortex':
          this.particles.burst(this.playerX, this.playerY, VORTEX_COLORS, 40, 360);
          this.rings.push({
            x: this.playerX, y: this.playerY, radius: ev.radius, life: 0.4, maxLife: 0.4, color: 0xb06bff, inward: true,
          });
          this.shake = Math.max(this.shake, 5);
          break;
        case 'revive':
          this.particles.burst(this.playerX, this.playerY, REVIVE_COLORS, 90, 520);
          this.rings.push({ x: this.playerX, y: this.playerY, radius: 260, life: 0.5, maxLife: 0.5, color: 0xffc94a });
          this.shake = Math.max(this.shake, 9);
          break;
        case 'zap':
          this.bolts.push({
            x: ev.x,
            y: ev.y,
            toX: ev.toX,
            toY: ev.toY,
            life: 0.12,
            midX: (ev.x + ev.toX) / 2 + (Math.random() - 0.5) * 30,
            midY: (ev.y + ev.toY) / 2 + (Math.random() - 0.5) * 30,
          });
          break;
        case 'slash':
          this.addSlash(ev.x, ev.y, ev.dx, ev.dy, ev.radius);
          break;
        case 'heal':
          this.particles.burst(this.playerX, this.playerY - 10, HEAL_COLORS, 6, 120);
          break;
        case 'blocked':
          this.particles.burst(this.playerX, this.playerY, BLOCK_COLORS, 14, 220);
          this.rings.push({ x: this.playerX, y: this.playerY, radius: 40, life: 0.25, maxLife: 0.25, color: 0x4da6ff });
          break;
        case 'playerHit':
          this.shake = Math.max(this.shake, 3);
          break;
        case 'doom':
          this.setDoom(true);
          this.shake = Math.max(this.shake, 7);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Draws the current state. `alpha` (0..1) is how far we are between the previous tick and the
   * current one; `frameSeconds` is real time since the last frame (for animation and effects).
   */
  render(state: SimState, alpha: number, frameSeconds: number): void {
    this.time += frameSeconds;
    const t = this.time;
    this.updateShake(frameSeconds);
    this.updateTorches();

    // Player: faces the way it last moved and bobs while walking; blinks while invulnerable.
    const p = state.player;
    const px = lerp(p.prevX, p.x, alpha);
    const py = lerp(p.prevY, p.y, alpha);
    this.playerX = px;
    this.playerY = py;
    const moving = p.x !== p.prevX || p.y !== p.prevY;
    if (p.x > p.prevX) this.facing = 1;
    else if (p.x < p.prevX) this.facing = -1;
    const bob = moving && Math.floor(t * 10) % 2 ? -PX : 0;
    this.player.position.set(px, py + bob);
    this.player.scale.set(PX * this.facing, PX);
    this.player.visible = !(p.invulnerable > 0 && Math.floor(p.invulnerable * 20) % 2 === 0);
    this.playerShadow.position.set(px, py + this.playerArt.shadowOffset);

    // Enemies and their shadows.
    const e = state.enemies;
    this.ensureSprites(this.enemySprites, this.enemyLayer, e.count, this.playerArt.frames[0]!);
    this.ensureSprites(this.enemyShadows, this.shadowLayer, e.count, this.playerArt.shadow, 0.35);
    for (let i = 0; i < this.enemySprites.length; i++) {
      const s = this.enemySprites[i]!;
      const sh = this.enemyShadows[i]!;
      if (i >= e.count) {
        s.visible = sh.visible = false;
        continue;
      }
      const kind = e.kind[i]! as EnemyKind;
      const tex = this.kinds[kind];
      const id = e.id[i]!;
      const x = lerp(e.prevX[i]!, e.x[i]!, alpha);
      const y = lerp(e.prevY[i]!, e.y[i]!, alpha);

      let frame = 0;
      let lift = 0;
      if (kind === EnemyKind.Flanker) frame = Math.floor(t * 8 + id * 0.37) % 2;
      else if (kind === EnemyKind.Slimelet || kind === EnemyKind.GiantSlime) frame = Math.floor(t * 3 + id * 0.29) % 2;
      else lift = Math.floor(t * 6 + id * 0.37) % 2 ? -PX : 0;

      s.visible = sh.visible = true;
      s.texture = (e.flash[i]! > 0 ? tex.flash : tex.frames)[frame]!;
      const poisoned = e.poisonT[i]! > 0;
      const burning = e.burnT[i]! > 0;
      s.tint = poisoned && burning ? BOTH_TINT : poisoned ? POISON_TINT : burning ? BURN_TINT : 0xffffff;
      if ((poisoned || burning) && Math.random() < frameSeconds * 3) {
        this.particles.burst(x, y - 4, burning ? [0xff6a2b, 0xffc94a] : [0x5fd35f, 0xb6f5b0], 1, 50);
      }
      s.position.set(x, y + lift);
      s.scale.set(PX);
      sh.texture = tex.shadow;
      sh.position.set(x, y + tex.shadowOffset);
    }

    // Projectiles, rotated along their velocity.
    const pr = state.projectiles;
    this.ensureSprites(this.projectileSprites, this.projectileLayer, pr.count, this.knifeTexture);
    for (let i = 0; i < this.projectileSprites.length; i++) {
      const s = this.projectileSprites[i]!;
      if (i >= pr.count) {
        s.visible = false;
        continue;
      }
      s.visible = true;
      s.position.set(lerp(pr.prevX[i]!, pr.x[i]!, alpha), lerp(pr.prevY[i]!, pr.y[i]!, alpha));
      const radius = pr.radius[i]!;
      if (radius <= BLADE_MAX_RADIUS) {
        s.texture = this.knifeTexture;
        s.scale.set(PX);
        s.rotation = Math.atan2(pr.vy[i]!, pr.vx[i]!);
      } else {
        s.texture = this.orbTexture;
        s.scale.set((radius * 2) / ORB_DIAMETER);
        s.rotation = 0;
      }
    }

    this.drawBossBars(state, alpha);
    this.drawOrbit(state);
    this.drawEffects(state, frameSeconds);
    this.particles.update(frameSeconds);
    this.numbers.update(frameSeconds);
    this.numberBudget = NUMBERS_PER_FRAME;
  }

  /** Orbiting blades (Whirling Blades), drawn as spinning daggers around the player. */
  private drawOrbit(state: SimState): void {
    const count = state.build.orbitBlades;
    while (this.bladeSprites.length < count) {
      const s = this.makeSprite(this.knifeTexture);
      s.scale.set(PX * 1.5);
      this.bladeSprites.push(s);
      this.projectileLayer.addChild(s);
    }
    for (let i = 0; i < this.bladeSprites.length; i++) {
      const s = this.bladeSprites[i]!;
      s.visible = i < count;
      if (!s.visible) continue;
      const bx = state.orbitPos[i * 2]!;
      const by = state.orbitPos[i * 2 + 1]!;
      s.position.set(bx, by);
      s.rotation = Math.atan2(by - state.player.y, bx - state.player.x) + Math.PI / 2;
    }
  }

  private addSlash(x: number, y: number, dx: number, dy: number, radius: number): void {
    const artRadius = Math.max(4, Math.round((radius / PX) * 1));
    let tex = this.arcTextures.get(artRadius);
    if (!tex) {
      tex = pixelTexture(arcImage(artRadius));
      this.arcTextures.set(artRadius, tex);
    }
    const sprite = this.makeSprite(tex);
    sprite.position.set(x, y);
    sprite.rotation = Math.atan2(dy, dx);
    this.slashLayer.addChild(sprite);
    this.slashes.push({ sprite, life: 0.14 });
  }

  /** Short-lived effects: expanding rings, lightning bolts and melee slashes. */
  private drawEffects(state: SimState, frameSeconds: number): void {
    const g = this.overlay;
    if (state.build.scorchDps > 0) {
      const flicker = 0.5 + 0.5 * Math.sin(this.time * 9);
      g.circle(this.playerX, this.playerY, state.build.scorchRadius).stroke({
        width: PX,
        color: 0xff6a2b,
        alpha: 0.25 + 0.2 * flicker,
      });
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      r.life -= frameSeconds;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      const scale = r.inward ? 1 - 0.8 * t : 0.35 + 0.65 * t;
      g.circle(r.x, r.y, r.radius * scale).stroke({ width: PX * 2, color: r.color });
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!;
      b.life -= frameSeconds;
      if (b.life <= 0) {
        this.bolts.splice(i, 1);
        continue;
      }
      g.moveTo(b.x, b.y).lineTo(b.midX, b.midY).lineTo(b.toX, b.toY).stroke({ width: PX * 2, color: 0xfff6c0 });
      g.moveTo(b.x, b.y).lineTo(b.midX, b.midY).lineTo(b.toX, b.toY).stroke({ width: PX, color: 0xffe14a });
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i]!;
      s.life -= frameSeconds;
      if (s.life <= 0) {
        this.slashLayer.removeChild(s.sprite);
        this.slashes.splice(i, 1);
        continue;
      }
      s.sprite.alpha = s.life > 0.06 ? 1 : 0.5;
    }
  }

  private setDoom(doom: boolean): void {
    this.doom = doom;
    this.backdrop.tint = doom ? DOOM_TINT : 0xffffff;
    for (const torch of this.torches) torch.glow.tint = doom ? DOOM_TORCH_GLOW : TORCH_GLOW;
  }

  private updateTorches(): void {
    for (const torch of this.torches) {
      const k = this.time * 7 + torch.phase;
      torch.flame.texture = this.torchFrames[Math.floor(k) % 2]!;
      const flicker = 0.5 + 0.5 * Math.sin(k * 1.7) * Math.sin(k * 0.6);
      torch.glow.alpha = (this.doom ? 0.4 : 0.28) + flicker * 0.1;
      torch.glow.scale.set(0.95 + flicker * 0.1);
    }
  }

  /** Pixel-style HP bars above bosses. */
  private drawBossBars(state: SimState, alpha: number): void {
    const g = this.overlay.clear();
    const e = state.enemies;
    for (let i = 0; i < e.count; i++) {
      if (!ENEMY_DEFS[e.kind[i]! as EnemyKind].boss) continue;
      const tex = this.kinds[e.kind[i]! as EnemyKind];
      const x = snap(lerp(e.prevX[i]!, e.x[i]!, alpha));
      const y = snap(lerp(e.prevY[i]!, e.y[i]!, alpha));
      const w = snap(e.radius[i]! * 1.6);
      const top = y - tex.shadowOffset - 8 * PX;
      const frac = Math.max(0, e.hp[i]! / e.maxHp[i]!);
      g.rect(x - w / 2 - PX, top - PX, w + 2 * PX, 4 * PX).fill(0x0b0810);
      g.rect(x - w / 2, top, w, 2 * PX).fill(0x5a1a2a);
      g.rect(x - w / 2, top, snap(w * frac), 2 * PX).fill(0xff4d6d);
    }
  }

  private ensureSprites(pool: Sprite[], layer: Container, needed: number, texture: Texture, alpha = 1): void {
    while (pool.length < needed) {
      const s = this.makeSprite(texture);
      s.alpha = alpha;
      s.scale.set(PX);
      pool.push(s);
      layer.addChild(s);
    }
  }

  private makeSprite(texture: Texture): Sprite {
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.scale.set(PX);
    return s;
  }

  /** Turns screen shake on or off (a player setting). */
  setScreenShake(enabled: boolean): void {
    this.shakeEnabled = enabled;
    if (!enabled) this.shake = 0;
  }

  private updateShake(frameSeconds: number): void {
    if (!this.shakeEnabled) {
      this.scene.position.set(0, 0);
      return;
    }
    this.shake = Math.max(0, this.shake - 30 * frameSeconds);
    const amount = Math.ceil(this.shake);
    const sx = amount > 0 ? Math.round((Math.random() * 2 - 1) * amount) : 0;
    const sy = amount > 0 ? Math.round((Math.random() * 2 - 1) * amount) : 0;
    this.scene.position.set(sx, sy);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Rounds a world coordinate to a whole art pixel. */
function snap(v: number): number {
  return Math.round(v / PX) * PX;
}
