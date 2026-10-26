/**
 * Item data: the building blocks of a daily loadout.
 *
 *   Item = base archetype + effects (innate and rolled) + optional quirk (a drawback)
 *
 * Everything here is plain data plus tiny pure functions so the loot roller, the build compiler
 * (which turns items into numbers the sim uses) and the UI (which describes items) all agree.
 */

export type Slot = 'weapon' | 'armor' | 'trinket';

export type Rarity = 0 | 1 | 2 | 3 | 4;
export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;
export const RARITY_COLORS = [0xc4c4d4, 0x62d96b, 0x4da6ff, 0xc77bff, 0xffa63d] as const;
/** Chance weights for rolling each rarity (out of 100). */
export const RARITY_WEIGHTS = [40, 28, 17, 10, 5] as const;

export type EffectId =
  // Offensive: can roll on weapons and trinkets.
  | 'poison'
  | 'burn'
  | 'shock'
  | 'knockback'
  | 'lifesteal'
  | 'explosion'
  // Defensive: can roll on armor.
  | 'fortified'
  | 'swift'
  | 'regen'
  | 'thorns'
  | 'barrier'
  // Rule benders: trinkets.
  | 'twin'
  | 'echo'
  | 'haste'
  | 'might'
  | 'reach';

export type QuirkId = 'brittle' | 'heavy' | 'clumsy' | 'fragile' | 'bloodPrice' | 'jittery';

/** Loadout "flavor" families, used to name a build ("The Walking Plague"). */
export type Family = 'plague' | 'pyre' | 'tesla' | 'nuke' | 'leech' | 'pinball' | 'turtle' | 'blender' | 'runner';

export interface Item {
  slot: Slot;
  /** Archetype id (key into WEAPONS / ARMORS / TRINKETS). */
  id: string;
  name: string;
  rarity: Rarity;
  /** Strength multiplier for this item's effects (grows with rarity; quirks add a bonus). */
  power: number;
  /** Innate effects first, then rolled affixes. */
  effects: EffectId[];
  quirk: QuirkId | null;
}

/** Effect numbers as a function of an item's power. Shared by the sim and the descriptions. */
export const fx = {
  poison: (m: number) => ({ dps: 5 * m, secs: 3 }),
  burn: (m: number) => ({ dps: 9 * m, secs: 1.5 }),
  shock: (m: number) => ({ frac: 0.4 * m, targets: m >= 1.5 ? 3 : 2, range: 130 }),
  knockback: (m: number) => 20 * m,
  lifesteal: (m: number) => ({ kills: 6, heal: Math.max(1, Math.round(2 * m)) }),
  explosion: (m: number) => ({ damage: 14 * m, radius: 56 }),
  fortified: (m: number) => Math.round(22 * m),
  swift: (m: number) => 0.07 * m,
  regen: (m: number) => 0.7 * m,
  thorns: (m: number) => ({ damage: 26 * m, radius: 90 }),
  barrier: (m: number) => 12 / m,
  twin: (m: number) => (m >= 1.5 ? 2 : 1),
  echo: (m: number) => Math.max(2, Math.round(7 - 2.4 * m)),
  haste: (m: number) => 0.15 * m,
  might: (m: number) => 0.2 * m,
  reach: (m: number) => ({ pierce: m >= 1.5 ? 2 : 1, range: 0.12 * m }),
};

const n = (v: number) => String(Math.round(v * 10) / 10);
const pct = (v: number) => `${Math.round(v * 100)}%`;

export interface EffectDef {
  label: string;
  family: Family;
  text: (m: number) => string;
  /** Adjective used when naming an item after this effect. */
  adjective: string;
}

export const EFFECTS: Record<EffectId, EffectDef> = {
  poison: {
    label: 'Poison',
    family: 'plague',
    adjective: 'Venomous',
    text: (m) => `Hits poison for ${n(fx.poison(m).dps)}/s (${fx.poison(m).secs}s)`,
  },
  burn: {
    label: 'Burn',
    family: 'pyre',
    adjective: 'Blazing',
    text: (m) => `Hits ignite for ${n(fx.burn(m).dps)}/s (${fx.burn(m).secs}s)`,
  },
  shock: {
    label: 'Shock',
    family: 'tesla',
    adjective: 'Static',
    text: (m) => `Hits arc to ${fx.shock(m).targets} foes (${pct(fx.shock(m).frac)} dmg)`,
  },
  knockback: {
    label: 'Knockback',
    family: 'pinball',
    adjective: 'Bashing',
    text: (m) => `Hits shove enemies back ${n(fx.knockback(m))}`,
  },
  lifesteal: {
    label: 'Lifesteal',
    family: 'leech',
    adjective: 'Vampiric',
    text: (m) => `Heal ${fx.lifesteal(m).heal} HP every ${fx.lifesteal(m).kills} kills`,
  },
  explosion: {
    label: 'Explosion',
    family: 'nuke',
    adjective: 'Volatile',
    text: (m) => `Kills explode for ${n(fx.explosion(m).damage)} damage`,
  },
  fortified: {
    label: 'Fortified',
    family: 'turtle',
    adjective: 'Sturdy',
    text: (m) => `+${fx.fortified(m)} max HP`,
  },
  swift: {
    label: 'Swift',
    family: 'runner',
    adjective: 'Nimble',
    text: (m) => `+${pct(fx.swift(m))} move speed`,
  },
  regen: {
    label: 'Regen',
    family: 'turtle',
    adjective: 'Mending',
    text: (m) => `Regenerate ${n(fx.regen(m))} HP/s`,
  },
  thorns: {
    label: 'Thorns',
    family: 'turtle',
    adjective: 'Thorned',
    text: (m) => `When hit, explode for ${n(fx.thorns(m).damage)}`,
  },
  barrier: {
    label: 'Barrier',
    family: 'turtle',
    adjective: 'Warded',
    text: (m) => `Block one hit every ${n(fx.barrier(m))}s`,
  },
  twin: {
    label: 'Twin',
    family: 'blender',
    adjective: 'Twinned',
    text: (m) => `+${fx.twin(m)} projectile${fx.twin(m) > 1 ? 's' : ''} per volley`,
  },
  echo: {
    label: 'Echo',
    family: 'blender',
    adjective: 'Echoing',
    text: (m) => `Every ${fx.echo(m)}th shot is duplicated`,
  },
  haste: {
    label: 'Haste',
    family: 'blender',
    adjective: 'Hasty',
    text: (m) => `+${pct(fx.haste(m))} attack speed`,
  },
  might: {
    label: 'Might',
    family: 'blender',
    adjective: 'Mighty',
    text: (m) => `+${pct(fx.might(m))} damage`,
  },
  reach: {
    label: 'Reach',
    family: 'blender',
    adjective: 'Far-Reaching',
    text: (m) => `+${fx.reach(m).pierce} pierce, +${pct(fx.reach(m).range)} range`,
  },
};

export interface QuirkDef {
  label: string;
  /** Used as a name prefix, e.g. "Leaden Plate Armor". */
  prefix: string;
  text: string;
  slots: readonly Slot[];
}

export const QUIRKS: Record<QuirkId, QuirkDef> = {
  brittle: { label: 'Brittle', prefix: 'Brittle', text: '-20% max HP', slots: ['armor', 'trinket'] },
  heavy: { label: 'Heavy', prefix: 'Leaden', text: '-15% move speed', slots: ['armor', 'trinket'] },
  clumsy: { label: 'Clumsy', prefix: 'Clumsy', text: 'Attacks 25% slower', slots: ['weapon', 'trinket'] },
  fragile: { label: 'Fragile', prefix: 'Glass', text: '+30% damage taken', slots: ['armor', 'trinket'] },
  bloodPrice: { label: 'Blood price', prefix: 'Bloodthirsty', text: 'Lose 1 HP per volley', slots: ['weapon'] },
  jittery: { label: 'Jittery', prefix: 'Jittery', text: 'Shots fly wildly off target', slots: ['weapon', 'trinket'] },
};

export interface WeaponArchetype {
  id: string;
  name: string;
  blurb: string;
  /** Melee weapons strike an area in front of the player instead of firing a projectile. */
  melee: boolean;
  cooldown: number;
  count: number;
  damage: number;
  speed: number;
  radius: number;
  life: number;
  pierce: number;
  /** Targets must be this close. */
  range: number;
  /** Melee only: distance from the player to the center of the strike. */
  offset: number;
  /** Built-in knockback. */
  knockback: number;
}

export const WEAPONS: readonly WeaponArchetype[] = [
  {
    id: 'dagger', name: 'Throwing Daggers', blurb: 'Fast twin throws',
    melee: false, cooldown: 0.35, count: 2, damage: 12, speed: 720, radius: 6, life: 1.1,
    pierce: 0, range: 520, offset: 0, knockback: 0,
  },
  {
    id: 'bow', name: 'Longbow', blurb: 'Long range, pierces',
    melee: false, cooldown: 0.65, count: 1, damage: 40, speed: 1000, radius: 7, life: 1.0,
    pierce: 2, range: 700, offset: 0, knockback: 0,
  },
  {
    id: 'staff', name: 'Arcane Staff', blurb: 'Slow orbs that pass through foes',
    melee: false, cooldown: 0.85, count: 1, damage: 34, speed: 380, radius: 18, life: 1.5,
    pierce: 3, range: 480, offset: 0, knockback: 0,
  },
  {
    id: 'sword', name: 'Broadsword', blurb: 'Cleaves everything nearby',
    melee: true, cooldown: 0.5, count: 1, damage: 26, speed: 0, radius: 54, life: 0,
    pierce: 0, range: 100, offset: 38, knockback: 0,
  },
  {
    id: 'hammer', name: 'War Hammer', blurb: 'Slow, heavy, knocks back',
    melee: true, cooldown: 0.9, count: 1, damage: 90, speed: 0, radius: 90, life: 0,
    pierce: 0, range: 130, offset: 52, knockback: 34,
  },
];

export interface ArmorArchetype {
  id: string;
  name: string;
  hp: number;
  speedMul: number;
  innate: readonly EffectId[];
}

export const ARMORS: readonly ArmorArchetype[] = [
  { id: 'plate', name: 'Plate Armor', hp: 40, speedMul: 0.92, innate: [] },
  { id: 'mail', name: 'Chainmail', hp: 25, speedMul: 1, innate: [] },
  { id: 'leather', name: 'Leather Jerkin', hp: 10, speedMul: 1.08, innate: [] },
  { id: 'robe', name: 'Mystic Robe', hp: 0, speedMul: 1.04, innate: ['regen'] },
  { id: 'thornmail', name: 'Thornmail', hp: 20, speedMul: 0.95, innate: ['thorns'] },
  { id: 'aegis', name: 'Aegis Vest', hp: 15, speedMul: 1, innate: ['barrier'] },
];

export interface TrinketArchetype {
  id: string;
  name: string;
  /** The effect this trinket is built around. */
  effect: EffectId;
}

export const TRINKETS: readonly TrinketArchetype[] = [
  { id: 'twinfang', name: 'Twin Fang', effect: 'twin' },
  { id: 'ruby', name: 'Echoing Ruby', effect: 'echo' },
  { id: 'hourglass', name: 'Hourglass Shard', effect: 'haste' },
  { id: 'idol', name: 'Berserker Idol', effect: 'might' },
  { id: 'lodestone', name: 'Lodestone', effect: 'reach' },
  { id: 'vial', name: 'Venom Vial', effect: 'poison' },
  { id: 'ember', name: 'Ember Core', effect: 'burn' },
  { id: 'shard', name: 'Storm Shard', effect: 'shock' },
  { id: 'knuckle', name: 'Iron Knuckle', effect: 'knockback' },
  { id: 'tooth', name: 'Vampire Tooth', effect: 'lifesteal' },
  { id: 'bomb', name: 'Bomb Heart', effect: 'explosion' },
];

export const OFFENSIVE_EFFECTS: readonly EffectId[] = [
  'poison', 'burn', 'shock', 'knockback', 'lifesteal', 'explosion',
];
export const DEFENSIVE_EFFECTS: readonly EffectId[] = ['fortified', 'swift', 'regen', 'thorns', 'barrier'];
export const TRINKET_EFFECTS: readonly EffectId[] = [
  ...OFFENSIVE_EFFECTS, 'twin', 'echo', 'haste', 'might', 'reach',
];

/** How many extra effects an item rolls, by rarity. */
export const EXTRA_EFFECTS: Record<Slot, readonly number[]> = {
  weapon: [0, 1, 1, 2, 3],
  armor: [0, 0, 1, 1, 2],
  trinket: [0, 0, 1, 1, 2],
};

export function weaponById(id: string): WeaponArchetype {
  const w = WEAPONS.find((a) => a.id === id);
  if (!w) throw new Error(`Unknown weapon "${id}"`);
  return w;
}

export function armorById(id: string): ArmorArchetype {
  const a = ARMORS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown armor "${id}"`);
  return a;
}

export function trinketById(id: string): TrinketArchetype {
  const t = TRINKETS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown trinket "${id}"`);
  return t;
}
