
## Debug menu (dev only)

Under `npm run dev` / the Docker dev service, a **DEBUG** button (bottom-left, or **F2**) opens a panel with:
player immunity, set HP, game speed (paused to 8x), reroll loot, load another player's loot by name,
back to today's loot, kill all enemies, and a live readout of the current build.
It is loaded behind `import.meta.env.DEV`, so it is not part of production builds (`prod` profile on :8080).

Crit chance (capped at 75%), crit damage (base 150%) and lifesteal (heals a share of damage dealt, capped at
25%) are also offered. They apply to direct weapon hits only, not to explosions, arcs or damage over time.
Crit rolls use their own seeded stream, so they never change other randomness.
