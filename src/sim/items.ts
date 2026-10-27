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
  | 'reach'
  // Screen-fillers: can roll on weapons and trinkets.
  | 'barrage'
  | 'frenzy'
  | 'giant';

export type QuirkId = 'brittle' | 'heavy' | 'clumsy' | 'fragile' | 'bloodPrice' | 'jittery';

/** Loadout "flavor" families, used to name a build ("The Walking Plague"). */
export type Family = 'plague' | 'pyre' | 'tesla' | 'nuke' | 'leech' | 'pinball' | 'turtle' | 'blender' | 'runner' | 'apocalypse';

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
  /** A rule-bending special power (Rare and above sometimes roll one). */
  signature: SignatureId | null;
}

/** Power of an item's effects by rarity: Legendary is more than double a Common. */
export const RARITY_POWER: readonly number[] = [1, 1.15, 1.35, 1.7, 2.4];

/** What a weapon's rarity adds on top of its archetype and effects. Legendaries are monsters. */
export function weaponRarityBonus(r: number) {
  return {
    damage: [1, 1.05, 1.2, 1.5, 2.1][r]!,
    haste: [0, 0, 0.15, 0.4, 0.9][r]!,
    count: [0, 0, 0, 1, 3][r]!,
    size: [1, 1, 1.1, 1.25, 1.5][r]!,
  };
}

/** Effect numbers as a function of an item's power. Shared by the sim and the descriptions. */
export const fx = {
  poison: (m: number) => ({ dps: 8 * m, secs: 4 }),
  burn: (m: number) => ({ dps: 15 * m, secs: 2 }),
  shock: (m: number) => ({ frac: 0.6 * m, targets: m >= 1.5 ? 4 : 3, range: 150 }),
  knockback: (m: number) => 30 * m,
  lifesteal: (m: number) => ({ kills: 5, heal: Math.max(1, Math.round(3 * m)) }),
  explosion: (m: number) => ({ damage: 24 * m, radius: 68 }),
  fortified: (m: number) => Math.round(22 * m),
  swift: (m: number) => 0.07 * m,
  regen: (m: number) => 1.1 * m,
  thorns: (m: number) => ({ damage: 40 * m, radius: 100 }),
  barrier: (m: number) => 10 / m,
  twin: (m: number) => (m >= 1.5 ? 2 : 1),
  echo: (m: number) => Math.max(2, Math.round(7 - 2.4 * m)),
  haste: (m: number) => 0.2 * m,
  might: (m: number) => 0.25 * m,
  reach: (m: number) => ({ pierce: m >= 1.5 ? 2 : 1, range: 0.12 * m }),
  barrage: (m: number) => (m >= 2 ? 6 : m >= 1.5 ? 4 : 3),
  frenzy: (m: number) => 0.6 * m,
  giant: (m: number) => ({ range: 0.35 * m, size: 0.5 * m }),
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
  barrage: {
    label: 'Barrage',
    family: 'apocalypse',
    adjective: 'Barraging',
    text: (m) => `+${fx.barrage(m)} projectiles (or swings) per volley`,
  },
  frenzy: {
    label: 'Frenzy',
    family: 'apocalypse',
    adjective: 'Frenzied',
    text: (m) => `+${pct(fx.frenzy(m))} attack speed`,
  },
  giant: {
    label: 'Giant',
    family: 'apocalypse',
    adjective: 'Colossal',
    text: (m) => `+${pct(fx.giant(m).size)} size, +${pct(fx.giant(m).range)} range`,
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
  /** Projectiles in one volley fan out around the target, this many radians apart. */
  fan?: number;
  /** Projectiles explode on impact with this radius. */
  impact?: number;
  /** Random aim error in radians (sprays). */
  spread?: number;
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
  {
    id: 'gatling', name: 'Runic Gatling', blurb: 'A blur of rapid-fire bolts',
    melee: false, cooldown: 0.06, count: 1, damage: 7, speed: 900, radius: 5, life: 0.9,
    pierce: 0, range: 460, offset: 0, knockback: 0, spread: 0.1,
  },
  {
    id: 'scattergun', name: 'Hellshot Scattergun', blurb: 'A wide fan of nine shots',
    melee: false, cooldown: 0.8, count: 9, damage: 14, speed: 800, radius: 6, life: 0.55,
    pierce: 1, range: 380, offset: 0, knockback: 6, fan: 0.11,
  },
  {
    id: 'scythe', name: "Reaper's Scythe", blurb: 'A vast sweeping arc',
    melee: true, cooldown: 0.75, count: 1, damage: 46, speed: 0, radius: 150, life: 0,
    pierce: 0, range: 200, offset: 64, knockback: 0,
  },
  {
    id: 'gauntlet', name: 'Titan Gauntlet', blurb: 'Slams a huge ring around you',
    melee: true, cooldown: 1.3, count: 1, damage: 70, speed: 0, radius: 240, life: 0,
    pierce: 0, range: 240, offset: 0, knockback: 20,
  },
  {
    id: 'cannon', name: 'Meteor Cannon', blurb: 'Every shell detonates',
    melee: false, cooldown: 1.2, count: 1, damage: 55, speed: 560, radius: 20, life: 1.2,
    pierce: 0, range: 600, offset: 0, knockback: 0, impact: 120,
  },
  {
    id: 'discs', name: 'Razor Discs', blurb: 'Four spinning discs slice through crowds',
    melee: false, cooldown: 0.9, count: 4, damage: 22, speed: 500, radius: 14, life: 2.2,
    pierce: 14, range: 520, offset: 0, knockback: 0, fan: 0.45,
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
  { id: 'quiver', name: 'Quiver of Legion', effect: 'barrage' },
  { id: 'core', name: 'Overclock Core', effect: 'frenzy' },
  { id: 'colossus', name: 'Colossus Heart', effect: 'giant' },
];

export const OFFENSIVE_EFFECTS: readonly EffectId[] = [
  'poison', 'burn', 'shock', 'knockback', 'lifesteal', 'explosion',
];
export const DEFENSIVE_EFFECTS: readonly EffectId[] = ['fortified', 'swift', 'regen', 'thorns', 'barrier'];
/** Screen-fillers: huge volume, attack speed and size. */
export const APOCALYPSE_EFFECTS: readonly EffectId[] = ['barrage', 'frenzy', 'giant'];
export const WEAPON_EFFECTS: readonly EffectId[] = [...OFFENSIVE_EFFECTS, ...APOCALYPSE_EFFECTS];
export const TRINKET_EFFECTS: readonly EffectId[] = [
  ...OFFENSIVE_EFFECTS, 'twin', 'echo', 'haste', 'might', 'reach', ...APOCALYPSE_EFFECTS,
];

/** How many extra effects an item rolls, by rarity. */
export const EXTRA_EFFECTS: Record<Slot, readonly number[]> = {
  weapon: [1, 1, 2, 3, 4],
  armor: [0, 1, 1, 2, 3],
  trinket: [0, 0, 1, 2, 3],
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

// ---------------------------------------------------------------------------------------------
// Signatures: special powers that bend the rules. Rare+ items sometimes roll one.

export type SignatureId =
  | 'ricochet'
  | 'nova'
  | 'executioner'
  | 'berserker'
  | 'orbit'
  | 'phoenix'
  | 'scorch'
  | 'bastion'
  | 'plague'
  | 'bloodsplosion'
  | 'tesla'
  | 'vortex'
  | 'meteors'
  | 'stormcaller'
  | 'bladestorm'
  | 'splinter'
  | 'furyEngine'
  | 'colossus';

/** Numbers for each signature as a function of the item's power. */
export const sx = {
  ricochet: (m: number) => (m >= 1.5 ? 3 : 2),
  nova: (m: number) => (m >= 1.5 ? 4 : 5),
  execute: (m: number) => (m >= 1.5 ? 0.3 : 0.22),
  berserker: (m: number) => m,
  orbit: (m: number) => ({ blades: m >= 1.5 ? 4 : 3, dps: 32 * m, radius: 78 }),
  phoenix: (m: number) => ({ heal: m >= 1.5 ? 0.75 : 0.5, damage: 200 * m, radius: 240 }),
  scorch: (m: number) => ({ dps: 16 * m, radius: 100 }),
  bastion: (m: number) => (m >= 1.5 ? 0.4 : 0.5),
  plague: (m: number) => ({ damage: 34 * m, radius: 85 }),
  bloodsplosion: (m: number) => (m >= 1.5 ? 2 : 1),
  tesla: (m: number) => (m >= 1.5 ? 4 : 3),
  vortex: (m: number) => ({ every: m >= 1.5 ? 6 : 8, damage: 60 * m, pull: 340 }),
  meteors: (m: number) => ({ every: m >= 2 ? 0.9 : m >= 1.5 ? 1.3 : 1.8, count: m >= 2 ? 16 : m >= 1.5 ? 9 : 6, damage: 55 * m, radius: m >= 2 ? 120 : 92 }),
  stormcaller: (m: number) => ({ every: m >= 2 ? 0.6 : 1, targets: m >= 2 ? 20 : m >= 1.5 ? 12 : 7, damage: 50 * m, range: 750 }),
  bladestorm: (m: number) => ({ blades: m >= 1.5 ? 8 : 6, dps: 60 * m, radius: m >= 2 ? 170 : 125 }),
  splinter: (m: number) => (m >= 1.5 ? 4 : 2),
  furyEngine: (m: number) => ({ haste: 1.2 * m, damage: 0.7 }),
  colossus: (m: number) => ({ range: 0.6 * m, size: 0.8 * m, damage: 1.15 }),
};

export interface SignatureDef {
  title: string;
  /** Replaces the item's name prefix, e.g. "Executioner's Longbow". */
  prefix: string;
  slots: readonly Slot[];
  /** Effects this power needs to work; they are added to the item when it rolls. */
  implies: readonly EffectId[];
  /** Doesn't make sense on melee weapons. */
  projectileOnly?: boolean;
  text: (m: number) => string;
}

export const SIGNATURES: Record<SignatureId, SignatureDef> = {
  ricochet: {
    title: 'Ricochet', prefix: 'Ricochet', slots: ['weapon'], implies: [], projectileOnly: true,
    text: (m) => `Shots bounce between ${sx.ricochet(m)} extra enemies`,
  },
  nova: {
    title: 'Nova', prefix: 'Nova', slots: ['weapon'], implies: [],
    text: (m) => `Every ${sx.nova(m)}th attack unleashes a nova in all directions`,
  },
  executioner: {
    title: 'Executioner', prefix: "Executioner's", slots: ['weapon'], implies: [],
    text: (m) => `Hits instantly finish enemies below ${pct(sx.execute(m))} HP`,
  },
  berserker: {
    title: 'Berserker', prefix: "Berserker's", slots: ['weapon'], implies: [],
    text: (m) => `Up to +${pct(sx.berserker(m))} damage as your HP drops`,
  },
  orbit: {
    title: 'Whirling Blades', prefix: 'Whirling', slots: ['weapon'], implies: [],
    text: (m) => `${sx.orbit(m).blades} blades orbit you, ${n(sx.orbit(m).dps)}/s each`,
  },
  phoenix: {
    title: 'Phoenix Heart', prefix: 'Phoenix', slots: ['armor'], implies: [],
    text: (m) => `Once per run, death revives you at ${pct(sx.phoenix(m).heal)} HP with a huge blast`,
  },
  scorch: {
    title: 'Scorching Aura', prefix: 'Scorching', slots: ['armor'], implies: [],
    text: (m) => `Enemies near you burn for ${n(sx.scorch(m).dps)}/s`,
  },
  bastion: {
    title: 'Bastion', prefix: 'Bastion', slots: ['armor'], implies: [],
    text: (m) => `Take ${pct(1 - sx.bastion(m))} less damage while standing still`,
  },
  plague: {
    title: 'Plague Bearer', prefix: 'Plague-Bearer\'s', slots: ['trinket'], implies: ['poison'],
    text: (m) => `Poisoned enemies burst for ${n(sx.plague(m).damage)} when they die`,
  },
  bloodsplosion: {
    title: 'Bloodburst', prefix: 'Bloodburst', slots: ['trinket'], implies: ['explosion'],
    text: (m) => `Explosions heal ${sx.bloodsplosion(m)} HP per enemy hit (up to 6)`,
  },
  tesla: {
    title: 'Tesla Storm', prefix: 'Tesla', slots: ['trinket'], implies: ['shock'],
    text: (m) => `Shock arcs jump ${sx.tesla(m)} more times`,
  },
  vortex: {
    title: 'Black Hole', prefix: 'Void', slots: ['trinket'], implies: [],
    text: (m) => `Every ${sx.vortex(m).every}s, drags enemies in and blasts them`,
  },
  meteors: {
    title: 'Meteor Shower', prefix: 'Falling', slots: ['weapon', 'trinket'], implies: [],
    text: (m) =>
      `Every ${sx.meteors(m).every}s, ${sx.meteors(m).count} meteors crash onto enemies (${n(sx.meteors(m).damage)} dmg). ` +
      `They carry your poison and fire`,
  },
  stormcaller: {
    title: 'Stormcaller', prefix: 'Thunderous', slots: ['trinket', 'armor'], implies: [],
    text: (m) =>
      `Every second, lightning strikes ${sx.stormcaller(m).targets} foes across the screen (${n(sx.stormcaller(m).damage)} dmg)`,
  },
  bladestorm: {
    title: 'Bladestorm', prefix: 'Storming', slots: ['weapon', 'trinket'], implies: [],
    text: (m) =>
      `${sx.bladestorm(m).blades} huge blades whirl around you, ${n(sx.bladestorm(m).dps)}/s each. They carry your poison and fire`,
  },
  splinter: {
    title: 'Splinter', prefix: 'Splintering', slots: ['weapon'], implies: [], projectileOnly: true,
    text: (m) => `Every hit bursts into ${sx.splinter(m)} fragments`,
  },
  furyEngine: {
    title: 'Fury Engine', prefix: 'Furious', slots: ['weapon'], implies: [],
    text: (m) => `+${pct(sx.furyEngine(m).haste)} attack speed, but -30% damage`,
  },
  colossus: {
    title: 'Colossus', prefix: 'Colossal', slots: ['weapon'], implies: [],
    text: (m) => `+${pct(sx.colossus(m).range)} range, +${pct(sx.colossus(m).size)} size, +15% damage`,
  },
};

// ---------------------------------------------------------------------------------------------
// Synergies: combinations of effects across your gear that unlock new behavior automatically.

export type SynergyId =
  | 'plagueBlast'
  | 'napalm'
  | 'concussive'
  | 'toxicStorm'
  | 'plasma'
  | 'bloodNova'
  | 'stormWard';

export interface SynergyDef {
  title: string;
  text: string;
  /** Every group needs at least one of its effects somewhere on your gear. */
  needs: readonly (readonly EffectId[])[];
}

export const SYNERGIES: Record<SynergyId, SynergyDef> = {
  plagueBlast: {
    title: 'Plague Detonation',
    text: 'Poisoned kills explode harder and spread poison',
    needs: [['poison'], ['explosion']],
  },
  napalm: {
    title: 'Napalm',
    text: 'Explosions ignite everything they hit',
    needs: [['burn'], ['explosion']],
  },
  concussive: {
    title: 'Concussive Blast',
    text: 'Explosions hurl enemies away',
    needs: [['knockback'], ['explosion']],
  },
  toxicStorm: {
    title: 'Toxic Storm',
    text: 'Shock arcs poison their targets',
    needs: [['poison'], ['shock']],
  },
  plasma: {
    title: 'Plasma Arc',
    text: 'Shock arcs ignite their targets',
    needs: [['burn'], ['shock']],
  },
  bloodNova: {
    title: 'Blood Nova',
    text: 'Explosions heal you for each enemy they hit',
    needs: [['lifesteal'], ['explosion']],
  },
  stormWard: {
    title: 'Storm Ward',
    text: 'Getting hit calls lightning down on nearby enemies',
    needs: [['shock'], ['barrier', 'thorns']],
  },
};

/** Even a Common can roll a signature: a humble item with a wild power is the fun surprise. */
export const SIGNATURE_CHANCE: readonly number[] = [0.08, 0.12, 0.3, 0.7, 1];
