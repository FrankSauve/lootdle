/**
 * Enemy behavior beyond "walk at the player": flanking, charging, kiting, shooting, summoning
 * and healing. Everything is a function of the sim state and fixed constants, so it stays
 * deterministic (no trigonometry: aim directions use exact precomputed constants).
 */
import { ARENA_HEIGHT, ARENA_WIDTH, DT } from './config.ts';
import { killEnemy } from './combat.ts';
import { damageMultiplier, hpMultiplier } from './director.ts';
import { EnemyKind, MAX_ENEMY_RADIUS } from './enemies.ts';
import type { SimState } from './state.ts';

/** Flankers aim this far to the side of the player until they get close. */
const FLANK_OFFSET = 140;
const FLANK_COMMIT_DISTANCE = 180;

/** Charge parameters for enemies that telegraph and then dash in a straight line. */
interface ChargeDef {
  range: number;
  windup: number;
  dash: number;
  speed: number;
  cooldown: number;
}
const CHARGES: Partial<Record<EnemyKind, ChargeDef>> = {
  [EnemyKind.Boar]: { range: 460, windup: 0.7, dash: 0.55, speed: 470, cooldown: 2.8 },
  [EnemyKind.Juggernaut]: { range: 700, windup: 1.0, dash: 0.85, speed: 460, cooldown: 3.2 },
};

/** Ranged enemies hold this distance from the player. */
const KITE_DISTANCE: Partial<Record<EnemyKind, number>> = {
  [EnemyKind.Spitter]: 250,
  [EnemyKind.Shaman]: 340,
  [EnemyKind.Lich]: 310,
  [EnemyKind.Dragon]: 250,
};

const A = 0.9238795325112867;
const B = 0.3826834323650898;
const R = 0.7071067811865476;
/** 16 evenly spaced directions. */
const RING16: readonly (readonly [number, number])[] = [
  [1, 0], [A, B], [R, R], [B, A], [0, 1], [-B, A], [-R, R], [-A, B],
  [-1, 0], [-A, -B], [-R, -R], [-B, -A], [0, -1], [B, -A], [R, -R], [A, -B],
];
const RING8: readonly (readonly [number, number])[] = RING16.filter((_, i) => i % 2 === 0);
/** Rotations of 0.3 and 0.6 radians, for fanning shots. */
const C1 = 0.955336489125606;
const S1 = 0.29552020666133955;
const C2 = 0.8253356149096783;
const S2 = 0.5646424733950354;

const SHOT_SPEED = 230;
const SHOT_LIFE = 4;
const SHAMAN_RADIUS = 150;
const SHAMAN_HEAL = 0.14;
const QUEEN_BROOD = 5;

/** Moves every enemy according to its behavior. */
export function moveEnemies(state: SimState): void {
  const e = state.enemies;
  const p = state.player;
  for (let i = 0; i < e.count; i++) {
    if (e.dead[i]) continue;
    let dx = p.x - e.x[i]!;
    let dy = p.y - e.y[i]!;
    let len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) continue;
    const kind = e.kind[i]! as EnemyKind;
    const speed = e.speed[i]!;

    const charge = CHARGES[kind];
    if (charge) {
      moveCharger(state, i, kind, charge, dx / len, dy / len, len);
      continue;
    }

    const kite = KITE_DISTANCE[kind];
    if (kite !== undefined) {
      // Approach until in range, back away when the player gets too close; the Lich also circles.
      let forward = 0;
      if (len > kite + 30) forward = 1;
      else if (len < kite - 70) forward = -0.8;
      let sx = 0;
      let sy = 0;
      if (kind === EnemyKind.Lich || kind === EnemyKind.Dragon) {
        const side = e.id[i]! & 1 ? 1 : -1;
        sx = (-dy / len) * side * 0.55;
        sy = (dx / len) * side * 0.55;
      }
      e.x[i] = e.x[i]! + ((dx / len) * forward + sx) * speed * DT;
      e.y[i] = e.y[i]! + ((dy / len) * forward + sy) * speed * DT;
      continue;
    }

    if (kind === EnemyKind.Bomber && len <= p.radius + e.radius[i]! + 4) {
      killEnemy(state, i); // runs into the player and goes off
      continue;
    }

    if (kind === EnemyKind.Flanker && len > FLANK_COMMIT_DISTANCE) {
      // Perpendicular offset; the side depends on the enemy id so flankers split left and right.
      const side = e.id[i]! & 1 ? 1 : -1;
      const tx = p.x + (-dy / len) * side * FLANK_OFFSET;
      const ty = p.y + (dx / len) * side * FLANK_OFFSET;
      dx = tx - e.x[i]!;
      dy = ty - e.y[i]!;
      len = Math.sqrt(dx * dx + dy * dy) || 1;
    }

    const step = (speed * DT) / len;
    e.x[i] = e.x[i]! + dx * step;
    e.y[i] = e.y[i]! + dy * step;
  }
}

/** Walk, telegraph (stand still, tint red), dash in a straight line, recover. */
function moveCharger(state: SimState, i: number, kind: EnemyKind, c: ChargeDef, ux: number, uy: number, dist: number): void {
  const e = state.enemies;
  const mode = e.mode[i]!;
  if (mode === 0) {
    e.timer[i] = e.timer[i]! - DT;
    e.x[i] = e.x[i]! + ux * e.speed[i]! * DT;
    e.y[i] = e.y[i]! + uy * e.speed[i]! * DT;
    if (e.timer[i]! <= 0 && dist < c.range && dist > 120) {
      e.mode[i] = 1;
      e.timer[i] = c.windup;
      e.dirX[i] = ux;
      e.dirY[i] = uy;
    }
  } else if (mode === 1) {
    // Keeps tracking the player until the last moment, then commits.
    e.timer[i] = e.timer[i]! - DT;
    e.dirX[i] = ux;
    e.dirY[i] = uy;
    if (e.timer[i]! <= 0) {
      e.mode[i] = 2;
      e.timer[i] = c.dash;
    }
  } else {
    e.timer[i] = e.timer[i]! - DT;
    e.x[i] = e.x[i]! + e.dirX[i]! * c.speed * DT;
    e.y[i] = e.y[i]! + e.dirY[i]! * c.speed * DT;
    if (e.timer[i]! <= 0) {
      e.mode[i] = 0;
      e.timer[i] = c.cooldown;
      if (kind === EnemyKind.Juggernaut) {
        // Slamming to a halt throws out a ring of debris.
        shootRing(state, e.x[i]!, e.y[i]!, RING8, 200, e.damage[i]! * 0.5);
        state.events.push({ type: 'enemyBlast', x: e.x[i]!, y: e.y[i]!, radius: 70, style: 2 });
      }
    }
  }
}

/** Timers for shooting, healing and summoning. Expects the spatial grid to be current. */
export function updateEnemyAbilities(state: SimState): void {
  const e = state.enemies;
  const p = state.player;
  const n = e.count; // enemies spawned by abilities act next tick
  for (let i = 0; i < n; i++) {
    if (e.dead[i]) continue;
    const kind = e.kind[i]! as EnemyKind;
    if (
      kind !== EnemyKind.Spitter &&
      kind !== EnemyKind.Shaman &&
      kind !== EnemyKind.Lich &&
      kind !== EnemyKind.Dragon &&
      kind !== EnemyKind.HiveQueen
    ) {
      continue;
    }
    e.timer[i] = e.timer[i]! - DT;
    if (e.timer[i]! > 0) continue;

    const x = e.x[i]!;
    const y = e.y[i]!;
    const dx = p.x - x;
    const dy = p.y - y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    switch (kind) {
      case EnemyKind.Spitter:
        if (len < 540) {
          state.enemyShots.spawn(x, y, ux * SHOT_SPEED, uy * SHOT_SPEED, e.damage[i]! * 1.6, SHOT_LIFE);
          e.timer[i] = 2.3;
        } else {
          e.timer[i] = 0.3;
        }
        break;

      case EnemyKind.Lich: {
        e.mode[i] = (e.mode[i]! + 1) & 3;
        if (e.mode[i] === 0) {
          // Every fourth volley: a full ring.
          shootRing(state, x, y, RING16, 170, e.damage[i]! * 0.8);
          state.events.push({ type: 'enemyBlast', x, y, radius: 60, style: 3 });
        } else {
          fan(state, x, y, ux, uy, 250, e.damage[i]! * 0.8);
        }
        e.timer[i] = 2.0;
        break;
      }

      case EnemyKind.Dragon: {
        // Four attacks in turn: a wide fan of fire, a ring, three staggered fans, then a call for bombers.
        // Below half health it enrages and attacks faster.
        e.mode[i] = (e.mode[i]! + 1) & 3;
        const dmg = e.damage[i]! * 0.6;
        const phase = e.mode[i]!;
        if (phase === 0) {
          wideFan(state, x, y, ux, uy, 300, dmg);
        } else if (phase === 1) {
          shootRing(state, x, y, RING16, 200, dmg);
          state.events.push({ type: 'enemyBlast', x, y, radius: 110, style: 0 });
        } else if (phase === 2) {
          fan(state, x, y, ux, uy, 230, dmg);
          fan(state, x, y, ux, uy, 300, dmg);
          fan(state, x, y, ux, uy, 370, dmg);
        } else {
          const t = state.tick * DT;
          for (let k = 0; k < 6; k++) {
            const [rx, ry] = RING16[(k * 3) % 16]!;
            state.enemies.spawn(
              EnemyKind.Bomber,
              clampX(x + rx * 90),
              clampY(y + ry * 90),
              hpMultiplier(t),
              damageMultiplier(t),
            );
          }
          state.events.push({ type: 'enemyBlast', x, y, radius: 100, style: 2 });
        }
        e.timer[i] = e.hp[i]! < e.maxHp[i]! * 0.5 ? 1.3 : 1.9;
        break;
      }

      case EnemyKind.Shaman: {
        const buf = state.nearby;
        const m = state.grid.query(x, y, SHAMAN_RADIUS + MAX_ENEMY_RADIUS, buf);
        let healed = 0;
        for (let k = 0; k < m; k++) {
          const j = buf[k]!;
          if (e.dead[j] || e.hp[j]! >= e.maxHp[j]!) continue;
          const ex = e.x[j]! - x;
          const ey = e.y[j]! - y;
          if (ex * ex + ey * ey > SHAMAN_RADIUS * SHAMAN_RADIUS) continue;
          e.hp[j] = Math.min(e.maxHp[j]!, e.hp[j]! + e.maxHp[j]! * SHAMAN_HEAL);
          healed++;
        }
        if (healed > 0) state.events.push({ type: 'enemyBlast', x, y, radius: SHAMAN_RADIUS, style: 1 });
        e.timer[i] = 3.2;
        break;
      }

      case EnemyKind.HiveQueen: {
        // Calls a brood of rats; faster once she is wounded.
        const hpMul = hpMultiplier(state.tick * DT);
        const dmgMul = damageMultiplier(state.tick * DT);
        for (let k = 0; k < QUEEN_BROOD; k++) {
          const [rx, ry] = RING8[(k * 3) % 8]!;
          state.enemies.spawn(EnemyKind.Rat, clampX(x + rx * 44), clampY(y + ry * 44), hpMul, dmgMul);
        }
        state.events.push({ type: 'enemyBlast', x, y, radius: 56, style: 2 });
        e.timer[i] = e.hp[i]! < e.maxHp[i]! * 0.5 ? 3.0 : 4.4;
        break;
      }
    }
  }
}

function shootRing(
  state: SimState,
  x: number,
  y: number,
  dirs: readonly (readonly [number, number])[],
  speed: number,
  damage: number,
): void {
  for (const [dx, dy] of dirs) state.enemyShots.spawn(x, y, dx * speed, dy * speed, damage, SHOT_LIFE);
}

/** Five shots spread across about 70 degrees, aimed at (ux, uy). */
function fan(state: SimState, x: number, y: number, ux: number, uy: number, speed: number, damage: number): void {
  const shots: [number, number][] = [
    [ux * C2 + uy * S2, uy * C2 - ux * S2],
    [ux * C1 + uy * S1, uy * C1 - ux * S1],
    [ux, uy],
    [ux * C1 - uy * S1, uy * C1 + ux * S1],
    [ux * C2 - uy * S2, uy * C2 + ux * S2],
  ];
  for (const [dx, dy] of shots) state.enemyShots.spawn(x, y, dx * speed, dy * speed, damage, SHOT_LIFE);
}

const C3 = 0.6216099682706644;
const S3 = 0.7833269096274834;
const C4 = 0.3623577544766736;
const S4 = 0.9320390859672263;

/** Nine shots spread across about 140 degrees, aimed at (ux, uy). */
function wideFan(state: SimState, x: number, y: number, ux: number, uy: number, speed: number, damage: number): void {
  const rot: readonly (readonly [number, number])[] = [
    [1, 0], [C1, S1], [C2, S2], [C3, S3], [C4, S4],
  ];
  for (const [c, s] of rot) {
    state.enemyShots.spawn(x, y, (ux * c + uy * s) * speed, (uy * c - ux * s) * speed, damage, SHOT_LIFE);
    if (s !== 0) state.enemyShots.spawn(x, y, (ux * c - uy * s) * speed, (uy * c + ux * s) * speed, damage, SHOT_LIFE);
  }
}

function clampX(x: number): number {
  return x < 10 ? 10 : x > ARENA_WIDTH - 10 ? ARENA_WIDTH - 10 : x;
}
function clampY(y: number): number {
  return y < 10 ? 10 : y > ARENA_HEIGHT - 10 ? ARENA_HEIGHT - 10 : y;
}
