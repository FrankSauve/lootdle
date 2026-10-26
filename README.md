# Lootdle

A daily, movement-only, endless auto-attacking survivor game for the browser.
Built with TypeScript, PixiJS and Vite. The design document lives in `docs/game-design.md`.

## Run it (Docker)

Requires Docker Desktop.

```sh
docker compose up            # dev server with hot reload: http://localhost:5173
docker compose --profile prod up --build web   # production build via nginx: http://localhost:8080
```

Useful commands inside the dev container:

```sh
docker compose exec dev npm run typecheck
docker compose exec dev npm install <package>
```

`node_modules` lives in a Docker volume, not in this folder. If dependencies get into a bad state,
reset it with `docker compose down -v`.

## Project layout

```
src/
  main.ts            bootstrap: PixiJS app, fixed-step loop, wiring sim -> renderer -> HUD
  style.css          HUD styles
  sim/               pure deterministic simulation (no DOM, no rendering, no Math.random)
    sim.ts           createSim() / stepSim(): the order of systems in one tick
    config.ts        tick rate, arena size, entity budgets, boss/Doom timing
    state.ts         SimState, player, weapon, stats and SimEvent types
    enemies.ts       enemy definitions and struct-of-arrays EnemyPool
    projectiles.ts   struct-of-arrays ProjectilePool
    grid.ts          spatial grid for neighbour queries
    director.ts      spawn schedule, bosses every 20 s, Doom at 2:00, difficulty curves
    combat.ts        enemy movement, separation, projectile hits, kills, contact damage
    weapons.ts       starting weapon and auto-targeting
    rng.ts           seeded PRNG and seed hashing
  render/            PixiJS drawing: sprite pools, interpolation, particles, screen shake
  ui/hud.ts          DOM overlay: timer, HP, counters, banners, results screen
  input/             keyboard (and later joystick) -> MoveInput
scripts/
  sim-check.ts       headless determinism, survival and load test
```

The simulation runs at a fixed 60 ticks per second and the renderer interpolates between ticks.
Keep `src/sim` pure and deterministic so runs can be replayed and validated on a server later.

Check the simulation without a browser:

```sh
docker compose exec dev npm run sim:check
```

It runs the same seeded run twice and fails if the results differ, then runs a 6-minute
invulnerable load test and reports entity counts and simulation cost per tick.

## Daily loot

Every player gets one weapon, one armor and one trinket per day, rolled from a seed
(`hash(date + player id)`), so a refresh never rerolls it. Items are assembled from parts:
base archetype + effects (poison, burn, shock, knockback, lifesteal, explosion, thorns, barrier,
echo, ...) + an optional drawback. The pieces live in `src/sim/items.ts`, the roller in
`src/sim/loot.ts`, and `src/sim/build.ts` compiles a loadout into the numbers the sim uses.

- Preview someone else's loot: open `http://localhost:5173/?player=anything`.
- `npm run sim:check` also checks loot determinism, the rarity mix, and that rarity doesn't
  decide survival on its own.

### Signatures and synergies

Rarer items can carry a *signature*: a rule-bending power such as Whirling Blades, Phoenix Heart,
Black Hole or Executioner (`SIGNATURES` in `src/sim/items.ts`). Separately, certain combinations
of effects across your gear unlock a *synergy* automatically (Napalm, Plague Detonation, Storm
Ward, ...; `SYNERGIES`). Both show up on the loot reveal screen.

Handy previews (today's date seeds them): `?player=p12` (blades + phoenix), `?player=p16`
(explosions + napalm), `?player=p38` (tesla storm + blood nova).

## Settings

The gear button in the top bar (or `Esc`) opens the settings window and pauses the game. Settings
are saved in the browser. To add one, extend `Settings`, `DEFAULT_SETTINGS` and `SETTING_DEFS` in
`src/settings.ts`; the window builds its rows from that list.

## Debug menu (dev only)

Under `npm run dev` / the Docker dev service, a **DEBUG** button (bottom-left, or **F2**) opens a panel with:
player immunity, set HP, game speed (paused to 8x), reroll loot, load another player's loot by name,
back to today's loot, kill all enemies, and a live readout of the current build.
It is loaded behind `import.meta.env.DEV`, so it is not part of production builds (`prod` profile on :8080).

## Enemies

Regular roster (joins the mix over time): Chaser, Rat packs, Flanker, Spitter (ranged), Bomber (explodes
when it dies or touches you), Brute, Boar (telegraphed charge), Knight (armored: direct weapon hits do
~55%, explosions/arcs/DOT ignore armor) and Shaman (heals nearby enemies). A rat swarm hits every 30 s
from 0:25. A boss arrives every 20 s, cycling Giant Slime, Juggernaut (charges + debris ring), Hive Queen
(summons rats) and Lich (spell fans and rings); from the fifth boss on, two arrive together.
The debug menu can spawn any of them.
