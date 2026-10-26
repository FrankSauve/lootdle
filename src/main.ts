import { Application, Container, Graphics } from 'pixi.js';
import { createKeyboardInput } from './input/keyboard';
import { hashSeed } from './sim/rng';
import { ARENA_HEIGHT, ARENA_WIDTH, DT, createSim, stepSim } from './sim/sim';

/** Never run more than this much simulated time in one frame (e.g. after the tab was hidden). */
const MAX_FRAME_SECONDS = 0.25;

async function main() {
  const app = new Application();
  await app.init({ resizeTo: window, background: '#14101c', antialias: true });
  document.getElementById('app')!.appendChild(app.canvas);

  const today = new Date().toISOString().slice(0, 10);
  const sim = createSim(hashSeed(today));
  const input = createKeyboardInput();

  // Rendering only reads simulation state; it never changes it.
  const world = new Container();
  app.stage.addChild(world);

  const arena = new Graphics()
    .rect(0, 0, ARENA_WIDTH, ARENA_HEIGHT)
    .fill(0x1d1728)
    .stroke({ width: 4, color: 0x3a2f52 });
  const player = new Graphics().circle(0, 0, sim.player.radius).fill(0xffc94a);
  world.addChild(arena, player);

  const fitArena = () => {
    const scale = Math.min(app.screen.width / ARENA_WIDTH, app.screen.height / ARENA_HEIGHT) * 0.95;
    world.scale.set(scale);
    world.position.set(
      (app.screen.width - ARENA_WIDTH * scale) / 2,
      (app.screen.height - ARENA_HEIGHT * scale) / 2,
    );
  };
  let fittedWidth = 0;
  let fittedHeight = 0;

  // Fixed-step simulation, rendered with interpolation between the last two ticks.
  let accumulator = 0;
  let prevX = sim.player.x;
  let prevY = sim.player.y;

  app.ticker.add((ticker) => {
    if (app.screen.width !== fittedWidth || app.screen.height !== fittedHeight) {
      fittedWidth = app.screen.width;
      fittedHeight = app.screen.height;
      fitArena();
    }

    accumulator += Math.min(ticker.deltaMS / 1000, MAX_FRAME_SECONDS);

    while (accumulator >= DT) {
      prevX = sim.player.x;
      prevY = sim.player.y;
      stepSim(sim, input.read());
      accumulator -= DT;
    }

    const alpha = accumulator / DT;
    player.position.set(
      prevX + (sim.player.x - prevX) * alpha,
      prevY + (sim.player.y - prevY) * alpha,
    );
  });
}

main();
