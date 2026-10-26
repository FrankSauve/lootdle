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
  main.ts          bootstrap: PixiJS app, fixed-step loop, rendering
  sim/             pure deterministic simulation (no DOM, no rendering, no Math.random)
    sim.ts         state + stepSim()
    rng.ts         seeded PRNG and seed hashing
  input/           keyboard (and later joystick) -> MoveInput
```

The simulation runs at a fixed 60 ticks per second and the renderer interpolates between ticks.
Keep `src/sim` pure and deterministic so runs can be replayed and validated on a server later.
