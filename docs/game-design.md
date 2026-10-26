# Lootdle — Game Design Document

**Version:** 0.3 (concept)  
**Date:** October 26, 2026  
**Genre:** Daily, movement-only, endless auto-attacking survivor / bullet-heaven game

## 1. High concept

Lootdle is a daily browser game in which every player faces the **same daily arena and enemy schedule**, but receives a **different randomly generated equipment loadout**. The player controls **movement only**; weapons attack automatically, abilities trigger automatically, and upgrades are awarded automatically. The goal is to survive as long as possible against increasingly intense waves and bosses that spawn every 20 seconds.

**Core hook:** *Fate chooses your build. You choose where to run.*

The game is genuinely **endless**: no five-minute time limit, forced death, or guaranteed victory. Around five minutes is an aspirational balance point at which even exceptional builds should be under severe pressure—not a hard cap.

## 2. Locked design decisions

| Element | Current decision |
|---|---|
| Session structure | One featured daily run and loadout per player; practice mode is optional |
| Arena | Same daily map for all players |
| Enemies and bosses | Same daily wave schedule; bosses spawn every 20 seconds |
| Starting gear | Random weapon + armor + trinket, unique to each player/day |
| Controls | Movement only: WASD / arrows / virtual joystick |
| Attacks and skills | Fully automatic; no aiming or active ability buttons |
| Upgrades | Automatic randomized blessing after each boss defeat |
| Death | Run ends at 0 HP |
| Duration | Endless, with sharply escalating difficulty after 2:00 |
| Main ranking | Longest survival time |
| Other stats | Kills, total damage, bosses defeated, combo records, achievements, loot rarity |
| Long-term progression | Run history, cosmetic unlocks, collections, achievements; no permanent gameplay power |

## 3. Daily player loop

1. **Reveal today's loot:** weapon, armor, trinket, stats, affixes, drawbacks, and special effects.
2. **Discover the build:** generate a playful character nickname/title; preview possible synergies.
3. **Enter the arena:** fight today's shared waves; player moves while the character automatically attacks and uses effects.
4. **Defeat bosses:** a new boss spawns every 20 seconds, whether or not previous bosses have died. Defeating a boss grants an automatically rolled upgrade.
5. **Watch build evolution:** upgrades interact with starting gear to create unexpected combos.
6. **Die and review:** show survival time, bosses, kills, damage, biggest chain reaction, notable moments, and a shareable result.

Target a fast first-minute experience with readable action, plus 2x/4x replay speed or a skip-to-results option where feasible. Movement decisions should remain meaningful throughout.

## 4. Movement and automatic combat

### Player input

- Move freely in 2D using keyboard or mobile joystick.
- No manual attacks, targeting, inventory changes, or upgrade selections during the run.
- Positioning still matters: kite swarms, evade projectiles, steer enemies into AOE, approach healing pickups, and escape boss patterns.

### Automatic attack logic

- Each weapon archetype has its own target-selection and attack cadence.
- Weapons fire or strike automatically when ready.
- Passive abilities trigger when their explicit conditions are met (on hit, on kill, on damage received, after N projectiles, etc.).
- Bosses use telegraphed patterns, and damage is readable and avoidable whenever possible.
- Enemy and projectile collision, cooldowns, and status effects follow stable, testable rules.

| Archetype | Automatic behavior |
|---|---|
| Sword | Strikes nearby enemies, potentially cleaving groups |
| Bow | Automatically fires at targets in range, favoring distance |
| Staff | Casts magical attacks that can affect groups |
| Hammer | Slow heavy hits with knockback and area effects |
| Daggers | Fast attacks and projectiles with on-hit/on-kill interactions |
| Shield-themed weapon | Short-range retaliation or defensive pulses |

## 5. Loot generation

Every daily build starts with **one weapon, one armor, and one trinket**. Items should be assembled from composable parts rather than individually authored permutations:

`Item = Base archetype + Base stats + Affixes + Special effects + Optional drawback`

- **Weapon:** Defines primary damage delivery and targeting.
- **Armor:** Influences survivability, barriers, retaliation, or movement.
- **Trinket:** Modifies or bends rules, e.g. additional projectiles, explosions, chaining, teleport-related effects.
- **Affixes:** Add recognizable mechanical tags, such as Poison, Burn, Shock, Knockback, Lifesteal, Explosion, or Chain.
- **Curses/quirks:** Introduce amusing tradeoffs rather than simply making an item worthless.

### Example loadout

**The Cursed Blender**

- **Vampiric Throwing Knives:** Automatically throw three knives; restore a little HP after a kill threshold.
- **Thornmail of Retribution:** Taking damage releases a close-range explosion.
- **Echoing Ruby:** Every fifth projectile is duplicated toward another enemy.

This build could later evolve into an explosion-and-healing chain reaction with the right upgrades.

**Design priority:** A low-rarity item can be interesting or surprisingly strong thanks to interactions. Avoid a design where rarity alone predicts the winner.

## 6. Automatic upgrades and synergies

- Each defeated boss grants **one random upgrade**; the player does not choose from cards.
- Rolls may be weighted toward effects compatible with current equipment, without guaranteeing a perfect synergy.
- An upgrade can improve existing numbers, unlock new mechanics, or radically alter the build.
- Upgrade generation must be deterministic for a given player/day/run state; refreshing must not reroll rewards.
- Optional pity weighting for weak builds should be explicit, consistent, and tested.

### Upgrade tiers

| Tier | Examples |
|---|---|
| Common | Attack speed, projectile count, HP, move speed, AOE radius |
| Rare | Poison spread, chain lightning, explosions on kill, lifesteal |
| Legendary | Orbiting projectile duplication, cascading explosions, transformative status interactions |

### Fun build archetypes

- **Nuclear Chain Reaction:** Enemies explode on death and explosions propagate through crowds.
- **Living Blender:** Orbiting weapons attack rapidly and multiply under certain triggers.
- **Walking Plague:** Poison spreads and slain infected enemies leave toxic clouds.
- **Tesla Coil:** Shock and chain lightning jump through dense groups.
- **Immortal Turtle:** Shields, retaliation, and regeneration form a defensive build, subject to clear caps.
- **One-HP Menace:** Risky low-health effects generate extreme damage but demand excellent movement.

### Synergy evolutions

Special combinations can unlock an additional behavior automatically, e.g.:

- Poison spread + poisoned-enemy explosions → **Plague Detonation**.
- Shield retaliation + Shock → blocks release chain lightning.
- Explosions + duplication → more frequent chain-reaction opportunities.
- Burn + knockback → forced movement leaves damaging flame trails.

Cap repeated procs, chain depth, and attack frequency to prevent infinite loops and browser performance collapse.

## 7. Arena, enemies, and boss schedule

### Daily world

- Generate or publish one shared arena layout per day.
- All players see the same enemy types, spawn schedule, and boss sequence.
- A date-based seed identifies the challenge; per-player seeds identify starting loot and upgrade outcomes.
- Randomness must use a controlled seeded generator rather than uncontrolled runtime randomness.

### Regular enemies

Start with a small, readable roster: chasers, fast flankers, ranged attackers, durable elites, exploding enemies, and enemies that spawn smaller units.

### Bosses

A **new boss appears every 20 seconds**, including beyond five minutes. Previous bosses **do not despawn** simply because the next one arrived. Bosses use distinct mechanics such as charges, projectile fans, summons, poison clouds, shockwaves, and area denial. Defeating a boss triggers the next automatic upgrade.

Example first two minutes:

| Spawn | Example boss | Mechanic |
|---|---|---|
| 0:20 | Giant Slime | Splits into smaller enemies |
| 0:40 | Bone Knight | Straight-line charge |
| 1:00 | Plague Mother | Poison clouds and summons |
| 1:20 | Infernal Golem | Shockwaves |
| 1:40 | Void Archer | Projectile fans |
| 2:00 | Death Herald | Introduces stronger elite pressure |

After 2:00, continue introducing boss variants, overlapping threats, and escalating attacks every 20 seconds indefinitely. Boss names and mechanics are placeholders, not locked production content.

## 8. Endless difficulty model

### Key rule

**There is no maximum survival duration.** The game ends only on death. Five minutes is a difficulty-balancing aspiration: very few builds should reach it, but a sufficiently good build and player can go beyond.

| Time | Phase | Intended experience |
|---|---|---|
| 0:00–1:00 | Awakening | Learn the loadout; many builds survive |
| 1:00–2:00 | Swarm | Weak builds begin to fall behind |
| 2:00–3:00 | Doom | Major pressure spike; strong synergies necessary |
| 3:00–4:00 | Apocalypse | Overlapping bosses, dangerous elites and projectile patterns |
| 4:00–5:00 | Extinction | Exceptional builds under extreme pressure |
| 5:00+ | Beyond the Impossible | Continue scaling forever; no scripted ending |

### Scaling dimensions

- Increase enemy spawn density until an engine-safe cap, then scale elite quality and threat patterns rather than spawning unlimited actors.
- Increase enemy HP and damage gradually and with tuning, avoiding damage-sponge gameplay.
- Increase mobility and ranged pressure within readable/dodgeable bounds.
- Introduce elite combinations and new attack patterns after the two-minute Doom transition.
- Keep bosses active until defeated and spawn the next one on schedule.
- Beyond five minutes, keep ramping difficulty through explicit, repeatable formulas or tiers; **never trigger forced death**.

### Doom milestone at 2:00

At exactly 2:00, present **DOOM HAS AWAKENED** and transition to significantly more dangerous waves. Doom can introduce crowd-control-resistant enemies, more elites, denser attack lanes, and progressively faster boss pressure. Favor threats that skilled movement can avoid over unavoidable global damage.

### Balance target

Most builds should die well before five minutes. Runs surviving beyond five minutes should be remarkable—but possible. Tune based on actual run distributions and simulations, not hard-coded survival limits. No formula can guarantee which exact build is “best” or how long the best player will last.

## 9. Balance guardrails

| Mechanic | Guideline |
|---|---|
| Damage reduction | Use a clear cap (initial candidate: 75%) |
| Lifesteal | Cap healing per second |
| Invulnerability | Short duration with internal cooldown |
| Knockback/stun | Boss/elite resistance or diminishing returns |
| Shield generation | Limit regeneration and stacking |
| Chain reactions | Limit proc depth and repeated triggers |
| Movement speed | Soft cap to preserve meaningful evasive play |
| Enemy density | Performance-safe on-screen budget |

These are starting values and behaviors for testing, not final balance decisions.

## 10. Scoring and results

### Primary leaderboard

1. **Survival time** (highest wins).
2. Bosses defeated, as a tiebreaker.
3. Total kills, as a further tiebreaker.
4. Damage dealt, as a final tiebreaker.

### Fun secondary metrics

- Total damage and kills.
- Bosses defeated.
- Largest explosion/chain-kill combo.
- Healing performed and damage taken.
- Equipment rarity and unusual affix combinations.
- Biggest overperformance compared with a *simulation-based* predicted survival time.
- Achievements: **Doom Survivor** (3:00), **Apocalypse Survivor** (4:00), **Beyond Death** (5:00), and rarer milestones beyond.

Keep **loot rarity separate from survival ranking**. A legendary roll should feel exciting, but the game should still celebrate surprising performance from bad-looking builds.

### Example share text

```text
⚔️ LOOTDLE #047
⏱️ Survived 05:38.42
💀 4,812 kills | 👑 12 bosses
💥 Biggest chain: 42
🧪 Build: The Walking Plague
🏅 Beyond Death
```

### Post-run timeline

Surface highlight events with timestamps: first boss defeated, first synergy evolution, biggest kill chain, near-death recovery, and final defeat. Support shareable summary cards; richer replay clips can come later.

## 11. Technical architecture notes

For a browser-first prototype:

- Use a lightweight 2D engine such as **Phaser** or **PixiJS**.
- Separate fixed-step combat simulation from rendering.
- Use deterministic seeded random streams for world generation, loot, upgrades, and combat events.
- Use object pooling and spatial partitioning to handle large enemy/projectile counts.
- Separate game-state/proc logic from visual effects; cap recursive interactions.
- Record movement inputs and event logs for replay and debugging.
- Store a player's daily loadout and attempt state server-side to prevent refresh-based rerolls.
- For credible competitive leaderboards, validate runs server-side or replay submitted inputs; client-submitted survival times alone are not trustworthy.
- Provide desktop keyboard and mobile joystick controls; optimize readability on small screens.

## 12. Suggested minimum viable prototype

1. Single arena with WASD/joystick movement and automatic targeting.
2. Four regular enemy types and one boss archetype; spawn bosses every 20 seconds.
3. Three equipment slots with a handful of distinct weapon/armor/trinket effects.
4. Boss-kill-triggered automatic upgrades and 5–10 meaningful synergies.
5. Clear 2:00 Doom transition and endless difficulty scaling.
6. Deterministic seeds, death screen, survival leaderboard, and share result.
7. Gradually expand toward six weapon archetypes, ~20 effects, ~20 blessings, and multiple boss patterns.

## 13. Open design questions

- **Upgrade timing:** Instant on boss death vs. brief noninteractive reveal pause; how should simultaneous boss defeats queue rewards?
- **Arena shape:** Fixed boundaries, scrolling world, or bounded map with spawn edges?
- **Healing:** Automatic equipment effects only, or also walk-over health pickups?
- **Daily fairness:** Same enemy schedule, but how to compare dramatically different loot rolls? Should there be a separate standardized challenge?
- **Daily attempts:** Strict single official attempt, or unlimited non-ranked replays with the same loadout?
- **Long-run complexity:** How aggressively to cap VFX and entity counts without flattening spectacular synergies?
- **Forecasting:** Whether predicted survival is useful and accurate enough to show players.

---

**North star:** Lootdle should turn a random equipment roll into an unpredictable, entertaining survival story. Movement is the only input; loot, auto-attacks, build synergies, enemy waves, and endless escalation create the spectacle. The player should always be curious whether today's strange build will be a spectacular failure or an impossible success.
