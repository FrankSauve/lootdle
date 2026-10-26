/**
 * Turns a loadout into the flat numbers the simulation uses ("the build").
 * Effects from different items stack additively; a few multipliers are capped.
 */
import { armorById, fx, weaponById } from './items.ts';
import type { EffectId, Item } from './items.ts';
import type { Loadout } from './loot.ts';

const BASE_HP = 100;
const BASE_SPEED = 240;
const MAX_SPEED_MUL = 1.35;

export interface Build {
  // Weapon
  melee: boolean;
  cooldown: number;
  count: number;
  damage: number;
  projectileSpeed: number;
  projectileRadius: number;
  projectileLife: number;
  pierce: number;
  range: number;
  meleeRadius: number;
  meleeOffset: number;
  knockback: number;
  // Player
  maxHp: number;
  moveSpeed: number;
  damageTakenMul: number;
  regen: number;
  // Quirk mechanics
  bloodPrice: boolean;
  spread: number;
  // On-hit statuses
  poisonDps: number;
  poisonSecs: number;
  burnDps: number;
  burnSecs: number;
  shockFrac: number;
  shockTargets: number;
  shockRange: number;
  // Procs
  healKills: number;
  healAmount: number;
  explodeDamage: number;
  explodeRadius: number;
  thornsDamage: number;
  thornsRadius: number;
  barrierCooldown: number;
  echoEvery: number;
}

export function compileBuild(loadout: Loadout): Build {
  const w = weaponById(loadout.weapon.id);
  const armor = armorById(loadout.armor.id);

  const b: Build = {
    melee: w.melee,
    cooldown: w.cooldown,
    count: w.count,
    damage: w.damage * (1 + 0.05 * loadout.weapon.rarity),
    projectileSpeed: w.speed,
    projectileRadius: w.radius,
    projectileLife: w.life,
    pierce: w.pierce,
    range: w.range,
    meleeRadius: w.radius,
    meleeOffset: w.offset,
    knockback: w.knockback,
    maxHp: BASE_HP + armor.hp,
    moveSpeed: BASE_SPEED * armor.speedMul,
    damageTakenMul: 1,
    regen: 0,
    bloodPrice: false,
    spread: 0,
    poisonDps: 0,
    poisonSecs: 0,
    burnDps: 0,
    burnSecs: 0,
    shockFrac: 0,
    shockTargets: 0,
    shockRange: 0,
    healKills: 0,
    healAmount: 0,
    explodeDamage: 0,
    explodeRadius: 0,
    thornsDamage: 0,
    thornsRadius: 0,
    barrierCooldown: 0,
    echoEvery: 0,
  };

  // Multipliers collected across items, applied at the end.
  const m = { damage: 1, attackSpeed: 0, range: 1, swift: 0, hp: 1, slow: 1, clumsy: 1 };

  for (const item of [loadout.weapon, loadout.armor, loadout.trinket]) {
    for (const e of item.effects) applyEffect(b, m, e, item);
    applyQuirk(b, m, item);
  }

  b.damage *= m.damage;
  b.cooldown = (b.cooldown * m.clumsy) / (1 + m.attackSpeed);
  b.range *= m.range;
  b.meleeRadius *= 1 + (m.range - 1) * 0.5;
  b.meleeOffset *= m.range;
  b.maxHp = Math.max(1, Math.round(b.maxHp * m.hp));
  b.moveSpeed *= Math.min(MAX_SPEED_MUL, (1 + m.swift) * m.slow);
  return b;
}

interface Multipliers {
  damage: number;
  attackSpeed: number;
  range: number;
  swift: number;
  hp: number;
  slow: number;
  clumsy: number;
}

function applyEffect(b: Build, m: Multipliers, effect: EffectId, item: Item): void {
  const p = item.power;
  switch (effect) {
    case 'poison': {
      const v = fx.poison(p);
      b.poisonDps += v.dps;
      b.poisonSecs = Math.max(b.poisonSecs, v.secs);
      break;
    }
    case 'burn': {
      const v = fx.burn(p);
      b.burnDps += v.dps;
      b.burnSecs = Math.max(b.burnSecs, v.secs);
      break;
    }
    case 'shock': {
      const v = fx.shock(p);
      b.shockFrac += v.frac;
      b.shockTargets = Math.max(b.shockTargets, v.targets);
      b.shockRange = Math.max(b.shockRange, v.range);
      break;
    }
    case 'knockback':
      b.knockback += fx.knockback(p);
      break;
    case 'lifesteal': {
      const v = fx.lifesteal(p);
      b.healKills = b.healKills === 0 ? v.kills : Math.min(b.healKills, v.kills);
      b.healAmount += v.heal;
      break;
    }
    case 'explosion': {
      const v = fx.explosion(p);
      b.explodeDamage += v.damage;
      b.explodeRadius = Math.max(b.explodeRadius, v.radius);
      break;
    }
    case 'fortified':
      b.maxHp += fx.fortified(p);
      break;
    case 'swift':
      m.swift += fx.swift(p);
      break;
    case 'regen':
      b.regen += fx.regen(p);
      break;
    case 'thorns': {
      const v = fx.thorns(p);
      b.thornsDamage += v.damage;
      b.thornsRadius = Math.max(b.thornsRadius, v.radius);
      break;
    }
    case 'barrier': {
      const cd = fx.barrier(p);
      b.barrierCooldown = b.barrierCooldown === 0 ? cd : Math.min(b.barrierCooldown, cd);
      break;
    }
    case 'twin':
      b.count += fx.twin(p);
      break;
    case 'echo': {
      const every = fx.echo(p);
      b.echoEvery = b.echoEvery === 0 ? every : Math.min(b.echoEvery, every);
      break;
    }
    case 'haste':
      m.attackSpeed += fx.haste(p);
      break;
    case 'might':
      m.damage += fx.might(p);
      break;
    case 'reach': {
      const v = fx.reach(p);
      b.pierce += v.pierce;
      m.range += v.range;
      break;
    }
  }
}

function applyQuirk(b: Build, m: Multipliers, item: Item): void {
  switch (item.quirk) {
    case 'brittle':
      m.hp *= 0.8;
      break;
    case 'heavy':
      m.slow *= 0.85;
      break;
    case 'clumsy':
      m.clumsy *= 1.25;
      break;
    case 'fragile':
      b.damageTakenMul *= 1.3;
      break;
    case 'bloodPrice':
      b.bloodPrice = true;
      break;
    case 'jittery':
      b.spread = 0.3;
      break;
    case null:
      break;
  }
}
