/**
 * MATTHEW CLICKER v1.3 — CENTRALIZED GAME & WEEKLY LIVE-OPS CONFIGURATION
 * - 1-Week Seasons (Monday 12:00 AM -> Friday 11:59 PM active play, with All-Day Friday 4x Live Event)
 * - Weekend Downtime (After Friday Live Event ends -> Monday 12:00 AM)
 */

export const GAME_VERSION = '1.3.0';

export const TIMEZONE_CONFIG = {
  /** Authoritative IANA timezone used for Weekly Seasons, Friday Live Event, and Downtime */
  timezone: 'America/New_York',
  utcOffsetHoursStandard: -5, // EST
};

const NOV_8_620PM_MS = Date.parse('2026-11-08T18:20:00-05:00');

export const BETA_RESET_CONFIG = {
  wipeId: 'today_nov_8_2026_620pm_wipe_v1',
  resetIso: '2026-11-08T18:20:00-05:00',
  resetTimeMs: NOV_8_620PM_MS,
  announcementText: '',
};

export const SEASON_CONFIG = {
  /** Weekly cycle duration: 7 days in milliseconds (Monday 00:00 to next Monday 00:00) */
  durationDays: 7,
  durationMs: 7 * 24 * 60 * 60 * 1000,
  /** Active play window within each 7-day cycle: Monday 00:00 through Friday 24:00 (5 days) */
  activePlayDurationMs: 5 * 24 * 60 * 60 * 1000,
  /** Friday Live Event window within each 7-day cycle: Friday 00:00 to Friday 24:00 (Day 4 to Day 5) */
  fridayEventOffsetStartMs: 4 * 24 * 60 * 60 * 1000,
  fridayEventOffsetEndMs: 5 * 24 * 60 * 60 * 1000,
  /**
   * Season 1 anchor start: Monday, November 9, 2026 at 00:00:00 America/New_York
   * Subsequent 1-week seasons roll forward deterministically every Monday at 00:00:00 EST.
   */
  epochStartIso: '2026-11-09T00:00:00-05:00',
  epochStartMs: Date.parse('2026-11-09T00:00:00-05:00'),
  championSkinId: 'champion_matthew',
};

export const FRIDAY_BONUS_CONFIG = {
  enabled: true,
  dayOfWeek: 5, // Friday
  multiplier: 1.0, // Handled by the All-Day Friday 4x Live Event so it never double-stacks
  label: 'FRIDAY 4X LIVE EVENT',
};

export const GEM_ECONOMY_CONFIG = {
  /** 3 gems per 10 minutes (600 seconds) of verified active normal gameplay */
  normalGemsPerInterval: 3,
  normalIntervalSeconds: 600,
  /** 10 gems per 10 minutes (600 seconds) of active participation during Friday Matthew Storm */
  stormGemsPerInterval: 10,
  stormIntervalSeconds: 600,
  /** Daily login reward */
  dailyLoginGems: 5,
  /** Offline earnings NEVER grant gems */
  offlineGems: 0,
  /** Price of each limited Matthew Storm event skin */
  stormSkinCostGems: 50,
  /** Maximum idle seconds before active-play gem timer pauses (anti-AFK safeguard) */
  activeInputWindowSeconds: 90,
};

export const MATTHEW_STORM_CONFIG = {
  eventId: 'matthew_storm_weekly_friday',
  name: 'Friday Matthew Storm',
  /** First weekly Friday event anchor: Friday, November 13, 2026 (All Day: 00:00 to 24:00 EST) */
  startIso: '2026-11-13T00:00:00-05:00',
  endIso: '2026-11-13T23:59:59-05:00',
  startTimeMs: Date.parse('2026-11-13T00:00:00-05:00'),
  endTimeMs: Date.parse('2026-11-14T00:00:00-05:00'),
  /** Show pre-event countdown banner all week leading up to Friday */
  preAnnouncementLeadMs: 5 * 24 * 60 * 60 * 1000,
  /** Fullscreen dramatic lightning countdown: 10 seconds before start */
  fullscreenCountdownSeconds: 10,
  /** Balanced 4x Clicks & Points multiplier all day Friday! */
  baseStormMultiplier: 4,
  /** Wave scheduling rules for All-Day Friday Event (steady 4x multiplier + periodic Giant Matthew spawns) */
  waveIntervalMinSeconds: 35,
  waveIntervalMaxSeconds: 65,
  waveDurationMinSeconds: 30,
  waveDurationMaxSeconds: 45,
  waveMultiplierMin: 4,
  waveMultiplierMax: 4,
  /** Giant Rare Matthew per wave: covers the arena for 10 seconds with 100x clicks! */
  giantMatthewDurationSeconds: 10,
  giantMatthewMaxClicksPerWave: 35,
  /** Development-only isolated preview duration: full 24-hour All-Day Friday (86,400 seconds until Midnight Downtime) */
  devTestDurationSeconds: 24 * 60 * 60,
  devTestWaveIntervalMinSeconds: 15,
  devTestWaveIntervalMaxSeconds: 25,
  devTestWaveDurationMinSeconds: 25,
  devTestWaveDurationMaxSeconds: 40,
};

export const CLICK_SAFETY_CONFIG = {
  /** Maximum human/assisted clicks accepted per second to prevent script abuse */
  maxClicksPerSecond: 30,
  comboMax: 0,
  comboStepBonus: 0,
  comboDecaySeconds: 0,
  baseCritChance: 0.06,
  baseCritMultiplier: 3.0,
};

export const DEV_FLAGS = {
  enableEventTestButton: false,
};

export const SEASON_2_CONFIG = {
  themeName: 'Frozen Apocalypse',
  launchIso: '2026-11-16T00:00:00-05:00',
  launchTimeMs: Date.parse('2026-11-16T00:00:00-05:00'),
  /** Next Friday Live Event (Season 2 Week 1 Friday: Nov 20, 2026) */
  nextFridayEventStartIso: '2026-11-20T00:00:00-05:00',
  nextFridayEventEndIso: '2026-11-20T23:59:59-05:00',
  /** Daily shop size & daily rotation delta (3 featured at a time out of 6, 2 swap daily) */
  itemShopTotalSlots: 6,
  itemShopVisibleSlots: 3,
  itemShopDailyRotateCount: 2,
  /** Maximum pets equipped underneath Matthew's head */
  maxEquippedPets: 3,
  /** Unlimited pet upgrade level (Infinity = no level cap) */
  maxPetLevel: Number.POSITIVE_INFINITY,
  /** Maximum clan size */
  maxClanMembers: 5,
  /** Random Zombie Raid interval range in seconds (10 - 15 minutes) */
  raidIntervalMinSeconds: 10 * 60,
  raidIntervalMaxSeconds: 15 * 60,
  raidDurationSeconds: 75,
  /** Ultra-rare Matthew Shop Token chance per chest (1 in 1000 odds = 0.001) */
  matthewShopTokenChestChance: 0.001,
  /** Chest opening costs / sources */
  gemChestCostGems: 25,
};

export const SEASON_3_CONFIG = {
  themeName: 'Marvel',
  downtimeStartIso: '2026-11-19T18:00:00-05:00',
  downtimeStartTimeMs: Date.parse('2026-11-19T18:00:00-05:00'),
  launchIso: '2026-11-23T00:00:00-05:00',
  launchTimeMs: Date.parse('2026-11-23T00:00:00-05:00'),
  nextFridayEventStartIso: '2026-11-27T00:00:00-05:00',
  nextFridayEventEndIso: '2026-11-27T23:59:59-05:00',
  /** Cooldown between player-triggered Events / Villain Attacks (5 minutes) */
  eventSummonCooldownMs: 5 * 60 * 1000,
  /** 1-in-75 chance per Infinity Stone drop from Mystery Chests */
  infinityStoneDropDenominator: 75,
  sandboxStorageKey: 'matthew_clicker_s3_sandbox_v1',
  sandboxRtdbPrefix: 'sandbox_s3/',
};

export const TEST_ISOLATION_CONFIG = {
  /** Strictly authorized Firebase UIDs allowed to preview upcoming seasons & skip downtime (`Marshallb78`, `testmarshall`) */
  authorizedDevUids: [
    '89nsfff2YtaEVcNTHUBDq22V4FW2', // Marshallb78
    'cKFezHsISfbZGH4tKjQyME0wvrt1', // testmarshall
  ] as readonly string[],
  sandboxStorageKey: 'matthew_clicker_s2_sandbox_v1',
  sandboxRtdbPrefix: 'sandbox_s2/',
};

export function isAuthorizedDevUid(uid?: string | null): boolean {
  if (!uid || typeof uid !== 'string') return false;
  return TEST_ISOLATION_CONFIG.authorizedDevUids.includes(uid.trim());
}

/**
 * Pre-launch Season 2 Sandbox preview is active ONLY when:
 * 1) Current clock is before Monday midnight Season 2 launch
 * 2) User toggled sandbox ON
 * 3) User's Firebase UID is strictly one of the 2 authorized devs (`Marshallb78` or `testmarshall`).
 * At Monday midnight (`nowMs >= SEASON_2_CONFIG.launchTimeMs`), everyone — including devs — rolls cleanly into live Season 2.
 */
export function isSandboxSeason2Context(
  uid?: string | null,
  sandboxEnabled?: boolean,
  nowMs: number = Date.now()
): boolean {
  if (!sandboxEnabled) return false;
  if (nowMs >= SEASON_2_CONFIG.launchTimeMs) return false;
  return isAuthorizedDevUid(uid);
}

/**
 * Pre-launch Season 3 (Marvel) Sandbox / Downtime-skip is allowed ONLY for verified dev UIDs before Monday Nov 23 launch.
 */
export function isSandboxSeason3Context(
  uid?: string | null,
  sandboxS3Enabled?: boolean,
  nowMs: number = Date.now()
): boolean {
  if (!sandboxS3Enabled) return false;
  if (nowMs >= SEASON_3_CONFIG.launchTimeMs) return false;
  return isAuthorizedDevUid(uid);
}
