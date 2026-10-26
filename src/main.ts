import { Application } from 'pixi.js';
import './style.css';
import { createKeyboardInput } from './input/keyboard.ts';
import { GameRenderer } from './render/renderer.ts';
import { hashSeed } from './sim/rng.ts';
import { DT, createSim, stepSim } from './sim/sim.ts';
import type { SimState } from './sim/sim.ts';
import { Hud } from './ui/hud.ts';

/** Never simulate more than this much time in one frame (e.g. after a long hitch). */
const MAX_FRAME_SECONDS = 0.25;

async function main() {
  const container = document.getElementById('app')!;
  const app = new Application();
  await app.init({ resizeTo: container, background: '#14101c', antialias: true });
  container.appendChild(app.canvas);

  const input = createKeyboardInput();
  const renderer = new GameRenderer(app);

  // Shared daily schedule (UTC date) + a per-session player seed until accounts/loot exist.
  const today = new Date().toISOString().slice(0, 10);
  const worldSeed = hashSeed(`lootdle:${today}`);

  let sim: SimState;
  let started = false;
  let resultsShown = false;
  let accumulator = 0;

  const newRun = () => {
    sim = createSim({ worldSeed, playerSeed: (Math.random() * 2 ** 32) >>> 0 });
    started = false;
    resultsShown = false;
    accumulator = 0;
    renderer.reset();
    hud.reset();
  };

  const hud = new Hud(container, () => newRun());
  newRun();

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && sim.over) newRun();
  });

  app.ticker.add((ticker) => {
    const frameSeconds = Math.min(ticker.deltaMS / 1000, MAX_FRAME_SECONDS);
    const move = input.read();

    // The run (and the clock) starts on the first movement.
    if (!started && (move.x !== 0 || move.y !== 0)) {
      started = true;
      hud.setPromptVisible(false);
    }

    if (started && !sim.over) {
      accumulator += frameSeconds;
      while (accumulator >= DT && !sim.over) {
        stepSim(sim, input.read());
        accumulator -= DT;
        renderer.handleEvents(sim.events);
        for (const ev of sim.events) {
          if (ev.type === 'bossSpawned') hud.showBanner(`👑 ${ev.name} #${ev.number} appears`, 'boss');
          else if (ev.type === 'bossDefeated') hud.showBanner(`${ev.name} defeated!`, 'boss', 1400);
          else if (ev.type === 'doom') hud.showBanner('Doom has awakened', 'doom', 3000);
        }
      }
    }

    renderer.render(sim, sim.over || !started ? 1 : accumulator / DT, frameSeconds);
    hud.update(sim);

    if (sim.over && !resultsShown) {
      resultsShown = true;
      hud.showResults(sim);
    }
  });
}

main();
