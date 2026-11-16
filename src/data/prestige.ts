import { PrestigeUpgrade } from '../types/game';

export const PRESTIGE_REQUIREMENT = 25000; // 25K Coins to Ascend / Rebirth
export const ASCENSION_STEP = 0.15; // +0.15x per Rebirth tier (~80x at 1 Vg!)

/**
 * Calculates how many +0.15x Ascension steps the player has earned from lifetime coins.
 * Fast logarithmic curve starting at 25K (9 shards per 10x coin tier) reaching ~80.2x at 1 Vg.
 */
export function calculatePrestigeShards(lifetimeCoins: number): number {
  if (lifetimeCoins < PRESTIGE_REQUIREMENT) return 0;
  const logRatio = Math.log10(lifetimeCoins / PRESTIGE_REQUIREMENT);
  return Math.max(1, 1 + Math.floor(logRatio * 9));
}

/**
 * Returns the lifetime coins required to unlock the next +0.15x Ascension step.
 */
export function getNextPrestigeRequirement(currentLifetimeSteps: number): number {
  const nextStep = Math.max(1, Math.floor(currentLifetimeSteps || 0) + 1);
  if (nextStep <= 1) return PRESTIGE_REQUIREMENT;
  return Math.ceil(PRESTIGE_REQUIREMENT * Math.pow(10, (nextStep - 1) / 9));
}

/**
 * Returns the player's active Ascension Multiplier (starts at 1.00x, increases by +0.035x per step).
 */
export function getAscensionMultiplier(prestigeShards: number): number {
  const steps = Math.max(0, Math.floor(prestigeShards || 0));
  return Number((1 + steps * ASCENSION_STEP).toFixed(2));
}

export const PRESTIGE_UPGRADES: PrestigeUpgrade[] = [];
