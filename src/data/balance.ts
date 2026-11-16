/**
 * Centralized Economy and Balance Configuration for Matthew Clicker.
 * Click-Power-First Balance: Active clicking dominates passive CPS!
 */

export const BALANCE = {
  // --- CLICK DYNAMICS (Click Power is Primary!) ---
  click: {
    basePower: 1,
    baseCritChance: 0.06, // 6% base crit chance
    baseCritMultiplier: 3.0, // 3x damage on critical hit!
    comboMax: 0, // Fast-click combo bonus removed
    comboBonusPerStack: 0, // No speed-based click multiplier
    comboTimerResetSec: 0,
  },

  // --- PASSIVE INCOME & TIMERS ---
  passive: {
    tickIntervalMs: 50, // 20 ticks per second
  },

  // --- GOLDEN MATTHEW BONUS EVENT ---
  goldenEvent: {
    baseDelayMs: 28000, // ~28 seconds average between appearances
    delayVarianceMs: 12000,
    flightDurationMs: 12000, // 12 seconds on screen
    frenzyDurationSec: 12,
    frenzyMultiplier: 2.5, // 2.5x during frenzy
    bountyCpsSeconds: 90, // 90 seconds of passive production!
    bountyClickCount: 220, // +220 clicks of click power!
    minBountyFloor: 500,
  },

  // --- ACHIEVEMENTS ---
  achievements: {
    perAchievementBonusMultiplier: 0.01,
  },

  // --- OFFLINE EARNINGS ---
  offline: {
    maxHours: 8,
    efficiency: 0.5, // 50% production rate while offline
  },

  // --- PRESTIGE (COSMIC ASCENSION) ---
  prestige: {
    baseShardRequirement: 25000, // 25K lifetime coins for 1st Rebirth
    unspentShardBonus: 0.15, // +0.15x per Rebirth step
  },
} as const;
