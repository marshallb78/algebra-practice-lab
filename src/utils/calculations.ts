import { getUpgradesForSeason } from '../data/upgrades';
import { getAscensionMultiplier } from '../data/prestige';
import { BALANCE } from '../data/balance';
import { FRIDAY_BONUS_CONFIG, SEASON_2_CONFIG } from '../config/gameConfig';
import { getPetClickMultiplierBonus } from '../data/petsAndEggs';
import { isSeasonTwoOrLater } from '../data/skins';
import { getCursorById } from '../data/cursors';
import { GameState } from '../types/game';

/** Maximum safe finite coin/score cap per season (999 Ctg = 9.99e305, cleanly below Number.MAX_VALUE). */
export const MAX_SAFE_SEASON_COINS = 9.99e305;

export function clampFiniteCoinAmount(val: number, maxVal = MAX_SAFE_SEASON_COINS): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) return 0;
  return Math.min(maxVal, val);
}

export interface LiveMultiplierOptions {
  fridayBonusActive?: boolean;
  stormWaveMultiplier?: number;
}

export function getCombinedLiveMultiplier(options?: LiveMultiplierOptions): {
  fridayMult: number;
  stormWaveMult: number;
  combinedMult: number;
} {
  const fridayMult = options?.fridayBonusActive ? FRIDAY_BONUS_CONFIG.multiplier : 1.0;
  const stormWaveMult =
    options?.stormWaveMultiplier && options.stormWaveMultiplier > 1
      ? options.stormWaveMultiplier
      : 1.0;
  return {
    fridayMult,
    stormWaveMult,
    combinedMult: fridayMult * stormWaveMult,
  };
}

export function getUpgradeCost(baseCost: number, multiplier: number, currentLevel: number): number {
  const raw = Math.floor(baseCost * Math.pow(multiplier, Math.max(0, Math.floor(currentLevel || 0))));
  if (!Number.isFinite(raw) || raw < 0) return Infinity;
  return raw;
}

export function getBulkUpgradeCost(
  baseCost: number,
  multiplier: number,
  currentLevel: number,
  count: number
): { totalCost: number; actualCount: number } {
  const safeCount = Math.max(1, Math.floor(count || 1));
  if (safeCount <= 1) {
    return { totalCost: getUpgradeCost(baseCost, multiplier, currentLevel), actualCount: 1 };
  }

  const a = getUpgradeCost(baseCost, multiplier, currentLevel);
  if (!Number.isFinite(a)) {
    return { totalCost: Infinity, actualCount: safeCount };
  }
  const r = multiplier;
  const powR = Math.pow(r, safeCount);
  const totalCost = Math.floor((a * (powR - 1)) / (r - 1));
  if (!Number.isFinite(totalCost) || totalCost < 0) {
    return { totalCost: Infinity, actualCount: safeCount };
  }
  return { totalCost, actualCount: safeCount };
}

export function getMaxAffordableUpgrade(
  baseCost: number,
  multiplier: number,
  currentLevel: number,
  currentCoins: number
): { totalCost: number; count: number } {
  const safeCoins = clampFiniteCoinAmount(currentCoins, MAX_SAFE_SEASON_COINS);
  const nextCost = getUpgradeCost(baseCost, multiplier, currentLevel);
  if (!Number.isFinite(nextCost) || safeCoins < nextCost) return { totalCost: 0, count: 0 };

  const a = nextCost;
  const r = multiplier;
  const term = (safeCoins / a) * (r - 1) + 1;
  let count = Number.isFinite(term)
    ? Math.max(1, Math.min(5000, Math.floor(Math.log(term) / Math.log(r))))
    : 5000;
  if (!Number.isFinite(count) || count < 1) count = 1;
  let { totalCost } = getBulkUpgradeCost(baseCost, multiplier, currentLevel, count);
  while (count > 1 && (!Number.isFinite(totalCost) || totalCost > safeCoins)) {
    count -= 1;
    totalCost = getBulkUpgradeCost(baseCost, multiplier, currentLevel, count).totalCost;
  }
  if (!Number.isFinite(totalCost) || totalCost > safeCoins) {
    return { totalCost: nextCost <= safeCoins ? nextCost : 0, count: nextCost <= safeCoins ? 1 : 0 };
  }

  return { totalCost, count };
}

export function calculateClickPower(
  state: GameState,
  liveOptions?: LiveMultiplierOptions
): {
  basePower: number;
  totalPower: number;
  critChance: number;
  critMultiplier: number;
  comboMultiplier: number;
  ascensionMultiplier: number;
  liveMultiplier: number;
} {
  let basePower = BALANCE.click.basePower;
  const activeUpgrades = getUpgradesForSeason(state.currentSeasonId);

  // Add upgrade power
  for (const upgrade of activeUpgrades) {
    const level = state.upgrades[upgrade.id] || 0;
    if (level > 0 && upgrade.baseClickPower > 0) {
      basePower += level * upgrade.baseClickPower;
    }
  }

  // Equipped Cursor Abilities (Crit, Click, CPS, Ascension bonus)
  const equippedCursor = getCursorById(state.equippedCursorId);
  const critChance = BALANCE.click.baseCritChance + (equippedCursor?.critChanceBonus || 0);
  const critMultiplier = BALANCE.click.baseCritMultiplier + (equippedCursor?.critMultiplierBonus || 0);
  const cursorClickMult = 1 + (equippedCursor?.clickMultiplierBonus || 0);
  const cursorAscensionBonus =
    equippedCursor?.ascensionBonusPerShard && state.prestigeShards > 0
      ? equippedCursor.ascensionBonusPerShard * state.prestigeShards
      : 0;

  // Capybara Clicker style Ascension Multiplier: multiplies EVERYTHING
  const ascensionMultiplier = getAscensionMultiplier(state.prestigeShards) + cursorAscensionBonus;

  // Fast-click combo bonus disabled (1.0x constant)
  const comboMultiplier = 1.0;

  // Frenzy Multiplier
  const frenzyMult = state.frenzyTimer > 0 ? state.frenzyMultiplier : 1.0;

  // Multiplicative Live Event & Friday 2x Stacking
  const { combinedMult: liveMultiplier } = getCombinedLiveMultiplier(liveOptions);

  // Season 2: Equipped pets multiply clicking power
  let petMultiplier = 1.0;
  if (isSeasonTwoOrLater(state.currentSeasonId) && Array.isArray(state.equippedPetIds) && state.equippedPetIds.length > 0 && Array.isArray(state.pets)) {
    const equippedSet = new Set(state.equippedPetIds.slice(0, SEASON_2_CONFIG.maxEquippedPets));
    const bonusSum = state.pets
      .filter((p) => equippedSet.has(p.instanceId))
      .reduce((acc, p) => acc + getPetClickMultiplierBonus(p), 0);
    petMultiplier = 1 + bonusSum;
  }

  const rawTotalPower =
    basePower *
    ascensionMultiplier *
    comboMultiplier *
    frenzyMult *
    liveMultiplier *
    petMultiplier *
    cursorClickMult;
  const totalPower = Math.max(
    1,
    clampFiniteCoinAmount(Number(rawTotalPower.toFixed(2)), MAX_SAFE_SEASON_COINS)
  );

  return {
    basePower,
    totalPower,
    critChance: Math.min(critChance, 0.75),
    critMultiplier,
    comboMultiplier,
    ascensionMultiplier,
    liveMultiplier,
  };
}

export function calculateCPS(state: GameState, liveOptions?: LiveMultiplierOptions): number {
  let rawCps = 0;
  const activeUpgrades = getUpgradesForSeason(state.currentSeasonId);

  for (const upgrade of activeUpgrades) {
    const level = state.upgrades[upgrade.id] || 0;
    if (level > 0 && upgrade.baseCps > 0) {
      rawCps += level * upgrade.baseCps;
    }
  }

  if (rawCps <= 0) return 0;

  const equippedCursor = getCursorById(state.equippedCursorId);
  const cursorCpsMult = 1 + (equippedCursor?.cpsMultiplierBonus || 0);
  const cursorAscensionBonus =
    equippedCursor?.ascensionBonusPerShard && state.prestigeShards > 0
      ? equippedCursor.ascensionBonusPerShard * state.prestigeShards
      : 0;

  // Capybara Clicker style Ascension Multiplier: multiplies EVERYTHING
  const ascensionMultiplier = getAscensionMultiplier(state.prestigeShards) + cursorAscensionBonus;

  // Frenzy Multiplier
  const frenzyMult = state.frenzyTimer > 0 ? state.frenzyMultiplier : 1.0;

  // Multiplicative Live Event & Friday 2x Stacking
  const { combinedMult: liveMultiplier } = getCombinedLiveMultiplier(liveOptions);

  return clampFiniteCoinAmount(
    rawCps *
      ascensionMultiplier *
      frenzyMult *
      liveMultiplier *
      cursorCpsMult,
    MAX_SAFE_SEASON_COINS
  );
}

/**
 * Calculates Giant Matthew click reward during a Matthew Storm wave:
 * full-screen boss event paying 100x points per click!
 */
export function calculateGiantMatthewClickReward(
  state: GameState,
  liveOptions?: LiveMultiplierOptions
): number {
  const { totalPower } = calculateClickPower(state, liveOptions);
  return Math.max(100, clampFiniteCoinAmount(Math.floor(totalPower * 100), MAX_SAFE_SEASON_COINS));
}

/**
 * Uncapped Offline Coin Earnings:
 * - Generates Matthew Coins ONLY (gemsEarned is strictly 0).
 * - NO time cap on eligible offline earnings.
 * - Discards uncollected offline earnings if a season transition occurred.
 */
export function calculateOfflineEarnings(
  state: GameState,
  nowSeconds: number,
  activeSeasonId?: string
): { elapsedSeconds: number; coinsEarned: number; gemsEarned: 0 } {
  if (!state.lastSaveTime || state.lastSaveTime <= 0) {
    return { elapsedSeconds: 0, coinsEarned: 0, gemsEarned: 0 };
  }

  // Discard uncollected previous-season offline earnings on season transition
  if (activeSeasonId && state.currentSeasonId && state.currentSeasonId !== activeSeasonId) {
    return { elapsedSeconds: 0, coinsEarned: 0, gemsEarned: 0 };
  }

  const lastSaveSec = Math.floor(state.lastSaveTime / 1000);
  const diffSec = Math.max(0, nowSeconds - lastSaveSec);

  // Offline earnings only trigger if gone for more than 15 seconds
  if (diffSec < 15) {
    return { elapsedSeconds: 0, coinsEarned: 0, gemsEarned: 0 };
  }

  const effectiveSeconds = diffSec;
  const cps = calculateCPS(state);
  const efficiency = BALANCE.offline.efficiency;

  const coinsEarned = clampFiniteCoinAmount(
    Math.floor(cps * effectiveSeconds * efficiency),
    MAX_SAFE_SEASON_COINS
  );
  return { elapsedSeconds: effectiveSeconds, coinsEarned, gemsEarned: 0 };
}
