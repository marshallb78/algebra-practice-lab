import { PrestigeUpgrade } from '../types/game';

export const PRESTIGE_REQUIREMENT = 100000; // 100K Coins to Ascend / Rebirth early
export const ASCENSION_STEP = 0.6; // +0.60x per Rebirth tier for high-impact Ascension scaling

/**
 * Calculates how many +0.60x Ascension steps the player has earned from lifetime coins.
 * High-momentum logarithmic curve through Vg (10^63) so Ascension reaches massive multipliers!
 */
export function calculatePrestigeShards(lifetimeCoins: number): number {
  if (lifetimeCoins < PRESTIGE_REQUIREMENT) return 0;
  const logRatio = Math.log10(lifetimeCoins / PRESTIGE_REQUIREMENT);
  return Math.max(1, 1 + Math.floor(logRatio * 5));
}

/**
 * Returns the lifetime coins required to unlock the next +0.60x Ascension step.
 */
export function getNextPrestigeRequirement(currentLifetimeSteps: number): number {
  const nextStep = Math.max(1, Math.floor(currentLifetimeSteps || 0) + 1);
  if (nextStep <= 1) return PRESTIGE_REQUIREMENT;
  return Math.ceil(PRESTIGE_REQUIREMENT * Math.pow(10, (nextStep - 1) / 5));
}

/**
 * Returns the player's active Ascension Multiplier (starts at 1.00x, increases by +0.15x per step).
 */
export function getAscensionMultiplier(prestigeShards: number): number {
  const steps = Math.max(0, Math.floor(prestigeShards || 0));
  return Number((1 + steps * ASCENSION_STEP).toFixed(2));
}

export const PRESTIGE_UPGRADES: PrestigeUpgrade[] = [];
