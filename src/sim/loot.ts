/**
 * Daily loot generation. One weapon, one armor and one trinket, rolled from a seed.
 * Pure and deterministic: the same seed always gives the same loadout, on every machine.
 */
import {
  ARMORS,
  DEFENSIVE_EFFECTS,
  EFFECTS,
  EXTRA_EFFECTS,
  WEAPON_EFFECTS,
  QUIRKS,
  RARITY_NAMES,
  RARITY_POWER,
  RARITY_WEIGHTS,
  SIGNATURES,
  SIGNATURE_CHANCE,
  SYNERGIES,
  TRINKETS,
  TRINKET_EFFECTS,
  WEAPONS,
  armorById,
  weaponById,
  weaponRarityBonus,
} from './items.ts';
import type { EffectId, Family, Item, QuirkId, Rarity, SignatureId, Slot, SynergyId } from './items.ts';
import { createRng, hashSeed } from './rng.ts';
import type { Rng } from './rng.ts';

export interface Loadout {
  seed: number;
  weapon: Item;
  armor: Item;
  trinket: Item;
  /** Fun name for the whole build, e.g. "The Walking Plague". */
  buildName: string;
  family: Family;
  /** Combinations across your gear that unlock extra behavior. */
  synergies: SynergyId[];
  /** Highest rarity among the three items (for flair; never used to rank runs). */
  bestRarity: Rarity;
}

const QUIRK_CHANCE = 0.25;
/** Items with a drawback are a little stronger, so a quirk is a trade and not a pure penalty. */
const QUIRK_POWER_BONUS = 1.2;
const SUFFIXES = ['of Ruin', 'of the Void', 'of Embers', 'of the Swarm', 'of the Deep', 'of Whispers'];

const BUILD_NAMES: Record<Family, string> = {
  plague: 'The Walking Plague',
  pyre: 'The Walking Bonfire',
  tesla: 'The Tesla Coil',
  nuke: 'The Nuclear Chain Reaction',
  leech: 'The Crimson Leech',
  pinball: 'The Pinball Wizard',
  turtle: 'The Immortal Turtle',
  blender: 'The Living Blender',
  runner: 'The Slippery Eel',
  apocalypse: 'The Screen Eraser',
};
/** Order used to break ties between families. */
const FAMILY_ORDER: readonly Family[] = [
  'plague', 'pyre', 'tesla', 'nuke', 'leech', 'pinball', 'turtle', 'blender', 'runner', 'apocalypse',
];

export function generateLoadout(playerSeed: number): Loadout {
  // Its own stream, so loot never depends on (or disturbs) the run's upgrade stream.
  const rng = createRng(hashSeed(`loot:${playerSeed >>> 0}`));

  const weapon = rollWeapon(rng);
  const armor = rollArmor(rng);
  const trinket = rollTrinket(rng);

  const items = [weapon, armor, trinket];
  const bestRarity = Math.max(weapon.rarity, armor.rarity, trinket.rarity) as Rarity;
  const { family, buildName } = nameBuild(items);
  const synergies = findSynergies(items);
  return { seed: playerSeed >>> 0, weapon, armor, trinket, buildName, family, synergies, bestRarity };
}

function rollWeapon(rng: Rng): Item {
  const base = pick(rng, WEAPONS);
  const rarity = rollRarity(rng);
  const effects = pickDistinct(rng, WEAPON_EFFECTS, EXTRA_EFFECTS.weapon[rarity]!, []);
  return finishItem(rng, 'weapon', base.id, base.name, rarity, effects, base.melee);
}

function rollArmor(rng: Rng): Item {
  const base = pick(rng, ARMORS);
  const rarity = rollRarity(rng);
  const extras = pickDistinct(rng, DEFENSIVE_EFFECTS, EXTRA_EFFECTS.armor[rarity]!, base.innate);
  return finishItem(rng, 'armor', base.id, base.name, rarity, [...base.innate, ...extras]);
}

function rollTrinket(rng: Rng): Item {
  const base = pick(rng, TRINKETS);
  const rarity = rollRarity(rng);
  const extras = pickDistinct(rng, TRINKET_EFFECTS, EXTRA_EFFECTS.trinket[rarity]!, [base.effect]);
  return finishItem(rng, 'trinket', base.id, base.name, rarity, [base.effect, ...extras]);
}

/** Rolls the quirk and builds the display name. */
function finishItem(
  rng: Rng,
  slot: Slot,
  id: string,
  baseName: string,
  rarity: Rarity,
  effects: EffectId[],
  melee = false,
): Item {
  // Signature: Rare+ items sometimes carry a rule-bending power (and the effects it relies on).
  let signature: SignatureId | null = null;
  const sigRoll = rng();
  const sigPick = rng();
  if (sigRoll < SIGNATURE_CHANCE[rarity]!) {
    const options = (Object.keys(SIGNATURES) as SignatureId[]).filter((s) => {
      const def = SIGNATURES[s];
      return def.slots.includes(slot) && !(melee && def.projectileOnly);
    });
    signature = options[Math.floor(sigPick * options.length)] ?? null;
  }
  if (signature) {
    for (const e of SIGNATURES[signature].implies) if (!effects.includes(e)) effects = [...effects, e];
  }

  let quirk: QuirkId | null = null;
  const quirkRoll = rng();
  const quirkPick = rng();
  if (quirkRoll < QUIRK_CHANCE) {
    const options = (Object.keys(QUIRKS) as QuirkId[]).filter((q) => QUIRKS[q].slots.includes(slot));
    quirk = options[Math.floor(quirkPick * options.length)]!;
  }
  const suffixRoll = rng();

  // Name: a quirk prefix wins over an effect adjective; high rarities add a flavorful suffix.
  // Only effects that were rolled as affixes name the item (not its defining innate effect).
  const innateCount = slot === 'armor' ? armorById(id).innate.length : slot === 'trinket' ? 1 : 0;
  const rolled = effects.slice(innateCount);
  const adjective = rolled.length > 0 ? EFFECTS[rolled[0]!].adjective : null;
  const prefix = signature ? SIGNATURES[signature].prefix : quirk ? QUIRKS[quirk].prefix : adjective;
  let name = prefix ? `${prefix} ${baseName}` : baseName;
  if (rarity >= 3) name += ` ${SUFFIXES[Math.floor(suffixRoll * SUFFIXES.length)]!}`;

  const power = RARITY_POWER[rarity]! * (quirk ? QUIRK_POWER_BONUS : 1);
  return { slot, id, name, rarity, power, effects, quirk, signature };
}

function rollRarity(rng: Rng): Rarity {
  const total = RARITY_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let r = 0; r < RARITY_WEIGHTS.length; r++) {
    roll -= RARITY_WEIGHTS[r]!;
    if (roll < 0) return r as Rarity;
  }
  return 0;
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

/** Picks `count` different entries from `pool`, skipping anything in `exclude`. */
function pickDistinct(
  rng: Rng,
  pool: readonly EffectId[],
  count: number,
  exclude: readonly EffectId[],
): EffectId[] {
  const left = pool.filter((e) => !exclude.includes(e));
  const out: EffectId[] = [];
  for (let k = 0; k < count && left.length > 0; k++) {
    const i = Math.floor(rng() * left.length);
    out.push(left[i]!);
    left.splice(i, 1);
  }
  return out;
}

/** Which synergies are active, given every effect on all three items. */
export function findSynergies(items: readonly Item[]): SynergyId[] {
  const have = new Set<EffectId>(items.flatMap((i) => i.effects));
  return (Object.keys(SYNERGIES) as SynergyId[]).filter((id) =>
    SYNERGIES[id].needs.every((group) => group.some((e) => have.has(e))),
  );
}

function nameBuild(items: readonly Item[]): { family: Family; buildName: string } {
  const score = new Map<Family, number>();
  const screenFillers: readonly (SignatureId | null)[] = [
    'meteors', 'stormcaller', 'bladestorm', 'splinter', 'furyEngine', 'colossus',
  ];
  for (const item of items) {
    for (const e of item.effects) {
      const f = EFFECTS[e].family;
      score.set(f, (score.get(f) ?? 0) + 1);
    }
    if (screenFillers.includes(item.signature)) score.set('apocalypse', (score.get('apocalypse') ?? 0) + 2);
  }
  let family: Family = FAMILY_ORDER[0]!;
  let best = -1;
  for (const f of FAMILY_ORDER) {
    const s = score.get(f) ?? 0;
    if (s > best) {
      best = s;
      family = f;
    }
  }

  const quirks = items.map((i) => i.quirk).filter((q): q is QuirkId => q !== null);
  const fragile = quirks.includes('brittle') || quirks.includes('fragile');
  if (fragile && quirks.includes('bloodPrice')) return { family, buildName: 'The One-HP Menace' };
  const base = BUILD_NAMES[family];
  return { family, buildName: quirks.length >= 2 ? base.replace('The ', 'The Cursed ') : base };
}

/** Human-readable lines for the loot cards. */
export interface ItemDescription {
  stats: string[];
  /** The signature power, if any. */
  signature: { title: string; text: string } | null;
  effects: string[];
  drawback: string | null;
}

export function describeItem(item: Item): ItemDescription {
  const stats: string[] = [];
  if (item.slot === 'weapon') {
    const w = weaponById(item.id);
    const bonus = weaponRarityBonus(item.rarity);
    const dmg = Math.round(w.damage * bonus.damage);
    stats.push(w.melee ? `${dmg} damage, hits an area` : `${dmg} damage x${w.count}`);
    if (w.melee && w.range >= 190) stats.push('Enormous reach');
    stats.push(w.cooldown < 0.2 ? `${Math.round(1 / w.cooldown)} shots per second` : `Strikes every ${w.cooldown}s`);
    if (w.fan) stats.push('Fires in a wide fan');
    if (w.impact) stats.push('Shots explode on impact');
    if (w.knockback > 0) stats.push(`Built-in knockback`);
    if (item.rarity >= 3) {
      stats.push(
        `${RARITY_NAMES[item.rarity]} might: +${Math.round(bonus.haste * 100)}% attack speed, +${bonus.count} ${w.melee ? 'swings' : 'projectiles'}, ` +
          `${Math.round((bonus.size - 1) * 100)}% bigger`,
      );
    }
  } else if (item.slot === 'armor') {
    const a = armorById(item.id);
    if (a.hp > 0) stats.push(`+${a.hp} max HP`);
    if (a.speedMul !== 1) {
      const p = Math.round((a.speedMul - 1) * 100);
      stats.push(`${p > 0 ? '+' : ''}${p}% move speed`);
    }
  }
  const effects = item.effects.map((e) => EFFECTS[e].text(item.power));
  const drawback = item.quirk ? `${QUIRKS[item.quirk].label}: ${QUIRKS[item.quirk].text}` : null;
  const sig = item.signature ? SIGNATURES[item.signature] : null;
  const signature = sig && item.signature ? { title: sig.title, text: sig.text(item.power) } : null;
  return { stats, signature, effects, drawback };
}
