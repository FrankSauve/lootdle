import { Application } from 'pixi.js';
import './style.css';
import { createKeyboardInput } from './input/keyboard.ts';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GameRenderer } from './render/renderer.ts';
import { hashSeed } from './sim/rng.ts';
import { damageEnemy } from './sim/combat.ts';
import { damageMultiplier, hpMultiplier } from './sim/director.ts';
import { ENEMY_DEFS } from './sim/enemies.ts';
import type { EnemyKind } from './sim/enemies.ts';
import { ARENA_HEIGHT, ARENA_WIDTH, DT, createSim, generateLoadout, stepSim } from './sim/sim.ts';
import type { Loadout, SimState } from './sim/sim.ts';
import { SettingsStore } from './settings.ts';
import { Hud } from './ui/hud.ts';
import { LootPanel } from './ui/lootPanel.ts';
import { SettingsWindow } from './ui/settingsWindow.ts';
import { UpgradeWindow } from './ui/upgradeWindow.ts';
import { chooseUpgrade, openUpgradeOffer } from './sim/upgrades.ts';

/** Caps catch-up work per frame (matters at high debug game speeds). */
const MAX_STEPS_PER_FRAME = 600;
/** Never simulate more than this much time in one frame (e.g. after a long hitch). */
const MAX_FRAME_SECONDS = 0.25;

/**
 * Who is playing, for loot purposes. A random id is kept in this browser, so you get the same
 * loot all day (a refresh never rerolls it). `?player=name` previews another player's loot.
 * Real accounts replace this later, with the loadout stored server-side.
 */
function getPlayerId(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('player');
  if (fromUrl) return fromUrl;
  try {
    let id = window.localStorage.getItem('lootdle.player');
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16)).join('');
      window.localStorage.setItem('lootdle.player', id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

async function main() {
  const container = document.getElementById('app')!;
  const stage = document.createElement('div');
  stage.className = 'stage';
  container.appendChild(stage);

  // Render at the low pixel-art resolution; CSS scales the canvas up with crisp pixels.
  const app = new Application();
  await app.init({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: '#0b0810',
    antialias: false,
    roundPixels: true,
    resolution: 1,
  });
  // The wrapper is exactly as big as the canvas, so the HP bar can sit on the dungeon floor.
  const playfield = document.createElement('div');
  playfield.className = 'playfield';
  playfield.appendChild(app.canvas);
  stage.appendChild(playfield);

  const input = createKeyboardInput();
  const renderer = new GameRenderer(app);
  const fit = () => renderer.fitCanvas(stage.clientWidth, stage.clientHeight);
  new ResizeObserver(fit).observe(stage);
  fit();

  // The daily world is shared by everyone; the loot is yours alone (same all day).
  const today = new Date().toISOString().slice(0, 10);
  const worldSeed = hashSeed(`lootdle:${today}`);
  const playerSeed = hashSeed(`lootdle:${today}:${getPlayerId()}`);
  const todaysLoadout = generateLoadout(playerSeed);
  // Debug-only overrides (set from the dev debug menu; they stay at their defaults otherwise).
  const debug = { godMode: false, speed: 1, loot: null as Loadout | null };

  let sim: SimState;
  let started = false;
  let resultsShown = false;
  let accumulator = 0;
  let revealUnlockAt = 0;

  /** `spin` plays the slot machine first; used on first load and when the loot is changed on purpose. */
  const newRun = (spin = false) => {
    const loadout = debug.loot ?? todaysLoadout;
    sim = createSim({ worldSeed, playerSeed: debug.loot ? debug.loot.seed : playerSeed, loadout, godMode: debug.godMode });
    started = false;
    resultsShown = false;
    accumulator = 0;
    renderer.reset();
    hud.reset();
    upgradeWindow.hide();
    // With the slot machine the gear icons would spoil the result, so they appear once it has landed.
    if (spin) hud.clearLoadout();
    else hud.setLoadout(loadout);
    revealUnlockAt = performance.now() + lootPanel.show(loadout, today, spin, () => {
      revealUnlockAt = performance.now();
      hud.setLoadout(loadout);
    });
  };

  const settings = new SettingsStore();
  renderer.setScreenShake(settings.get().screenShake);
  settings.onChange((s) => renderer.setScreenShake(s.screenShake));

  const hud = new Hud(container, playfield, () => newRun(), () => settingsWindow.open());
  const lootPanel = new LootPanel(container);
  const upgradeWindow = new UpgradeWindow(container, (i) => chooseUpgrade(sim, i));
  const settingsWindow = new SettingsWindow(container, settings);
  newRun(true);

  // Developer tools: loaded only by the Vite dev server, never included in production builds.
  let debugMenu: { update(now: number): void } | null = null;
  if (import.meta.env.DEV) {
    const { DebugMenu } = await import('./debug/debugMenu.ts');
    debugMenu = new DebugMenu(container, {
      sim: () => sim,
      godMode: () => debug.godMode,
      setGodMode: (on) => {
        debug.godMode = on;
        sim.godMode = on;
      },
      speed: () => debug.speed,
      setSpeed: (x) => {
        debug.speed = x;
      },
      setHp: (hp) => {
        if (!Number.isFinite(hp)) return;
        const p = sim.player;
        const value = Math.max(1, Math.round(hp));
        if (value > p.maxHp) p.maxHp = value;
        p.hp = value;
      },
      rerollLoot: () => {
        debug.loot = generateLoadout((Math.random() * 2 ** 32) >>> 0);
        newRun(true);
      },
      loadPlayerLoot: (name) => {
        debug.loot = generateLoadout(hashSeed(`lootdle:${today}:${name}`));
        newRun(true);
      },
      resetLoot: () => {
        debug.loot = null;
        newRun(true);
      },
      spawn: (kind, count) => {
        const p = sim.player;
        const def = ENEMY_DEFS[kind as EnemyKind];
        if (!def) return;
        const hpMul = hpMultiplier(sim.tick * DT);
        const dmgMul = damageMultiplier(sim.tick * DT);
        // Appear in a ring 300 units from the player, on the roomier side of the arena.
        const dir = p.x < ARENA_WIDTH / 2 ? 1 : -1;
        for (let k = 0; k < count; k++) {
          const x = Math.min(ARENA_WIDTH - 20, Math.max(20, p.x + dir * 300));
          const y = Math.min(ARENA_HEIGHT - 20, Math.max(20, p.y + (k - (count - 1) / 2) * 30));
          sim.enemies.spawn(kind as EnemyKind, x, y, hpMul, dmgMul);
        }
      },
      offerUpgrade: () => openUpgradeOffer(sim),
      killAll: () => {
        const e = sim.enemies;
        for (let i = 0; i < e.count; i++) damageEnemy(sim, i, 1e9);
        e.compact();
      },
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
    if (e.code === 'Escape') settingsWindow.toggle();
    else if (e.code === 'KeyR' && sim.over && !settingsWindow.isOpen) newRun();
  });

  app.ticker.add((ticker) => {
    const frameSeconds = Math.min(ticker.deltaMS / 1000, MAX_FRAME_SECONDS);
    // The game is paused while the settings window is open.
    const paused = settingsWindow.isOpen;
    const move = paused ? { x: 0, y: 0 } : input.read();

    // The run (and the clock) starts on the first movement, once the loot reveal has played.
    if (!started && (move.x !== 0 || move.y !== 0) && performance.now() >= revealUnlockAt) {
      started = true;
      lootPanel.hide();
    }

    if (started && !sim.over && !paused) {
      accumulator += frameSeconds * debug.speed;
      let steps = 0;
      while (accumulator >= DT && !sim.over && steps++ < MAX_STEPS_PER_FRAME) {
        stepSim(sim, input.read());
        accumulator -= DT;
        renderer.handleEvents(sim.events);
        for (const ev of sim.events) {
          if (ev.type === 'bossSpawned') hud.showBanner(`${ev.name} #${ev.number} appears`, 'boss');
          else if (ev.type === 'bossDefeated') hud.showBanner(`${ev.name} defeated!`, 'boss', 1400);
          else if (ev.type === 'swarm') hud.showBanner('A swarm is coming!', 'doom', 1600);
          else if (ev.type === 'doom') hud.showBanner('Doom has awakened', 'doom', 3000);
          else if (ev.type === 'revive') hud.showBanner('Phoenix Heart! Reborn from the ashes', 'boss', 2200);
        }
      }
      // An upgrade choice pauses the sim; show it once, and don't let time pile up behind it.
      if (sim.offer) {
        accumulator = 0;
        if (!upgradeWindow.isOpen) upgradeWindow.show(sim.offer, sim.upgrades, sim.offerCount);
      }
      // Couldn't keep up (very high debug speed): drop the backlog instead of spiraling.
      if (accumulator >= DT) accumulator %= DT;
    }

    renderer.render(sim, sim.over || !started ? 1 : accumulator / DT, paused ? 0 : frameSeconds);
    debugMenu?.update(performance.now());
    hud.update(sim);

    if (sim.over && !resultsShown) {
      resultsShown = true;
      hud.showResults(sim, today);
    }
  });
}

main();
