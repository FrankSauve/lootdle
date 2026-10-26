/** Simulation constants. Tuning numbers live next to the systems that use them. */

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const ARENA_WIDTH = 1600;
export const ARENA_HEIGHT = 900;

/** Hard entity budgets: the director stops spawning regular enemies near these limits. */
export const MAX_ENEMIES = 700;
export const MAX_PROJECTILES = 1000;

export const GRID_CELL_SIZE = 64;

export const BOSS_INTERVAL_SECONDS = 20;
export const DOOM_SECONDS = 120;
