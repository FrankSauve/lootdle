import { Application } from 'pixi.js';
import './style.css';
import { createKeyboardInput } from './input/keyboard.ts';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GameRenderer } from './render/renderer.ts';
import { hashSeed } from './sim/rng.ts';
import { DT, createSim, generateLoadout, stepSim } from './sim/sim.ts';
import type { SimState } from './sim/sim.ts';
import { SettingsStore } from './settings.ts';
import { Hud } from './ui/hud.ts';
import { LootPanel } from './ui/lootPanel.ts';
import { SettingsWindow } from './ui/settingsWindow.ts';

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
  stage.appendChild(app.canvas);

  const input = createKeyboardInput();
  const renderer = new GameRenderer(app);
  const fit = () => renderer.fitCanvas(stage.clientWidth, stage.clientHeight);
  new ResizeObserver(fit).observe(stage);
  fit();

  // The daily world is shared by everyone; the loot is yours alone (same all day).
  const today = new Date().toISOString().slice(0, 10);
  const worldSeed = hashSeed(`lootdle:${today}`);
  const playerSeed = hashSeed(`lootdle:${today}:${getPlayerId()}`);
  const loadout = generateLoadout(playerSeed);

  let sim: SimState;
  let started = false;
  let resultsShown = false;
  let accumulator = 0;
  let revealUnlockAt = 0;

  const newRun = () => {
    sim = createSim({ worldSeed, playerSeed, loadout });
    started = false;
    resultsShown = false;
    accumulator = 0;
    renderer.reset();
    hud.reset();
    hud.setLoadout(loadout);
    revealUnlockAt = performance.now() + lootPanel.show(loadout, today);
  };

  const settings = new SettingsStore();
  renderer.setScreenShake(settings.get().screenShake);
  settings.onChange((s) => renderer.setScreenShake(s.screenShake));

  const hud = new Hud(container, () => newRun(), () => settingsWindow.open());
  const lootPanel = new LootPanel(container);
  const settingsWindow = new SettingsWindow(container, settings);
  newRun();

  window.addEventListener('keydown', (e) => {
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
      accumulator += frameSeconds;
      while (accumulator >= DT && !sim.over) {
        stepSim(sim, input.read());
        accumulator -= DT;
        renderer.handleEvents(sim.events);
        for (const ev of sim.events) {
          if (ev.type === 'bossSpawned') hud.showBanner(`${ev.name} #${ev.number} appears`, 'boss');
          else if (ev.type === 'bossDefeated') hud.showBanner(`${ev.name} defeated!`, 'boss', 1400);
          else if (ev.type === 'doom') hud.showBanner('Doom has awakened', 'doom', 3000);
          else if (ev.type === 'revive') hud.showBanner('Phoenix Heart! Reborn from the ashes', 'boss', 2200);
        }
      }
    }

    renderer.render(sim, sim.over || !started ? 1 : accumulator / DT, paused ? 0 : frameSeconds);
    hud.update(sim);

    if (sim.over && !resultsShown) {
      resultsShown = true;
      hud.showResults(sim);
    }
  });
}

main();
