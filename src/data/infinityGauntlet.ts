import { InfinityStoneId } from '../types/game';
import { SEASON_3_CONFIG } from '../config/gameConfig';
import { clampFiniteCoinAmount, MAX_SAFE_SEASON_COINS } from '../utils/calculations';

export interface InfinityStoneDefinition {
  id: InfinityStoneId;
  name: string;
  color: string;
  glowColor: string;
  image: string;
  powerLore: string;
}

export const INFINITY_GAUNTLET_IMAGE = './images/s3/gauntlet/infinity_gauntlet.png';

export const INFINITY_STONES: InfinityStoneDefinition[] = [
  {
    id: 'space',
    name: 'Space Stone',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.85)',
    image: './images/s3/gauntlet/stone_space.png',
    powerLore: 'Warps space across every server.',
  },
  {
    id: 'mind',
    name: 'Mind Stone',
    color: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.85)',
    image: './images/s3/gauntlet/stone_mind.png',
    powerLore: 'Sharpens cosmic precision.',
  },
  {
    id: 'reality',
    name: 'Reality Stone',
    color: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.85)',
    image: './images/s3/gauntlet/stone_reality.png',
    powerLore: 'Rewrites the clicker universe.',
  },
  {
    id: 'power',
    name: 'Power Stone',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.85)',
    image: './images/s3/gauntlet/stone_power.png',
    powerLore: 'Unleashes raw purple destruction.',
  },
  {
    id: 'time',
    name: 'Time Stone',
    color: '#34d399',
    glowColor: 'rgba(52, 211, 153, 0.85)',
    image: './images/s3/gauntlet/stone_time.png',
    powerLore: 'Bends seasonal timelines at will.',
  },
  {
    id: 'soul',
    name: 'Soul Stone',
    color: '#fb923c',
    glowColor: 'rgba(251, 146, 60, 0.85)',
    image: './images/s3/gauntlet/stone_soul.png',
    powerLore: 'Completes the Gauntlet for The Snap.',
  },
];

export const ALL_INFINITY_STONE_IDS: InfinityStoneId[] = INFINITY_STONES.map((s) => s.id);

export function getInfinityStoneDefinition(id: InfinityStoneId): InfinityStoneDefinition {
  return INFINITY_STONES.find((s) => s.id === id) || INFINITY_STONES[0];
}

export function hasAllInfinityStones(stones?: InfinityStoneId[] | null): boolean {
  if (!Array.isArray(stones) || stones.length < INFINITY_STONES.length) return false;
  const owned = new Set(stones);
  return ALL_INFINITY_STONE_IDS.every((id) => owned.has(id));
}

export interface ChestLootResult {
  coins: number;
  gems: number;
  foundMatthewShopToken: boolean;
  foundInfinityStone: InfinityStoneId | null;
  foundSkinId?: string;
}

/**
 * Rolls Mystery Chest loot (NO eggs in Season 3!):
 * - Grants balanced Coins + Gems
 * - 1-in-1000 chance for the permanent Matthew Shop Token
 * - 1-in-75 chance for an unowned Infinity Stone!
 */
export function rollChestLoot(
  currentCps: number,
  currentClickPower: number,
  _ownedSkins: string[] = [],
  hasMatthewShopToken: boolean = false,
  rng: () => number = Math.random,
  ownedInfinityStones: InfinityStoneId[] = []
): ChestLootResult {
  const tokenRoll = rng();
  const foundMatthewShopToken = !hasMatthewShopToken && tokenRoll < 0.0085;

  // Roll each unowned Infinity Stone with 1-in-75 odds per stone (checked cleanly in order)
  const ownedSet = new Set(ownedInfinityStones || []);
  const missingStones = ALL_INFINITY_STONE_IDS.filter((id) => !ownedSet.has(id));
  let foundInfinityStone: InfinityStoneId | null = null;
  if (missingStones.length > 0 && rng() < missingStones.length / SEASON_3_CONFIG.infinityStoneDropDenominator) {
    const pickIdx = Math.min(missingStones.length - 1, Math.floor(rng() * missingStones.length));
    foundInfinityStone = missingStones[pickIdx];
  }

  const baseProd = Math.max(15, currentCps + currentClickPower * 4);
  const coins = clampFiniteCoinAmount(
    Math.floor(baseProd * (18 + rng() * 24)),
    MAX_SAFE_SEASON_COINS
  );
  const gems = 10 + Math.floor(rng() * 13);

  return {
    coins,
    gems,
    foundMatthewShopToken,
    foundInfinityStone,
  };
}
