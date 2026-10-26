/**
 * Pure, fixed-step game simulation. No rendering, DOM, timers or Math.random() here.
 *
 * Determinism rules (needed for replays and server-side validation):
 * - Advance only through stepSim(), exactly once per fixed tick.
 * - Use +, -, *, / and Math.sqrt freely; they are exact IEEE operations in every browser.
 * - Avoid Math.sin/cos/atan2/exp/pow/hypot: their results can differ between JS engines.
 *   Add deterministic helpers (lookup tables or fixed-point) when they are needed.
 */
import { createRng } from './rng';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const ARENA_WIDTH = 1600;
export const ARENA_HEIGHT = 900;

/** Movement intent for one tick; each axis in the range -1..1. */
export interface MoveInput {
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  radius: number;
  speed: number; // units per second
}

export interface SimState {
  tick: number;
  rng: () => number;
  player: PlayerState;
}

export function createSim(seed: number): SimState {
  return {
    tick: 0,
    rng: createRng(seed),
    player: { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, radius: 16, speed: 260 },
  };
}

export function stepSim(state: SimState, input: MoveInput): void {
  const p = state.player;

  let dx = input.x;
  let dy = input.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }

  p.x = clamp(p.x + dx * p.speed * DT, p.radius, ARENA_WIDTH - p.radius);
  p.y = clamp(p.y + dy * p.speed * DT, p.radius, ARENA_HEIGHT - p.radius);

  state.tick++;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
