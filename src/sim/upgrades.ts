/**
 * Periodic stat upgrades: every 30 seconds the game pauses and offers three choices.
 * They only change raw stats; the rarity of a choice decides how much of the stat it gives.
 *
 * Offers are a pure function of the player's seed and the offer number, so a run can be replayed.
 */
import type { Rarity } from './items.ts';
import { createRng, hashSeed } from './rng.ts';
import type { SimState } from './state.ts';

export const UPGRADE_INTERVAL_SECONDS = 30;

export type UpgradeStat =
  | 'damage'
  | 'attackSpeed'
  | 'maxHp'
  | 'regen'
  | 'range'
  | 'moveSpeed'
  | 'armor'
  | 'pierce'
  | 'multishot'
  | 'critChance'
  | 'critDamage'
  | 'lifesteal';

export interface UpgradeDef {
  id: UpgradeStat;
  name: string;
  /** Amount gained at each rarity (Common .. Legendary). */
  values: readonly number[];
  /** Formats an amount for display. */
  format: (v: number) => string;
  /** The lowest rarity this can appear at (small whole-number stats only show up high up). */
  minRarity: number;
  /** Doesn't apply to melee weapons. */
  rangedOnly?: boolean;
}

const pct = (v: number) => `+${Math.round(v * 100)}%`;

export const UPGRADES: Record<UpgradeStat, UpgradeDef> = {
  damage: { id: 'damage', name: 'Damage', values: [0.08, 0.12, 0.17, 0.24, 0.35], format: pct, minRarity: 0 },
  attackSpeed: { id: 'attackSpeed', name: 'Attack speed', values: [0.06, 0.09, 0.13, 0.18, 0.26], format: pct, minRarity: 0 },
  maxHp: { id: 'maxHp', name: 'Max health', values: [10, 16, 24, 36, 55], format: (v) => `+${v}`, minRarity: 0 },
  regen: { id: 'regen', name: 'Regeneration', values: [0.5, 0.8, 1.2, 1.8, 2.8], format: (v) => `+${v} HP/s`, minRarity: 0 },
  range: { id: 'range', name: 'Range', values: [0.06, 0.09, 0.13, 0.18, 0.26], format: pct, minRarity: 0 },
  moveSpeed: { id: 'moveSpeed', name: 'Move speed', values: [0.04, 0.06, 0.08, 0.11, 0.15], format: pct, minRarity: 0 },
  armor: { id: 'armor', name: 'Armor', values: [0.03, 0.05, 0.07, 0.1, 0.14], format: (v) => `-${Math.round(v * 100)}% damage taken`, minRarity: 0 },
  pierce: { id: 'pierce', name: 'Piercing', values: [1, 1, 2, 2, 3], format: (v) => `+${v} enemies pierced`, minRarity: 1, rangedOnly: true },
  critChance: { id: 'critChance', name: 'Crit chance', values: [0.03, 0.05, 0.07, 0.1, 0.14], format: pct, minRarity: 0 },
  critDamage: { id: 'critDamage', name: 'Crit damage', values: [0.1, 0.15, 0.22, 0.32, 0.5], format: pct, minRarity: 0 },
  lifesteal: { id: 'lifesteal', name: 'Lifesteal', values: [0.01, 0.015, 0.02, 0.03, 0.045], format: (v) => `heal ${+(v * 100).toFixed(1)}% of damage dealt`, minRarity: 0 },
  multishot: { id: 'multishot', name: 'Multishot', values: [0, 0, 0, 1, 2], format: (v) => `+${v} projectile${v === 1 ? '' : 's'} per volley`, minRarity: 3 },
};

export const UPGRADE_STATS = Object.keys(UPGRADES) as UpgradeStat[];

export interface UpgradeOption {
  stat: UpgradeStat;
  rarity: Rarity;
}

/** Sum of everything picked so far, per stat. */
export type UpgradeTotals = Record<UpgradeStat, number>;

export function emptyTotals(): UpgradeTotals {
  return { damage: 0, attackSpeed: 0, maxHp: 0, regen: 0, range: 0, moveSpeed: 0, armor: 0, pierce: 0, multishot: 0, critChance: 0, critDamage: 0, lifesteal: 0 };
}

/** Upgrade rarity weights; epics and legendaries get a little likelier with every offer. */
const RARITY_WEIGHTS = [40, 28, 17, 10, 5];
const LUCK_PER_OFFER = 0.08;
/** Armor can't make you immune; move speed can't run away with the game. */
export const MAX_ARMOR = 0.6;
export const MAX_UPGRADE_SPEED = 0.6;
/** Crits start at 150% damage; upgrades add to that. Crit chance and lifesteal are capped. */
export const BASE_CRIT_DAMAGE = 1.5;
export const MAX_CRIT_CHANCE = 0.75;
export const MAX_LIFESTEAL = 0.25;

/** Rolls the three choices for offer number `n` (1-based). Pure and deterministic. */
export function makeOffer(playerSeed: number, n: number, melee: boolean): UpgradeOption[] {
  const rng = createRng(hashSeed(`upgrade:${playerSeed}:${n}`));
  const luck = 1 + LUCK_PER_OFFER * (n - 1);
  const weights = RARITY_WEIGHTS.map((w, r) => (r >= 3 ? w * luck : w));
  const total = weights.reduce((a, b) => a + b, 0);
  const options: UpgradeOption[] = [];
  for (let slot = 0; slot < 3; slot++) {
    let x = rng() * total;
    let r = 0;
    for (; r < weights.length - 1; r++) {
      x -= weights[r]!;
      if (x < 0) break;
    }
    const rarity = r as Rarity;
    const candidates = UPGRADE_STATS.filter((s) => {
      const def = UPGRADES[s];
      return def.minRarity <= rarity && !(melee && def.rangedOnly) && !options.some((o) => o.stat === s);
    });
    const stat = candidates[Math.floor(rng() * candidates.length)]!;
    options.push({ stat, rarity });
  }
  return options;
}

/** Opens the next upgrade choice and pauses the simulation until one is picked. */
export function openUpgradeOffer(state: SimState): void {
  if (state.offer) return;
  state.offerCount++;
  state.offer = makeOffer(state.seed, state.offerCount, state.build.melee);
}

/** Applies option `index` of the open offer and resumes the game. */
export function chooseUpgrade(state: SimState, index: number): boolean {
  const offer = state.offer;
  const option = offer?.[index];
  if (!offer || !option) return false;
  const value = UPGRADES[option.stat].values[option.rarity]!;
  state.upgrades[option.stat] += value;
  state.picked.push(option);
  state.offer = null;
  if (option.stat === 'maxHp') {
    state.player.maxHp += value;
    state.player.hp += value;
  }
  refreshStats(state);
  return true;
}

/** Recomputes weapon and movement numbers from the compiled build plus all upgrades. */
export function refreshStats(state: SimState): void {
  const u = state.upgrades;
  const b = state.build;
  const w = state.weapon;
  w.damage = b.damage * (1 + u.damage);
  w.cooldown = Math.max(0.01, b.cooldown / (1 + u.attackSpeed));
  w.range = b.range * (1 + u.range);
  w.projectileLife = b.projectileLife * (1 + u.range);
  w.meleeRadius = b.meleeRadius * (1 + 0.5 * u.range);
  w.meleeOffset = b.meleeOffset * (1 + u.range);
  w.projectilesPerVolley = b.count + u.multishot;
  w.pierce = b.pierce + u.pierce;
  state.player.speed = b.moveSpeed * (1 + Math.min(MAX_UPGRADE_SPEED, u.moveSpeed));
}
