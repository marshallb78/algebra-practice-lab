import { EggRarity, FoodId, PetInstance, SkinRarity } from '../types/game';
import { getDailyItemShopRotation, ITEM_SHOP_SKINS } from './season2Skins';

export interface EggHatchPoolEntry {
  speciesId: string;
  chancePct: number;
  weight: number;
}

export interface PetSpeciesDefinition {
  speciesId: string;
  name: string;
  rarityLabel: SkinRarity;
  baseEggRarity: EggRarity;
  tierOrder: number;
  baseMultiplierBonus: number;
  baseDps: number;
  color: string;
  glowColor: string;
  petImage: string;
  description: string;
}

export interface EggDefinition {
  rarity: EggRarity;
  speciesId: string;
  petName: string;
  hatchGemCost: number;
  dropWeight: number;
  baseMultiplierBonus: number;
  petBaseDps: number;
  color: string;
  glowColor: string;
  eggImage: string;
  petImage: string;
  description: string;
  hatchPool: EggHatchPoolEntry[];
}

export const PET_SPECIES_CATALOG: PetSpeciesDefinition[] = [
  {
    speciesId: 'frost_pup',
    name: 'Frost Pup',
    rarityLabel: 'Common',
    baseEggRarity: 'Common Egg',
    tierOrder: 0,
    baseMultiplierBonus: 0.15,
    baseDps: 3.5,
    color: '#38bdf8',
    glowColor: 'rgba(56,189,248,0.55)',
    petImage: './images/s2/pets/frost_pup_1.png',
    description: 'Loyal Arctic Husky that guards the homestead fence and snaps at zombie scouts.',
  },
  {
    speciesId: 'ice_cub',
    name: 'Ice Cub',
    rarityLabel: 'Uncommon',
    baseEggRarity: 'Common Egg',
    tierOrder: 1,
    baseMultiplierBonus: 0.28,
    baseDps: 7.2,
    color: '#2dd4bf',
    glowColor: 'rgba(45,212,191,0.62)',
    petImage: './images/s2/pets/ice_cub_1.png',
    description: 'Frost-armored polar brawler smashing undead ankles with frozen paw slams.',
  },
  {
    speciesId: 'aurora_fox',
    name: 'Snow Fox',
    rarityLabel: 'Rare',
    baseEggRarity: 'Rare Egg',
    tierOrder: 2,
    baseMultiplierBonus: 0.42,
    baseDps: 11,
    color: '#22d3ee',
    glowColor: 'rgba(34,211,238,0.64)',
    petImage: './images/s2/pets/aurora_fox_1.png',
    description: 'Agile glacier kitsune slashing zombie waves with luminous twin frost tails.',
  },
  {
    speciesId: 'snow_owl',
    name: 'Snow Owl',
    rarityLabel: 'Super Rare',
    baseEggRarity: 'Rare Egg',
    tierOrder: 3,
    baseMultiplierBonus: 0.72,
    baseDps: 20,
    color: '#60a5fa',
    glowColor: 'rgba(96,165,250,0.68)',
    petImage: './images/s2/pets/snow_owl_1.png',
    description: 'Super-rare blizzard raptor swooping from above with razor icicle talons.',
  },
  {
    speciesId: 'blizzard_golem',
    name: 'Glacier Golem',
    rarityLabel: 'Epic',
    baseEggRarity: 'Epic Egg',
    tierOrder: 4,
    baseMultiplierBonus: 0.92,
    baseDps: 27,
    color: '#a855f7',
    glowColor: 'rgba(168,85,247,0.68)',
    petImage: './images/s2/pets/blizzard_golem_1.png',
    description: 'Runed permafrost colossus shattering armored undead hordes on impact.',
  },
  {
    speciesId: 'glacier_wolf',
    name: 'Glacier Wolf',
    rarityLabel: 'Super Rare',
    baseEggRarity: 'Epic Egg',
    tierOrder: 5,
    baseMultiplierBonus: 1.25,
    baseDps: 38,
    color: '#818cf8',
    glowColor: 'rgba(129,140,248,0.72)',
    petImage: './images/s2/pets/glacier_wolf_1.png',
    description: 'Super-rare alpha frosthound shredding giant zombies with sub-zero fangs.',
  },
  {
    speciesId: 'crystal_stag',
    name: 'Crystal Stag',
    rarityLabel: 'Ultra Rare',
    baseEggRarity: 'Epic Egg',
    tierOrder: 6,
    baseMultiplierBonus: 1.75,
    baseDps: 56,
    color: '#ec4899',
    glowColor: 'rgba(236,72,153,0.76)',
    petImage: './images/s2/pets/crystal_stag_1.png',
    description: 'Ultra-rare prism-antlered guardian channeling dazzling aurora beams.',
  },
  {
    speciesId: 'cryo_wyvern',
    name: 'Cryo Wyvern',
    rarityLabel: 'Legendary',
    baseEggRarity: 'Legendary Egg',
    tierOrder: 7,
    baseMultiplierBonus: 2.2,
    baseDps: 78,
    color: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.76)',
    petImage: './images/s2/pets/cryo_wyvern_1.png',
    description: 'Winged frost drake sweeping sub-zero flames across approaching hordes.',
  },
  {
    speciesId: 'frost_phoenix',
    name: 'Frost Phoenix',
    rarityLabel: 'Mythic',
    baseEggRarity: 'Mythic Egg',
    tierOrder: 8,
    baseMultiplierBonus: 3.8,
    baseDps: 185,
    color: '#f43f5e',
    glowColor: 'rgba(244,63,94,0.84)',
    petImage: './images/s2/pets/frost_phoenix_1.png',
    description: 'Mythic aurora firebird unleashing searing absolute-zero shockwaves.',
  },
  {
    speciesId: 'celestial_warden',
    name: 'Celestial Warden',
    rarityLabel: 'Celestial',
    baseEggRarity: 'Mythic Egg',
    tierOrder: 9,
    baseMultiplierBonus: 8.5,
    baseDps: 480,
    color: '#e879f9',
    glowColor: 'rgba(232,121,249,0.92)',
    petImage: './images/s2/pets/celestial_warden_1.png',
    description: 'ULTRA-SECRET CELESTIAL TITAN! Obliterates boss zombies with cosmic starfrost.',
  },
];

export const PET_IMAGE_MAP: Record<string, string> = Object.fromEntries(
  PET_SPECIES_CATALOG.map((s) => [s.speciesId, s.petImage])
);

const VALID_SPECIES_SET = new Set<string>(PET_SPECIES_CATALOG.map((s) => s.speciesId));

const LEGACY_RARITY_ALIAS: Record<string, EggRarity> = {
  'Common Egg': 'Common Egg',
  'Uncommon Egg': 'Common Egg',
  'Rare Egg': 'Rare Egg',
  'Super Rare Egg': 'Rare Egg',
  'Epic Egg': 'Epic Egg',
  'Ultra Rare Egg': 'Epic Egg',
  'Legendary Egg': 'Legendary Egg',
  'Divine Egg': 'Legendary Egg',
  'Mythic Egg': 'Mythic Egg',
  'Celestial Egg': 'Mythic Egg',
};

export function normalizeEggRarity(raw?: string | null): EggRarity {
  if (raw && raw in LEGACY_RARITY_ALIAS) {
    return LEGACY_RARITY_ALIAS[raw];
  }
  return 'Common Egg';
}

export function normalizePetSpeciesId(raw?: string | null): string {
  if (raw && VALID_SPECIES_SET.has(raw)) {
    return raw;
  }
  return 'frost_pup';
}

export function getPetSpeciesDefinition(
  speciesId?: string | null,
  fallbackRarity: EggRarity = 'Common Egg'
): PetSpeciesDefinition {
  if (speciesId && VALID_SPECIES_SET.has(speciesId)) {
    const found = PET_SPECIES_CATALOG.find((s) => s.speciesId === speciesId);
    if (found) return found;
  }
  const fallbackDef = getEggDefinition(fallbackRarity);
  return (
    PET_SPECIES_CATALOG.find((s) => s.speciesId === fallbackDef.speciesId) ||
    PET_SPECIES_CATALOG[0]
  );
}

export function getPetImage(speciesId: string): string {
  const canonical = normalizePetSpeciesId(speciesId);
  return `./images/s2/pets/${canonical}_1.png`;
}

export function getPetAnimationFrames(speciesId: string): string[] {
  const canonical = normalizePetSpeciesId(speciesId);
  return [1, 2, 3, 4].map((f) => `./images/s2/pets/${canonical}_${f}.png`);
}

export const EGG_DEFINITIONS: EggDefinition[] = [
  {
    rarity: 'Common Egg',
    speciesId: 'frost_pup',
    petName: 'Frost Pup',
    hatchGemCost: 3,
    dropWeight: 56,
    baseMultiplierBonus: 0.15,
    petBaseDps: 3.5,
    color: '#38bdf8',
    glowColor: 'rgba(56,189,248,0.55)',
    eggImage: './images/s2/eggs/common.png',
    petImage: './images/s2/pets/frost_pup_1.png',
    description: 'Loyal Arctic Husky — with a rare chance to hatch the Uncommon Ice Cub!',
    hatchPool: [
      { speciesId: 'frost_pup', chancePct: 84, weight: 84 },
      { speciesId: 'ice_cub', chancePct: 16, weight: 16 },
    ],
  },
  {
    rarity: 'Rare Egg',
    speciesId: 'aurora_fox',
    petName: 'Snow Fox',
    hatchGemCost: 8,
    dropWeight: 24,
    baseMultiplierBonus: 0.42,
    petBaseDps: 11,
    color: '#22d3ee',
    glowColor: 'rgba(34,211,238,0.62)',
    eggImage: './images/s2/eggs/rare.png',
    petImage: './images/s2/pets/aurora_fox_1.png',
    description: 'Glacier Fox, Super-Rare Snow Owl, or Alpha Glacier Wolf!',
    hatchPool: [
      { speciesId: 'aurora_fox', chancePct: 70, weight: 70 },
      { speciesId: 'snow_owl', chancePct: 22, weight: 22 },
      { speciesId: 'glacier_wolf', chancePct: 8, weight: 8 },
    ],
  },
  {
    rarity: 'Epic Egg',
    speciesId: 'blizzard_golem',
    petName: 'Glacier Golem',
    hatchGemCost: 18,
    dropWeight: 12,
    baseMultiplierBonus: 0.92,
    petBaseDps: 27,
    color: '#a855f7',
    glowColor: 'rgba(168,85,247,0.65)',
    eggImage: './images/s2/eggs/epic.png',
    petImage: './images/s2/pets/blizzard_golem_1.png',
    description: 'Permafrost Colossus — or hatch Super-Rare Wolf / Ultra-Rare Crystal Stag!',
    hatchPool: [
      { speciesId: 'blizzard_golem', chancePct: 72, weight: 72 },
      { speciesId: 'glacier_wolf', chancePct: 17, weight: 17 },
      { speciesId: 'crystal_stag', chancePct: 11, weight: 11 },
    ],
  },
  {
    rarity: 'Legendary Egg',
    speciesId: 'cryo_wyvern',
    petName: 'Cryo Wyvern',
    hatchGemCost: 40,
    dropWeight: 6,
    baseMultiplierBonus: 2.2,
    petBaseDps: 78,
    color: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.72)',
    eggImage: './images/s2/eggs/legendary.png',
    petImage: './images/s2/pets/cryo_wyvern_1.png',
    description: 'Frost Drake with rare Mythic Phoenix & 1.5% Secret Celestial Warden odds!',
    hatchPool: [
      { speciesId: 'cryo_wyvern', chancePct: 76, weight: 76 },
      { speciesId: 'crystal_stag', chancePct: 15, weight: 15 },
      { speciesId: 'frost_phoenix', chancePct: 7.5, weight: 7.5 },
      { speciesId: 'celestial_warden', chancePct: 1.5, weight: 1.5 },
    ],
  },
  {
    rarity: 'Mythic Egg',
    speciesId: 'frost_phoenix',
    petName: 'Frost Phoenix',
    hatchGemCost: 85,
    dropWeight: 2,
    baseMultiplierBonus: 3.8,
    petBaseDps: 185,
    color: '#f43f5e',
    glowColor: 'rgba(244,63,94,0.82)',
    eggImage: './images/s2/eggs/mythic.png',
    petImage: './images/s2/pets/frost_phoenix_1.png',
    description: 'Mythic Aurora Firebird or 15% Secret Celestial Warden god-tier titan!',
    hatchPool: [
      { speciesId: 'frost_phoenix', chancePct: 85, weight: 85 },
      { speciesId: 'celestial_warden', chancePct: 15, weight: 15 },
    ],
  },
];

export const EGG_RARITY_ORDER: EggRarity[] = EGG_DEFINITIONS.map((e) => e.rarity);

export function rollHatchedPetSpecies(
  rarity: EggRarity,
  rng: () => number = Math.random
): PetSpeciesDefinition {
  const eggDef = getEggDefinition(rarity);
  const pool = eggDef.hatchPool;
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * totalWeight;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) {
      return getPetSpeciesDefinition(entry.speciesId, rarity);
    }
  }
  return getPetSpeciesDefinition(pool[0]?.speciesId || eggDef.speciesId, rarity);
}

export interface FoodDefinition {
  id: FoodId;
  name: string;
  image: string;
  hungerRestore: number;
  gemCost: number;
  description: string;
}

/** Feeding was removed in Season 2 polish; kept empty/minimal for save compatibility. */
export const FOOD_DEFINITIONS: FoodDefinition[] = [];

export function createDefaultFoodInventory(): Record<FoodId, number> {
  return {
    apple: 0,
    potato: 0,
    cookie: 0,
    fries: 0,
    strawberry: 0,
    chocolate: 0,
    ice_treat: 0,
    fish: 0,
    burger: 0,
    pizza: 0,
    turkey: 0,
    steak: 0,
  };
}

export function createEmptySealedEggs(): Record<EggRarity, number> {
  return {
    'Common Egg': 0,
    'Uncommon Egg': 0,
    'Rare Egg': 0,
    'Super Rare Egg': 0,
    'Epic Egg': 0,
    'Ultra Rare Egg': 0,
    'Legendary Egg': 0,
    'Mythic Egg': 0,
    'Divine Egg': 0,
    'Celestial Egg': 0,
  };
}

export function getEggDefinition(rarity: EggRarity): EggDefinition {
  const normalized = normalizeEggRarity(rarity);
  return EGG_DEFINITIONS.find((e) => e.rarity === normalized) || EGG_DEFINITIONS[0];
}

export function getPetUpgradeGemCost(pet: PetInstance): number {
  const spec = getPetSpeciesDefinition(pet.speciesId, pet.rarity);
  const lvl = Math.max(1, Math.floor(pet.level || 1));
  const tierFactor = 1 + spec.tierOrder * 0.25;
  return Math.max(4, Math.floor(5 * lvl * tierFactor));
}

/**
 * Pets never require feeding — they always battle at full strength!
 */
export function getPetHungerEffectiveness(_hunger: number): number {
  return 1.0;
}

export function getPetClickMultiplierBonus(pet: PetInstance): number {
  const spec = getPetSpeciesDefinition(pet.speciesId, pet.rarity);
  const lvl = Math.max(1, pet.level || 1);
  const levelScale = 1 + (lvl - 1) * 0.55 + Math.max(0, lvl - 5) * 0.25;
  return Number((spec.baseMultiplierBonus * levelScale).toFixed(2));
}

export function getPetCombatDps(pet: PetInstance): number {
  const spec = getPetSpeciesDefinition(pet.speciesId, pet.rarity);
  const lvl = Math.max(1, pet.level || 1);
  const levelScale = 1 + (lvl - 1) * 0.72 + Math.max(0, lvl - 5) * 0.35;
  return Number((spec.baseDps * levelScale).toFixed(1));
}

export function createStarterFrostPup(): PetInstance {
  return {
    instanceId: 'pet_starter_frost_pup',
    speciesId: 'frost_pup',
    name: 'Frost Pup',
    rarity: 'Common Egg',
    level: 1,
    hunger: 100,
    hatchedAt: Date.now(),
  };
}

/**
 * Picks a weighted Egg rarity; optional luckBoost (0..3) raises higher-tier odds for rarer zombie bosses.
 */
export function pickWeightedEgg(
  rng: () => number = Math.random,
  minTierIdx = 0
): EggRarity {
  const clampedMin = Math.max(0, Math.min(EGG_DEFINITIONS.length - 1, minTierIdx));
  const pool = EGG_DEFINITIONS.slice(clampedMin);
  const totalWeight = pool.reduce((sum, e) => sum + e.dropWeight, 0);
  let r = rng() * totalWeight;
  for (const e of pool) {
    r -= e.dropWeight;
    if (r <= 0) return e.rarity;
  }
  return pool[0].rarity;
}

export interface ChestLootResult {
  coins: number;
  gems: number;
  eggRarity: EggRarity | null;
  foodId: FoodId;
  foodAmount: number;
  foundSkinId: string | null;
  foundMatthewShopToken: boolean;
}

export function rollChestLoot(
  currentCps: number,
  currentClickPower: number,
  _unlockedSkins: string[],
  hasMatthewShopToken: boolean,
  rng: () => number = Math.random
): ChestLootResult {
  // Chests drop Gems (always), Bonus Coins, Eggs (~1 in 3 chests / ~33.3%), and 1-in-1000 Matthew Shop Token!
  const foundEgg = rng() < 1 / 3;
  const eggRarity = foundEgg ? pickWeightedEgg(rng, rng() < 0.35 ? 1 : 0) : null;
  const gems = foundEgg ? 8 + Math.floor(rng() * 14) : 14 + Math.floor(rng() * 20);
  const coins = foundEgg
    ? 0
    : Math.max(75, Math.round((currentCps * 12 + currentClickPower * 24) * (0.85 + rng() * 0.5)));

  // Ultra-rare Matthew Shop Token (1 in 1000 odds = 0.001)
  const foundMatthewShopToken = !hasMatthewShopToken && rng() < 0.001;

  return {
    coins,
    gems,
    eggRarity,
    foodId: 'ice_treat',
    foodAmount: 0,
    foundSkinId: null,
    foundMatthewShopToken,
  };
}
