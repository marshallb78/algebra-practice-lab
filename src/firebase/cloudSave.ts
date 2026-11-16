import {
  TAB_SESSION_ID,
  rtdbRestGetWithStatus,
  rtdbRestWrite,
  rtdbRestWriteKeepalive,
  scopeRtdbPath,
} from './config';
import { GameState } from '../types/game';
import {
  getDefaultGameState,
  loadSandboxGame,
  sanitizeAndValidateGameState,
  saveGame,
} from '../utils/storage';
import { getEffectiveSeasonInfo } from '../utils/scheduleEngine';
import {
  ALL_STORM_SKINS,
  CHARACTER_SKINS,
  MATTHEW_STORM_SKINS,
  SKINS,
  equipSkin,
  isSeason2OnlySkinId,
  isValidSkinId,
} from '../data/skins';
import {
  MATTHEW_STORM_CONFIG,
  GEM_ECONOMY_CONFIG,
  SEASON_2_CONFIG,
  TEST_ISOLATION_CONFIG,
  isSandboxSeason2Context,
} from '../config/gameConfig';
import { createEmptySealedEggs } from '../data/petsAndEggs';
import { STARTER_CURSOR_ID } from '../data/cursors';
import {
  LIAM_S2_REBALANCE_REVISION_MS,
  LIAM_S2_REBALANCE_UID,
  SEASON_1_CHAMPION_USERNAME,
  updateLeaderboardEntry,
  updateLeaderboardEntryKeepalive,
} from './leaderboard';
import { getCachedBanRecord, getCachedResetRecord, refreshCloudBans } from './moderation';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline_pending' | 'error';

export const MARSHALL_RECOVERY_UID = '89nsfff2YtaEVcNTHUBDq22V4FW2';
export const MARSHALL_RECOVERED_SCORE = 3.2223763084217282e35; // 322.2 Dc
export const MARSHALL_RECOVERED_COINS = 2.5e35; // 250 Dc spendable coins
export const MARSHALL_RECOVERED_CLICKS = 151114;
export const MARSHALL_SEASON_1_SKINS: string[] = Array.from(
  new Set([
    ...SKINS.map((s) => s.id),
    ...CHARACTER_SKINS.map((s) => s.id),
    ...MATTHEW_STORM_SKINS.map((s) => s.id),
    'liam_matthew',
  ])
);

const lastSavedSignatureByUid = new Map<string, string>();
const verifiedInitialPullUids = new Set<string>();
const blockedOverwriteUids = new Set<string>();
const lastKnownCloudUpdatedAtByUid = new Map<string, number>();
const lastSessionCheckAtByUid = new Map<string, number>();
const reconcileInFlightByUid = new Map<string, Promise<GameState>>();

let foreignUpdateHandler: ((uid: string) => void) | null = null;

export function registerForeignCloudUpdateHandler(handler: ((uid: string) => void) | null): void {
  foreignUpdateHandler = handler;
}

export function clearCloudSaveSignature(uid: string): void {
  const sbxKey = `sbx_${uid}`;
  lastSavedSignatureByUid.delete(uid);
  lastSavedSignatureByUid.delete(sbxKey);
  verifiedInitialPullUids.delete(uid);
  verifiedInitialPullUids.delete(sbxKey);
  blockedOverwriteUids.delete(uid);
  blockedOverwriteUids.delete(sbxKey);
  lastKnownCloudUpdatedAtByUid.delete(uid);
  lastKnownCloudUpdatedAtByUid.delete(sbxKey);
  lastSessionCheckAtByUid.delete(uid);
  lastSessionCheckAtByUid.delete(sbxKey);
}

export function hasCompletedInitialCloudPull(uid?: string | null): boolean {
  if (!uid) return false;
  return verifiedInitialPullUids.has(uid);
}

export function isCloudOverwriteBlocked(uid?: string | null): boolean {
  if (!uid) return true;
  return blockedOverwriteUids.has(uid);
}

export interface ProgressSnapshot {
  lifetimeCoins: number;
  prestigeCount: number;
  saveTs: number;
}

/**
 * Compares two same-season snapshots deterministically:
 * - If lifetimeCoins differs by >1%, higher lifetimeCoins ALWAYS wins so an older/lower save
 *   with a stale prestigeCount or local timestamp can NEVER overwrite higher progress (e.g. 2 No overwriting 322 Dc).
 * - Within 1% (e.g. right after Rebirthing at the same lifetime score), higher prestigeCount wins first.
 * - Ties break cleanly by exact lifetimeCoins, then newest save timestamp.
 */
export function isProgressSnapshotBetter(
  candidate: ProgressSnapshot,
  baseline: ProgressSnapshot
): boolean {
  const candCoins = Math.max(0, candidate.lifetimeCoins || 0);
  const baseCoins = Math.max(0, baseline.lifetimeCoins || 0);
  const maxCoins = Math.max(candCoins, baseCoins);

  if (maxCoins > 0) {
    const relDiff = Math.abs(candCoins - baseCoins) / maxCoins;
    if (relDiff > 0.01) {
      return candCoins > baseCoins;
    }
  }

  const candPrestige = Math.max(0, candidate.prestigeCount || 0);
  const basePrestige = Math.max(0, baseline.prestigeCount || 0);
  if (candPrestige !== basePrestige) {
    return candPrestige > basePrestige;
  }

  if (candCoins !== baseCoins) {
    return candCoins > baseCoins;
  }

  return (candidate.saveTs || 0) > (baseline.saveTs || 0);
}

/**
 * Lightweight check (~40 bytes) to detect whether another device or browser tab saved
 * more recently than this session's last synced cloud timestamp.
 */
export async function hasForeignDeviceSavedMoreRecently(
  uid: string,
  isSandbox = false
): Promise<boolean> {
  if (!uid) return false;
  const scopeKey = `${isSandbox ? 'sbx_' : ''}${uid}`;
  const [sessionRes, updatedRes] = await Promise.all([
    rtdbRestGetWithStatus<string>(scopeRtdbPath(`users/${uid}/activeSessionId`, isSandbox), 3500, 0),
    rtdbRestGetWithStatus<number>(scopeRtdbPath(`users/${uid}/updatedAtMs`, isSandbox), 3500, 0),
  ]);

  if (!sessionRes.ok || !updatedRes.ok) {
    return false;
  }

  lastSessionCheckAtByUid.set(scopeKey, Date.now());
  const cloudSessionId = typeof sessionRes.data === 'string' ? sessionRes.data : null;
  const cloudUpdatedAt = typeof updatedRes.data === 'number' ? updatedRes.data : 0;
  const knownUpdatedAt = lastKnownCloudUpdatedAtByUid.get(scopeKey) || 0;

  if (cloudSessionId && cloudSessionId !== TAB_SESSION_ID && cloudUpdatedAt > knownUpdatedAt) {
    return true;
  }
  return false;
}

function buildUserCloudPayload(
  uid: string,
  username: string,
  state: GameState,
  nowMs: number,
  activeSeasonId: string
): Record<string, any> {
  return {
    uid,
    username,
    activeSessionId: TAB_SESSION_ID,
    activeSessionToken: state.activeSessionToken || TAB_SESSION_ID,
    unlockedSkins: state.unlockedSkins,
    equippedSkin: state.equippedSkin,
    gems: state.gems,
    lifetimeGems: state.lifetimeGems,
    permanentAchievements: state.permanentAchievements,
    seasonHistory: state.seasonHistory,
    lastDailyLoginClaimDate: state.lastDailyLoginClaimDate,
    totalPlaytimeSeconds: Math.floor(state.totalPlaytimeSeconds || 0),
    lifetimeAllSeasonsCoins: Math.max(state.lifetimeAllSeasonsCoins || 0, state.lifetimeCoins),
    lifetimeAllSeasonsClicks: Math.max(state.lifetimeAllSeasonsClicks || 0, state.clicks),
    highestCps: state.highestCps || 0,
    introCutsceneSeen: state.introCutsceneSeen,
    discoveredEasterEggs: state.discoveredEasterEggs || [],
    pets: state.pets || [],
    equippedPetIds: state.equippedPetIds || [],
    sealedEggs: state.sealedEggs,
    foodInventory: state.foodInventory,
    ownedCosmetics: state.ownedCosmetics || [],
    equippedCosmetics: { hat: null, glasses: state.equippedCosmetics?.glasses || null },
    hasMatthewShopToken: Boolean(state.hasMatthewShopToken),
    matthewShopTokens: state.matthewShopTokens ?? 0,
    unlockedCursors: state.unlockedCursors || [],
    equippedCursorId: state.equippedCursorId || null,
    cratesOpened: state.cratesOpened || 0,
    chestsOpened: state.chestsOpened || 0,
    zombiesDefeated: state.zombiesDefeated || 0,
    zombiesStolenCoins: state.zombiesStolenCoins || 0,
    zombieHitsTaken: state.zombieHitsTaken ?? 0,
    season2IntroSeen: Boolean(state.season2IntroSeen),
    winnerBadges: state.winnerBadges || [],
    clanId: state.clanId || null,
    clanName: state.clanName || null,
    settings: state.settings,
    cloudAdjustmentAtMs: state.appliedCloudAdjustmentAtMs || 0,
    resetAtMs: null,
    updatedAtMs: nowMs,
    seasons: {
      [activeSeasonId]: {
        seasonId: activeSeasonId,
        coins: state.coins,
        lifetimeCoins: state.lifetimeCoins,
        seasonalScore: Math.max(state.seasonalScore || 0, Math.floor(state.lifetimeCoins)),
        clicks: state.clicks,
        criticalClicks: state.criticalClicks,
        maxComboReached: state.maxComboReached || 0,
        upgrades: state.upgrades,
        currentRealm: state.currentRealm,
        unlockedRealms: state.unlockedRealms,
        prestigeCount: state.prestigeCount,
        prestigeShards: state.prestigeShards,
        lifetimePrestigeShards: state.lifetimePrestigeShards,
        prestigeUpgrades: state.prestigeUpgrades,
        unlockedAchievements: state.unlockedAchievements,
        claimedQuests: state.claimedQuests,
        eventStats: state.eventStats,
        totalPlaytimeSeconds: Math.floor(state.totalPlaytimeSeconds || 0),
        goldenMatthewsClicked: state.goldenMatthewsClicked,
        giantMatthewsClicked: state.giantMatthewsClicked || 0,
        lastSaveTime: nowMs,
      },
    },
  };
}

/**
 * Pure reconciliation helper combining cloud sources (`users/${uid}`, season snapshot, leaderboard entry)
 * with a device's local state, guaranteeing higher progress never gets overwritten by stale devices.
 */
export function reconcileCloudAndLocalState(params: {
  uid: string;
  username: string;
  localState: GameState;
  rtdbUser: Record<string, any> | null;
  rtdbLb: Record<string, any> | null;
  legacySources?: Record<string, any>[];
  wasExplicitlyReset: boolean;
  resetAtMs: number;
  activeSeasonId: string;
  nowMs?: number;
}): {
  state: GameState;
  shouldPushToCloud: boolean;
  recoveredFromCareerLoss: boolean;
  season2ResetApplied?: boolean;
} {
  const {
    uid,
    localState: rawLocalState,
    rtdbUser,
    rtdbLb,
    legacySources = [],
    wasExplicitlyReset,
    resetAtMs,
    activeSeasonId,
    nowMs = Date.now(),
  } = params;

  // Never allow a different previous account's localStorage save to contaminate this account
  const localState =
    rawLocalState.lastOwnerUid && rawLocalState.lastOwnerUid !== uid
      ? getDefaultGameState()
      : rawLocalState;

  const rtdbSeason = rtdbUser?.seasons?.[activeSeasonId] || null;

  const localAppliedAdjustmentAtMs = Math.max(
    0,
    typeof localState.appliedCloudAdjustmentAtMs === 'number'
      ? localState.appliedCloudAdjustmentAtMs
      : 0
  );
  const cloudAdjustmentAtMs = Math.max(
    typeof rtdbUser?.cloudAdjustmentAtMs === 'number' ? rtdbUser.cloudAdjustmentAtMs : 0,
    typeof rtdbLb?.cloudAdjustmentAtMs === 'number' ? rtdbLb.cloudAdjustmentAtMs : 0
  );
  const isCloudAdjustmentPending =
    cloudAdjustmentAtMs > 0 && cloudAdjustmentAtMs > localAppliedAdjustmentAtMs;
  const needsLiamS2Reset =
    uid === LIAM_S2_REBALANCE_UID &&
    activeSeasonId === 'season_2' &&
    !wasExplicitlyReset &&
    localAppliedAdjustmentAtMs < LIAM_S2_REBALANCE_REVISION_MS &&
    cloudAdjustmentAtMs < LIAM_S2_REBALANCE_REVISION_MS;

  // Prefer RTDB sources whenever any RTDB record exists; only fall back to legacy Firestore otherwise
  const sources: Record<string, any>[] =
    rtdbUser || rtdbLb
      ? [rtdbLb || {}, rtdbSeason || {}, rtdbUser || {}]
      : legacySources;

  let bestCloudSeason: Record<string, any> = {};
  let bestCloudSnapshot: ProgressSnapshot = {
    lifetimeCoins: -1,
    prestigeCount: -1,
    saveTs: 0,
  };

  let maxCareerPlaytime = isCloudAdjustmentPending ? 0 : localState.totalPlaytimeSeconds || 0;
  let maxCareerClicks = isCloudAdjustmentPending
    ? 0
    : Math.max(localState.lifetimeAllSeasonsClicks || 0, localState.clicks || 0);
  let maxCareerHighestCps = isCloudAdjustmentPending ? 0 : localState.highestCps || 0;
  let maxCareerCoins = isCloudAdjustmentPending
    ? 0
    : Math.max(localState.lifetimeAllSeasonsCoins || 0, localState.lifetimeCoins || 0);

  const allSkins = new Set<string>(['classic_matthew', ...(localState.unlockedSkins || [])]);
  if (uid === MARSHALL_RECOVERY_UID && !wasExplicitlyReset) {
    MARSHALL_SEASON_1_SKINS.forEach((id) => {
      if (isValidSkinId(id)) allSkins.add(id);
    });
  }
  const allPermAch = new Set<string>(localState.permanentAchievements || []);
  const allClaimedQuests = new Set<string>(
    isCloudAdjustmentPending ? [] : localState.claimedQuests || []
  );
  const allUnlockedAchievements = new Set<string>(localState.unlockedAchievements || []);
  const allUnlockedRealms = new Set<string>(localState.unlockedRealms || ['earth']);

  let cloudEquippedSkin: string | null = null;
  let latestDailyLoginClaimDate: string | null = localState.lastDailyLoginClaimDate || null;
  let cloudMaxPrestigeCount = 0;
  let cloudMaxPrestigeShards = 0;
  let cloudMaxLifetimePrestigeShards = 0;
  let cloudMaxClicks = 0;
  let cloudMaxCritClicks = 0;
  let cloudMaxGoldenClicked = 0;
  let cloudMaxGiantClicked = 0;
  let cloudMaxComboReached = 0;

  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;

    if (Array.isArray(src.unlockedSkins)) {
      src.unlockedSkins.forEach((id: string) => {
        if (isValidSkinId(id)) allSkins.add(id);
      });
    }
    if (typeof src.equippedSkin === 'string' && isValidSkinId(src.equippedSkin)) {
      cloudEquippedSkin = src.equippedSkin;
    }
    if (Array.isArray(src.permanentAchievements)) {
      src.permanentAchievements.forEach((a: string) => allPermAch.add(a));
    }
    if (Array.isArray(src.claimedQuests)) {
      src.claimedQuests.forEach((q: string) => allClaimedQuests.add(q));
    }
    if (Array.isArray(src.unlockedAchievements)) {
      src.unlockedAchievements.forEach((a: string) => allUnlockedAchievements.add(a));
    }
    if (typeof src.totalPlaytimeSeconds === 'number') {
      maxCareerPlaytime = Math.max(maxCareerPlaytime, src.totalPlaytimeSeconds);
    }
    if (typeof src.lifetimeAllSeasonsClicks === 'number') {
      maxCareerClicks = Math.max(maxCareerClicks, src.lifetimeAllSeasonsClicks);
    }
    if (typeof src.highestCps === 'number') {
      maxCareerHighestCps = Math.max(maxCareerHighestCps, src.highestCps);
    }
    if (typeof src.clicks === 'number' && !wasExplicitlyReset) {
      maxCareerClicks = Math.max(maxCareerClicks, src.clicks);
      cloudMaxClicks = Math.max(cloudMaxClicks, src.clicks);
    }
    if (typeof src.totalClicks === 'number' && !wasExplicitlyReset) {
      maxCareerClicks = Math.max(maxCareerClicks, src.totalClicks);
      cloudMaxClicks = Math.max(cloudMaxClicks, src.totalClicks);
    }
    if (typeof src.lifetimeAllSeasonsCoins === 'number' && !wasExplicitlyReset) {
      maxCareerCoins = Math.max(maxCareerCoins, src.lifetimeAllSeasonsCoins);
    }
    if (typeof src.lastDailyLoginClaimDate === 'string' && src.lastDailyLoginClaimDate) {
      if (!latestDailyLoginClaimDate || src.lastDailyLoginClaimDate > latestDailyLoginClaimDate) {
        latestDailyLoginClaimDate = src.lastDailyLoginClaimDate;
      }
    }

    const srcSeasonId = src.seasonId || src.currentSeasonId || activeSeasonId;
    if (srcSeasonId !== activeSeasonId) {
      continue;
    }

    if (Array.isArray(src.unlockedRealms)) {
      src.unlockedRealms.forEach((r: string) => allUnlockedRealms.add(r));
    }

    const pCount =
      typeof src.prestigeCount === 'number'
        ? src.prestigeCount
        : typeof src.rebirthCount === 'number'
        ? src.rebirthCount
        : 0;
    const pShards = typeof src.prestigeShards === 'number' ? src.prestigeShards : 0;
    const lpShards =
      typeof src.lifetimePrestigeShards === 'number' ? src.lifetimePrestigeShards : pShards;
    const lCoins =
      typeof src.lifetimeCoins === 'number'
        ? src.lifetimeCoins
        : typeof src.seasonalScore === 'number'
        ? src.seasonalScore
        : 0;
    const saveTs =
      typeof src.lastSaveTime === 'number'
        ? src.lastSaveTime
        : typeof src.updatedAtMs === 'number'
        ? src.updatedAtMs
        : 0;

    if (!wasExplicitlyReset) {
      cloudMaxPrestigeCount = Math.max(cloudMaxPrestigeCount, pCount);
      cloudMaxPrestigeShards = Math.max(cloudMaxPrestigeShards, pShards);
      cloudMaxLifetimePrestigeShards = Math.max(cloudMaxLifetimePrestigeShards, lpShards);
      cloudMaxCritClicks = Math.max(
        cloudMaxCritClicks,
        typeof src.criticalClicks === 'number' ? src.criticalClicks : 0
      );
      cloudMaxGoldenClicked = Math.max(
        cloudMaxGoldenClicked,
        typeof src.goldenMatthewsClicked === 'number' ? src.goldenMatthewsClicked : 0
      );
      cloudMaxGiantClicked = Math.max(
        cloudMaxGiantClicked,
        typeof src.giantMatthewsClicked === 'number' ? src.giantMatthewsClicked : 0
      );
      cloudMaxComboReached = Math.max(
        cloudMaxComboReached,
        typeof src.maxComboReached === 'number' ? src.maxComboReached : 0
      );
    }

    const candSnap: ProgressSnapshot = {
      lifetimeCoins: lCoins,
      prestigeCount: pCount,
      saveTs,
    };

    if (
      bestCloudSnapshot.lifetimeCoins < 0 ||
      isProgressSnapshotBetter(candSnap, bestCloudSnapshot)
    ) {
      bestCloudSnapshot = candSnap;
      // Preserve upgrades from a richer source if the new winner lacks an upgrades map
      const mergedUpgrades =
        src.upgrades && typeof src.upgrades === 'object'
          ? src.upgrades
          : bestCloudSeason.upgrades;
      bestCloudSeason = {
        ...bestCloudSeason,
        ...src,
        upgrades: mergedUpgrades,
      };
    } else {
      bestCloudSeason = { ...src, ...bestCloudSeason };
      if (saveTs > bestCloudSnapshot.saveTs) {
        bestCloudSnapshot.saveTs = saveTs;
      }
    }
  }

  const normalizedUsername = (params.username || rtdbUser?.username || '').trim().toLowerCase();
  const hasFutureSeasonWin = [
    ...(Array.isArray(localState.winnerBadges) ? localState.winnerBadges : []),
    ...(Array.isArray(rtdbUser?.winnerBadges) ? rtdbUser.winnerBadges : []),
  ].some((b) => typeof b?.seasonNumber === 'number' && b.seasonNumber >= 2);
  const canHoldChampionSkin =
    normalizedUsername === SEASON_1_CHAMPION_USERNAME || hasFutureSeasonWin;
  if (!canHoldChampionSkin) {
    allSkins.delete('champion_matthew');
  }

  // Before Season 2 officially launches on Monday, live Season 1 / Downtime saves must never
  // retain Season 2 dev-preview skins leaked from earlier sandbox toggles.
  const stripPreLaunchSeason2Skins =
    nowMs < SEASON_2_CONFIG.launchTimeMs && activeSeasonId === 'season_1';
  if (stripPreLaunchSeason2Skins) {
    for (const skinId of Array.from(allSkins)) {
      if (isSeason2OnlySkinId(skinId)) {
        allSkins.delete(skinId);
      }
    }
  }

  const mergedSkins = Array.from(allSkins);
  const localInActiveSeason = localState.currentSeasonId === activeSeasonId;
  const localSnap: ProgressSnapshot = localInActiveSeason
    ? {
        lifetimeCoins: localState.lifetimeCoins || 0,
        prestigeCount: localState.prestigeCount || 0,
        saveTs: localState.lastSaveTime || 0,
      }
    : {
        lifetimeCoins: -1,
        prestigeCount: -1,
        saveTs: 0,
      };

  const forceCloudAfterReset =
    resetAtMs > 0 &&
    (bestCloudSnapshot.lifetimeCoins <= 0 || resetAtMs >= (bestCloudSnapshot.saveTs || 0));

  const isFreshSeasonRollover = !localInActiveSeason && bestCloudSnapshot.lifetimeCoins < 0;

  const useCloudBase =
    isCloudAdjustmentPending ||
    isFreshSeasonRollover ||
    forceCloudAfterReset ||
    (bestCloudSnapshot.lifetimeCoins >= 0 &&
      !isProgressSnapshotBetter(localSnap, bestCloudSnapshot));

  const authoritativeSeason: Record<string, any> =
    isFreshSeasonRollover ? {} : useCloudBase ? bestCloudSeason : localState;

  const chosenEquippedSkin =
    useCloudBase && cloudEquippedSkin && mergedSkins.includes(cloudEquippedSkin)
      ? cloudEquippedSkin
      : mergedSkins.includes(localState.equippedSkin)
      ? localState.equippedSkin
      : cloudEquippedSkin && mergedSkins.includes(cloudEquippedSkin)
      ? cloudEquippedSkin
      : 'classic_matthew';

  const newestCloudSaveTs = Math.max(
    bestCloudSnapshot.saveTs || 0,
    typeof rtdbSeason?.lastSaveTime === 'number' ? rtdbSeason.lastSaveTime : 0,
    typeof rtdbUser?.updatedAtMs === 'number' ? rtdbUser.updatedAtMs : 0,
    typeof rtdbLb?.updatedAtMs === 'number' ? rtdbLb.updatedAtMs : 0
  );

  const authUpgrades =
    isFreshSeasonRollover || forceCloudAfterReset
      ? {}
      : authoritativeSeason.upgrades && typeof authoritativeSeason.upgrades === 'object'
      ? authoritativeSeason.upgrades
      : {};
  const hasAnyPassiveUpgrades = Object.values(authUpgrades).some(
    (cnt) => typeof cnt === 'number' && cnt > 0
  );
  const authCoins = isFreshSeasonRollover
    ? 0
    : typeof authoritativeSeason.coins === 'number'
    ? authoritativeSeason.coins
    : localInActiveSeason
    ? localState.coins || 0
    : 0;

  // Prevent stale offline earnings after a Rebirth or Admin Reset when switching devices
  let effectiveLastSaveTime =
    useCloudBase && newestCloudSaveTs > 0
      ? newestCloudSaveTs
      : localState.lastSaveTime || nowMs;

  if ((!hasAnyPassiveUpgrades && authCoins === 0) || forceCloudAfterReset) {
    effectiveLastSaveTime = nowMs;
  }

  const forceSeasonalZero = forceCloudAfterReset || isFreshSeasonRollover;

  const mergedPrestigeCount = forceSeasonalZero
    ? 0
    : isCloudAdjustmentPending
    ? typeof authoritativeSeason.prestigeCount === 'number'
      ? authoritativeSeason.prestigeCount
      : typeof authoritativeSeason.rebirthCount === 'number'
      ? authoritativeSeason.rebirthCount
      : cloudMaxPrestigeCount
    : Math.max(
        typeof authoritativeSeason.prestigeCount === 'number'
          ? authoritativeSeason.prestigeCount
          : typeof authoritativeSeason.rebirthCount === 'number'
          ? authoritativeSeason.rebirthCount
          : 0,
        cloudMaxPrestigeCount,
        localInActiveSeason ? localState.prestigeCount || 0 : 0
      );

  const mergedPrestigeShards = forceSeasonalZero
    ? 0
    : isCloudAdjustmentPending
    ? typeof authoritativeSeason.prestigeShards === 'number'
      ? authoritativeSeason.prestigeShards
      : cloudMaxPrestigeShards
    : Math.max(
        typeof authoritativeSeason.prestigeShards === 'number'
          ? authoritativeSeason.prestigeShards
          : 0,
        cloudMaxPrestigeShards,
        localInActiveSeason ? localState.prestigeShards || 0 : 0
      );

  const mergedLifetimePrestigeShards = forceSeasonalZero
    ? 0
    : isCloudAdjustmentPending
    ? typeof authoritativeSeason.lifetimePrestigeShards === 'number'
      ? authoritativeSeason.lifetimePrestigeShards
      : mergedPrestigeShards
    : Math.max(
        typeof authoritativeSeason.lifetimePrestigeShards === 'number'
          ? authoritativeSeason.lifetimePrestigeShards
          : mergedPrestigeShards,
        cloudMaxLifetimePrestigeShards,
        localInActiveSeason ? localState.lifetimePrestigeShards || 0 : 0
      );

  const mergedClicks = forceSeasonalZero
    ? 0
    : isCloudAdjustmentPending
    ? typeof authoritativeSeason.clicks === 'number'
      ? authoritativeSeason.clicks
      : cloudMaxClicks
    : Math.max(
        typeof authoritativeSeason.clicks === 'number' ? authoritativeSeason.clicks : 0,
        cloudMaxClicks,
        localInActiveSeason ? localState.clicks || 0 : 0
      );

  const mergedLifetimeCoins = forceSeasonalZero
    ? 0
    : isCloudAdjustmentPending
    ? Math.max(
        typeof authoritativeSeason.lifetimeCoins === 'number'
          ? authoritativeSeason.lifetimeCoins
          : 0,
        typeof authoritativeSeason.seasonalScore === 'number'
          ? authoritativeSeason.seasonalScore
          : 0
      )
    : Math.max(
        typeof authoritativeSeason.lifetimeCoins === 'number'
          ? authoritativeSeason.lifetimeCoins
          : 0,
        typeof authoritativeSeason.seasonalScore === 'number'
          ? authoritativeSeason.seasonalScore
          : 0,
        localInActiveSeason ? localState.lifetimeCoins || 0 : 0
      );

  const mergedSeasonalScore = forceSeasonalZero
    ? 0
    : isCloudAdjustmentPending
    ? Math.max(
        typeof authoritativeSeason.seasonalScore === 'number'
          ? authoritativeSeason.seasonalScore
          : 0,
        Math.floor(mergedLifetimeCoins)
      )
    : Math.max(
        typeof authoritativeSeason.seasonalScore === 'number'
          ? authoritativeSeason.seasonalScore
          : 0,
        Math.floor(mergedLifetimeCoins),
        localInActiveSeason ? localState.seasonalScore || 0 : 0
      );

  const mergedRaw: Partial<GameState> = {
    ...localState,
    ...authoritativeSeason,
    coins: forceSeasonalZero ? 0 : authCoins,
    lifetimeCoins: mergedLifetimeCoins,
    seasonalScore: mergedSeasonalScore,
    clicks: mergedClicks,
    criticalClicks: forceSeasonalZero
      ? 0
      : Math.max(
          typeof authoritativeSeason.criticalClicks === 'number'
            ? authoritativeSeason.criticalClicks
            : 0,
          cloudMaxCritClicks,
          localInActiveSeason ? localState.criticalClicks || 0 : 0
        ),
    maxComboReached: forceSeasonalZero
      ? 0
      : Math.max(
          typeof authoritativeSeason.maxComboReached === 'number'
            ? authoritativeSeason.maxComboReached
            : 0,
          cloudMaxComboReached,
          localInActiveSeason ? localState.maxComboReached || 0 : 0
        ),
    prestigeCount: mergedPrestigeCount,
    prestigeShards: mergedPrestigeShards,
    lifetimePrestigeShards: mergedLifetimePrestigeShards,
    upgrades: forceSeasonalZero ? {} : authUpgrades,
    currentRealm: isFreshSeasonRollover
      ? 'earth'
      : (authoritativeSeason.currentRealm as GameState['currentRealm']) || localState.currentRealm || 'earth',
    unlockedRealms: forceSeasonalZero
      ? ['earth']
      : (Array.from(allUnlockedRealms) as GameState['unlockedRealms']),
    uperCompleted: isFreshSeasonRollover ? false : Boolean(authoritativeSeason.uperCompleted || localState.uperCompleted),
    pets: isFreshSeasonRollover ? [] : (authoritativeSeason.pets as GameState['pets']) ?? localState.pets ?? [],
    equippedPetIds: isFreshSeasonRollover ? [] : (authoritativeSeason.equippedPetIds as string[]) ?? localState.equippedPetIds ?? [],
    chestsOpened: isFreshSeasonRollover ? 0 : (typeof authoritativeSeason.chestsOpened === 'number' ? authoritativeSeason.chestsOpened : localState.chestsOpened || 0),
    zombiesDefeated: isFreshSeasonRollover ? 0 : (typeof authoritativeSeason.zombiesDefeated === 'number' ? authoritativeSeason.zombiesDefeated : localState.zombiesDefeated || 0),
    hasMatthewShopToken: isFreshSeasonRollover ? false : Boolean(authoritativeSeason.hasMatthewShopToken ?? localState.hasMatthewShopToken),
    matthewShopTokens: isFreshSeasonRollover ? 0 : (typeof authoritativeSeason.matthewShopTokens === 'number' ? authoritativeSeason.matthewShopTokens : localState.matthewShopTokens || 0),
    sandboxS2Enabled: nowMs >= SEASON_2_CONFIG.launchTimeMs ? false : Boolean(localState.sandboxS2Enabled),
    unlockedSkins: mergedSkins,
    equippedSkin: chosenEquippedSkin,
    gems: Math.max(
      typeof authoritativeSeason.gems === 'number' ? authoritativeSeason.gems : 0,
      typeof rtdbUser?.gems === 'number' ? rtdbUser.gems : 0,
      localState.gems || 0
    ),
    lifetimeGems: Math.max(
      localState.lifetimeGems || 0,
      typeof rtdbUser?.lifetimeGems === 'number' ? rtdbUser.lifetimeGems : 0
    ),
    lastDailyLoginClaimDate: latestDailyLoginClaimDate,
    season2IntroSeen: forceCloudAfterReset
      ? false
      : Boolean(localState.season2IntroSeen || rtdbUser?.season2IntroSeen),
    totalPlaytimeSeconds: maxCareerPlaytime,
    lifetimeAllSeasonsClicks: Math.max(maxCareerClicks, mergedClicks),
    highestCps: maxCareerHighestCps,
    lifetimeAllSeasonsCoins: Math.max(maxCareerCoins, mergedLifetimeCoins),
    goldenMatthewsClicked: forceCloudAfterReset
      ? 0
      : Math.max(
          typeof authoritativeSeason.goldenMatthewsClicked === 'number'
            ? authoritativeSeason.goldenMatthewsClicked
            : 0,
          cloudMaxGoldenClicked,
          localState.goldenMatthewsClicked || 0
        ),
    giantMatthewsClicked: forceCloudAfterReset
      ? 0
      : Math.max(
          typeof authoritativeSeason.giantMatthewsClicked === 'number'
            ? authoritativeSeason.giantMatthewsClicked
            : 0,
          cloudMaxGiantClicked,
          localState.giantMatthewsClicked || 0
        ),
    permanentAchievements: Array.from(allPermAch),
    unlockedAchievements: forceCloudAfterReset ? [] : Array.from(allUnlockedAchievements),
    claimedQuests: forceCloudAfterReset ? [] : Array.from(allClaimedQuests),
    currentSeasonId: activeSeasonId,
    lastOwnerUid: uid,
    lastSaveTime: effectiveLastSaveTime,
    settings: {
      ...localState.settings,
      ...(rtdbUser?.settings && typeof rtdbUser.settings === 'object' ? rtdbUser.settings : {}),
    },
  };

  let reconciled = sanitizeAndValidateGameState(mergedRaw);
  let recoveredFromCareerLoss = false;

  // One-time recovery for Marshallb78 (89nsfff2YtaEVcNTHUBDq22V4FW2) after the earlier
  // device-switch overwrite (322.2 Dc -> 2 No), using the higher career values preserved in RTDB.
  if (
    uid === MARSHALL_RECOVERY_UID &&
    activeSeasonId === 'season_1' &&
    !wasExplicitlyReset &&
    reconciled.lifetimeCoins < MARSHALL_RECOVERED_SCORE
  ) {
    const recoveredLifetime = Math.max(
      reconciled.lifetimeCoins,
      maxCareerCoins,
      MARSHALL_RECOVERED_SCORE
    );
    reconciled = sanitizeAndValidateGameState({
      ...reconciled,
      coins: Math.max(reconciled.coins, MARSHALL_RECOVERED_COINS),
      lifetimeCoins: recoveredLifetime,
      seasonalScore: Math.max(reconciled.seasonalScore, Math.floor(recoveredLifetime)),
      clicks: Math.max(reconciled.clicks, maxCareerClicks, MARSHALL_RECOVERED_CLICKS),
      lifetimeAllSeasonsCoins: Math.max(reconciled.lifetimeAllSeasonsCoins, recoveredLifetime),
      lifetimeAllSeasonsClicks: Math.max(
        reconciled.lifetimeAllSeasonsClicks,
        maxCareerClicks,
        MARSHALL_RECOVERED_CLICKS
      ),
      lastOwnerUid: uid,
      lastSaveTime: nowMs,
    });
    recoveredFromCareerLoss = true;
  }

  if (needsLiamS2Reset) {
    const historyMax = (
      Array.isArray(rtdbUser?.seasonHistory)
        ? rtdbUser.seasonHistory
        : localState.seasonHistory || []
    ).reduce((acc: number, s: any) => Math.max(acc, Number(s?.finalScore) || 0), 0);
    const preservedS1Skins = reconciled.unlockedSkins.filter((id) => !isSeason2OnlySkinId(id));
    reconciled = sanitizeAndValidateGameState({
      ...reconciled,
      coins: 0,
      lifetimeCoins: 0,
      seasonalScore: 0,
      clicks: 0,
      criticalClicks: 0,
      maxComboReached: 0,
      upgrades: {},
      currentRealm: 'earth',
      unlockedRealms: ['earth'],
      uperCompleted: false,
      uperCompletionModalDismissed: false,
      prestigeCount: 0,
      prestigeShards: 0,
      lifetimePrestigeShards: 0,
      prestigeUpgrades: {},
      unlockedAchievements: [],
      claimedQuests: [],
      chestsOpened: 0,
      cratesOpened: 0,
      zombiesDefeated: 0,
      zombiesStolenCoins: 0,
      zombieHitsTaken: 0,
      goldenMatthewsClicked: 0,
      giantMatthewsClicked: 0,
      pets: [],
      equippedPetIds: [],
      sealedEggs: createEmptySealedEggs(),
      hasMatthewShopToken: false,
      matthewShopTokens: 0,
      unlockedCursors: [STARTER_CURSOR_ID],
      equippedCursorId: STARTER_CURSOR_ID,
      unlockedSkins: preservedS1Skins,
      equippedSkin: preservedS1Skins.includes('champion_matthew')
        ? 'champion_matthew'
        : 'classic_matthew',
      eventStats: {
        eventId: MATTHEW_STORM_CONFIG.eventId,
        activeSeconds: 0,
        gemsEarned: 0,
        giantMatthewsClicked: 0,
        giantMatthewRewardsCoins: 0,
        stormSkinsPurchased: [],
      },
      lifetimeAllSeasonsCoins: historyMax,
      appliedCloudAdjustmentAtMs: LIAM_S2_REBALANCE_REVISION_MS,
      lastOwnerUid: uid,
      lastSaveTime: nowMs,
    });
  }

  reconciled = {
    ...reconciled,
    appliedCloudAdjustmentAtMs: needsLiamS2Reset
      ? LIAM_S2_REBALANCE_REVISION_MS
      : Math.max(localAppliedAdjustmentAtMs, cloudAdjustmentAtMs) || undefined,
    lastOwnerUid: uid,
    lastSaveTime:
      recoveredFromCareerLoss || needsLiamS2Reset
        ? nowMs
        : isCloudAdjustmentPending
        ? Math.max(nowMs, effectiveLastSaveTime)
        : effectiveLastSaveTime,
  };

  // Only push back up if local state contributed newer gains, missing skins, claim dates, removed unauthorized champion skin, or recovered Marshallb78's score;
  // avoids redundant writes when cloud is already authoritative and unchanged.
  const cloudDailyDate =
    typeof rtdbUser?.lastDailyLoginClaimDate === 'string' ? rtdbUser.lastDailyLoginClaimDate : null;
  const cloudSkinSet = new Set(
    Array.isArray(rtdbUser?.unlockedSkins) ? rtdbUser.unlockedSkins : []
  );
  const hasNewSkinsForCloud = mergedSkins.some((id) => !cloudSkinSet.has(id));
  const hadUnauthorizedChampionInCloud =
    !canHoldChampionSkin &&
    (cloudSkinSet.has('champion_matthew') || rtdbUser?.equippedSkin === 'champion_matthew');
  const hadLeakedSeason2InCloud =
    stripPreLaunchSeason2Skins &&
    (Array.from(cloudSkinSet).some((id) => isSeason2OnlySkinId(id)) ||
      (typeof rtdbUser?.equippedSkin === 'string' && isSeason2OnlySkinId(rtdbUser.equippedSkin)));
  const shouldPushToCloud =
    needsLiamS2Reset ||
    recoveredFromCareerLoss ||
    hadUnauthorizedChampionInCloud ||
    hadLeakedSeason2InCloud ||
    !useCloudBase ||
    hasNewSkinsForCloud ||
    (Boolean(latestDailyLoginClaimDate) && latestDailyLoginClaimDate !== cloudDailyDate) ||
    Boolean(reconciled.season2IntroSeen && !rtdbUser?.season2IntroSeen);

  return {
    state: reconciled,
    shouldPushToCloud:
      !forceCloudAfterReset && (!isCloudAdjustmentPending || needsLiamS2Reset) && shouldPushToCloud,
    recoveredFromCareerLoss,
    season2ResetApplied: needsLiamS2Reset,
  };
}

/**
 * Loads the player's profile and current seasonal progress from Firebase Realtime Database
 * BEFORE local state updates, offline earnings, or autosaves run.
 * - Deduplicates concurrent calls per UID.
 * - NEVER overwrites cloud if the RTDB network read failed/timed out.
 */
export async function loadAndReconcileCloudSave(
  uid: string,
  username: string,
  localState: GameState
): Promise<GameState> {
  if (!uid) return localState;

  const effectiveSeason = getEffectiveSeasonInfo(uid, localState.sandboxS2Enabled);
  const isSandbox = effectiveSeason.isSandbox;
  const inflightKey = `${isSandbox ? 'sbx_' : ''}${uid}`;

  const existingPromise = reconcileInFlightByUid.get(inflightKey);
  if (existingPromise) {
    return existingPromise;
  }

  const work = (async (): Promise<GameState> => {
    const activeSeason = effectiveSeason;

    // Pre-Monday Season 2 dev preview is completely ephemeral: never read or persist sandbox_s2/.
    if (isSandbox) {
      try {
        await refreshCloudBans();
      } catch {
        // ignore ban refresh errors in ephemeral preview
      }
      blockedOverwriteUids.delete(uid);
      verifiedInitialPullUids.add(uid);
      const allowChamp =
        username.trim().toLowerCase() === SEASON_1_CHAMPION_USERNAME ||
        (localState.winnerBadges || []).some((b) => b.seasonNumber >= 2);
      const cleanLiveSkins = Array.from(
        new Set(['classic_matthew', ...(localState.unlockedSkins || [])])
      ).filter(
        (id) => isValidSkinId(id) && !isSeason2OnlySkinId(id) && (id !== 'champion_matthew' || allowChamp)
      );
      const cleanEquipped = cleanLiveSkins.includes(localState.equippedSkin)
        ? localState.equippedSkin
        : 'classic_matthew';
      const ephemeralS2 = loadSandboxGame();
      return {
        ...ephemeralS2,
        gems: localState.gems || 0,
        lifetimeGems: localState.lifetimeGems || 0,
        winnerBadges: localState.winnerBadges || [],
        permanentAchievements: localState.permanentAchievements || [],
        seasonHistory: localState.seasonHistory || [],
        unlockedSkins: cleanLiveSkins,
        equippedSkin: cleanEquipped,
        currentSeasonId: activeSeason.seasonId,
        sandboxS2Enabled: true,
        lastOwnerUid: uid,
      };
    }

    const storageOverride = undefined;

    try {
      const [userRes, lbRes, liveSkinsRes] = await Promise.all([
        rtdbRestGetWithStatus<Record<string, any>>(
          scopeRtdbPath(`users/${uid}`, isSandbox),
          6500,
          1
        ),
        rtdbRestGetWithStatus<Record<string, any>>(
          scopeRtdbPath(`leaderboards/${activeSeason.seasonId}/${uid}`, isSandbox),
          6500,
          1
        ),
        isSandbox
          ? rtdbRestGetWithStatus<string[]>(`users/${uid}/unlockedSkins`, 4500, 0)
          : Promise.resolve({ ok: true, status: 200, data: null as string[] | null }),
        refreshCloudBans(),
      ]);

      // If network read failed or timed out, NEVER treat as empty cloud and block overwriting cloud!
      if (!userRes.ok || !lbRes.ok) {
        blockedOverwriteUids.add(uid);
        return localState;
      }

      const livePermanentSkins =
        isSandbox && liveSkinsRes?.ok && Array.isArray(liveSkinsRes.data)
          ? liveSkinsRes.data.filter((id) => isValidSkinId(id))
          : [];
      const marshallRestoreSkins =
        uid === MARSHALL_RECOVERY_UID ? MARSHALL_SEASON_1_SKINS : [];
      const allowChampionHere =
        username.trim().toLowerCase() === SEASON_1_CHAMPION_USERNAME ||
        (localState.winnerBadges || []).some((b) => b.seasonNumber >= 2);
      const seededLocalSkins = Array.from(
        new Set([
          'classic_matthew',
          ...(localState.unlockedSkins || []),
          ...livePermanentSkins,
          ...marshallRestoreSkins,
        ])
      ).filter((id) => id !== 'champion_matthew' || allowChampionHere);
      const effectiveLocalState: GameState = {
        ...localState,
        unlockedSkins: seededLocalSkins,
      };

      blockedOverwriteUids.delete(uid);
      verifiedInitialPullUids.add(uid);

      const rtdbUser = userRes.data;
      const rtdbLb = lbRes.data;

      const cloudUpdatedAt = Math.max(
        typeof rtdbUser?.updatedAtMs === 'number' ? rtdbUser.updatedAtMs : 0,
        typeof rtdbLb?.updatedAtMs === 'number' ? rtdbLb.updatedAtMs : 0
      );
      if (cloudUpdatedAt > 0) {
        lastKnownCloudUpdatedAtByUid.set(inflightKey, cloudUpdatedAt);
      }

      const banRecord = getCachedBanRecord(uid, username);
      const resetRecord = getCachedResetRecord(uid);
      const wasExplicitlyReset =
        Boolean(rtdbUser?.resetAtMs) ||
        Boolean(rtdbLb?.isReset) ||
        Boolean(resetRecord);

      const hasAnyCloudData = Boolean(rtdbUser) || Boolean(rtdbLb);

      if (!hasAnyCloudData && !banRecord) {
        const cleanInitial =
          isSandbox || (effectiveLocalState.lastOwnerUid && effectiveLocalState.lastOwnerUid !== uid)
            ? getDefaultGameState()
            : effectiveLocalState;
        const taggedInitial: GameState = {
          ...cleanInitial,
          unlockedSkins: seededLocalSkins,
          currentSeasonId: activeSeason.seasonId,
          sandboxS2Enabled: isSandbox,
          coins: isSandbox ? 0 : cleanInitial.coins,
          lifetimeCoins: isSandbox ? 0 : cleanInitial.lifetimeCoins,
          seasonalScore: isSandbox ? 0 : cleanInitial.seasonalScore,
          lastOwnerUid: uid,
        };
        saveGame(taggedInitial, true, storageOverride);
        saveStateToCloud(uid, username, taggedInitial, true).catch(() => {});
        return taggedInitial;
      }

      const resetAtMs = Math.max(
        typeof rtdbUser?.resetAtMs === 'number' ? rtdbUser.resetAtMs : 0,
        resetRecord?.resetAtMs || 0
      );

      const { state: reconciled, shouldPushToCloud, season2ResetApplied } =
        reconcileCloudAndLocalState({
          uid,
          username,
          localState: isSandbox
            ? { ...effectiveLocalState, currentSeasonId: activeSeason.seasonId, sandboxS2Enabled: true }
            : effectiveLocalState,
          rtdbUser,
          rtdbLb,
          legacySources: [],
          wasExplicitlyReset,
          resetAtMs,
          activeSeasonId: activeSeason.seasonId,
          nowMs: Date.now(),
        });

      const ignoreStaleS2Extras = wasExplicitlyReset || Boolean(season2ResetApplied);

      const mergedPetsMap = new Map<string, GameState['pets'][number]>();
      for (const p of reconciled.pets || []) {
        if (p && typeof p.instanceId === 'string') mergedPetsMap.set(p.instanceId, p);
      }
      if (!ignoreStaleS2Extras && Array.isArray(rtdbUser?.pets)) {
        for (const p of rtdbUser.pets) {
          if (!p || typeof p.instanceId !== 'string') continue;
          const prevPet = mergedPetsMap.get(p.instanceId);
          if (!prevPet || (Number(p.level) || 1) > (Number(prevPet.level) || 1)) {
            mergedPetsMap.set(p.instanceId, { ...prevPet, ...p, hunger: 100 });
          }
        }
      }
      const mergedPets = Array.from(mergedPetsMap.values());
      const validPetIds = new Set(mergedPets.map((p) => p.instanceId));
      const rawEquippedPets = ignoreStaleS2Extras
        ? []
        : Array.from(
            new Set([
              ...(reconciled.equippedPetIds || []),
              ...(Array.isArray(rtdbUser?.equippedPetIds) ? rtdbUser.equippedPetIds : []),
            ])
          ).filter((id) => validPetIds.has(id));
      const mergedEquippedPetIds =
        rawEquippedPets.length > 0
          ? rawEquippedPets.slice(0, 3)
          : mergedPets.slice(0, 3).map((p) => p.instanceId);

      const mergedEggs = { ...reconciled.sealedEggs };
      if (!ignoreStaleS2Extras && rtdbUser?.sealedEggs && typeof rtdbUser.sealedEggs === 'object') {
        for (const [k, v] of Object.entries(rtdbUser.sealedEggs)) {
          const n = Math.max(0, Number(v) || 0);
          mergedEggs[k as keyof typeof mergedEggs] = Math.max(
            mergedEggs[k as keyof typeof mergedEggs] || 0,
            n
          );
        }
      }

      const cloudTokens =
        !ignoreStaleS2Extras && typeof rtdbUser?.matthewShopTokens === 'number'
          ? Math.max(0, Math.floor(rtdbUser.matthewShopTokens))
          : ignoreStaleS2Extras
          ? 0
          : undefined;
      const localTokens = Math.max(0, Math.floor(reconciled.matthewShopTokens ?? 0));
      const cloudNewer =
        typeof rtdbUser?.updatedAtMs === 'number' &&
        rtdbUser.updatedAtMs > (reconciled.lastSaveTime || 0);
      const localNewerAfterSpend =
        typeof rtdbUser?.updatedAtMs === 'number' &&
        (reconciled.lastSaveTime || 0) > rtdbUser.updatedAtMs &&
        typeof cloudTokens === 'number' &&
        localTokens < cloudTokens;
      const mergedShopTokens =
        cloudNewer && cloudTokens !== undefined
          ? cloudTokens
          : localNewerAfterSpend
          ? localTokens
          : Math.max(localTokens, cloudTokens ?? 0);

      const rawBadges = Array.isArray(rtdbUser?.winnerBadges)
        ? rtdbUser.winnerBadges
        : reconciled.winnerBadges || [];
      const canHoldS1WinnerBadge =
        username.trim().toLowerCase() === SEASON_1_CHAMPION_USERNAME;
      const sanitizedBadges = rawBadges.filter(
        (b: any) => b && (b.seasonNumber !== 1 || canHoldS1WinnerBadge)
      );
      const canHoldChampionFinal =
        canHoldS1WinnerBadge ||
        sanitizedBadges.some((b: any) => typeof b?.seasonNumber === 'number' && b.seasonNumber >= 2);
      const filteredUnlockedSkins = canHoldChampionFinal
        ? reconciled.unlockedSkins
        : reconciled.unlockedSkins.filter((id) => id !== 'champion_matthew');

      const mergedUserFields: GameState = sanitizeAndValidateGameState({
        ...reconciled,
        unlockedSkins: filteredUnlockedSkins,
        equippedSkin:
          !canHoldChampionFinal && reconciled.equippedSkin === 'champion_matthew'
            ? 'classic_matthew'
            : reconciled.equippedSkin,
        pets: mergedPets,
        equippedPetIds: mergedEquippedPetIds,
        sealedEggs: mergedEggs,
        foodInventory: rtdbUser?.foodInventory
          ? { ...reconciled.foodInventory, ...rtdbUser.foodInventory }
          : reconciled.foodInventory,
        ownedCosmetics: Array.isArray(rtdbUser?.ownedCosmetics)
          ? Array.from(new Set([...(reconciled.ownedCosmetics || []), ...rtdbUser.ownedCosmetics]))
          : reconciled.ownedCosmetics,
        equippedCosmetics: {
          hat: null,
          glasses: rtdbUser?.equippedCosmetics?.glasses || reconciled.equippedCosmetics?.glasses || null,
        },
        hasMatthewShopToken: ignoreStaleS2Extras ? false : mergedShopTokens > 0,
        matthewShopTokens: ignoreStaleS2Extras ? 0 : mergedShopTokens,
        unlockedCursors: ignoreStaleS2Extras
          ? [STARTER_CURSOR_ID]
          : Array.isArray(rtdbUser?.unlockedCursors)
          ? Array.from(new Set([...(reconciled.unlockedCursors || []), ...rtdbUser.unlockedCursors]))
          : reconciled.unlockedCursors || [],
        equippedCursorId: ignoreStaleS2Extras
          ? STARTER_CURSOR_ID
          : rtdbUser?.equippedCursorId ?? reconciled.equippedCursorId ?? null,
        cratesOpened: ignoreStaleS2Extras
          ? 0
          : Math.max(reconciled.cratesOpened || 0, Number(rtdbUser?.cratesOpened) || 0),
        winnerBadges: sanitizedBadges,
        clanId: rtdbUser?.clanId !== undefined ? rtdbUser.clanId : reconciled.clanId,
        clanName: rtdbUser?.clanName !== undefined ? rtdbUser.clanName : reconciled.clanName,
        chestsOpened: ignoreStaleS2Extras
          ? 0
          : Math.max(reconciled.chestsOpened || 0, Number(rtdbUser?.chestsOpened) || 0),
        zombiesDefeated: ignoreStaleS2Extras
          ? 0
          : Math.max(reconciled.zombiesDefeated || 0, Number(rtdbUser?.zombiesDefeated) || 0),
        zombiesStolenCoins: ignoreStaleS2Extras
          ? 0
          : Math.max(reconciled.zombiesStolenCoins || 0, Number(rtdbUser?.zombiesStolenCoins) || 0),
        zombieHitsTaken: ignoreStaleS2Extras
          ? 0
          : Math.max(reconciled.zombieHitsTaken ?? 0, Number(rtdbUser?.zombieHitsTaken) || 0),
        season2IntroSeen: Boolean(rtdbUser?.season2IntroSeen || reconciled.season2IntroSeen),
        sandboxS2Enabled: isSandbox || reconciled.sandboxS2Enabled,
      });

      saveGame(mergedUserFields, true, storageOverride);

      if (!banRecord && shouldPushToCloud) {
        await saveStateToCloud(uid, username, mergedUserFields, true).catch(() => {});
      }

      return mergedUserFields;
    } catch (err) {
      console.warn('Cloud reconciliation fallback to local state:', err);
      blockedOverwriteUids.add(uid);
      return localState;
    } finally {
      reconcileInFlightByUid.delete(inflightKey);
    }
  })();

  reconcileInFlightByUid.set(inflightKey, work);
  return work;
}

/**
 * Synchronous keepalive flush when a tab/browser is closed or backgrounded.
 * Only executes if this session already completed a clean initial cloud pull.
 */
export function saveStateToCloudKeepalive(
  uid: string,
  username: string,
  state: GameState
): void {
  if (!uid || !username) return;
  if (!verifiedInitialPullUids.has(uid) || blockedOverwriteUids.has(uid)) return;
  if (getCachedBanRecord(uid, username)) return;

  const activeSeason = getEffectiveSeasonInfo(uid, state.sandboxS2Enabled);
  // Pre-Monday Season 2 dev preview is strictly ephemeral and must not write to Firebase RTDB.
  if (activeSeason.isSandbox) return;
  const scopeKey = uid;
  const nowMs = Date.now();
  const userPayload = buildUserCloudPayload(uid, username, state, nowMs, activeSeason.seasonId);
  rtdbRestWriteKeepalive(scopeRtdbPath(`users/${uid}`, activeSeason.isSandbox), userPayload, 'PUT');
  updateLeaderboardEntryKeepalive(
    uid,
    username,
    state,
    activeSeason.seasonId,
    activeSeason.isSandbox
  );
  lastKnownCloudUpdatedAtByUid.set(scopeKey, nowMs);
}

/**
 * Persists player profile and seasonal progression directly to Firebase Realtime Database (`users/{uid}`)
 * and updates the Realtime Database Worldwide Leaderboard (`leaderboards/{seasonId}/{uid}`).
 */
export async function saveStateToCloud(
  uid: string,
  username: string,
  state: GameState,
  force = false
): Promise<boolean> {
  if (!uid || !username) return false;
  if (getCachedBanRecord(uid, username)) return false;

  if (!verifiedInitialPullUids.has(uid) || blockedOverwriteUids.has(uid)) {
    return false;
  }

  const activeSeason = getEffectiveSeasonInfo(uid, state.sandboxS2Enabled);
  // Pre-Monday Season 2 dev preview is strictly ephemeral and must not write to Firebase RTDB.
  if (activeSeason.isSandbox) return true;
  const isSandbox = false;
  const scopeKey = `${isSandbox ? 'sbx_' : ''}${uid}`;
  const playtimeBucket = Math.floor((state.totalPlaytimeSeconds || 0) / 20);
  const petSig = (state.pets || []).map((p) => `${p.instanceId}:${p.level}`).join(',');
  const upgradeCount = Object.values(state.upgrades || {}).reduce((acc, n) => acc + (n || 0), 0);
  const signature = `${isSandbox ? 'sbx' : 'live'}_${Math.floor(state.lifetimeCoins)}_${Math.floor(state.coins)}_${Math.floor(state.clicks)}_${state.prestigeCount}_${upgradeCount}_${state.equippedSkin}_${state.unlockedSkins.length}_${state.gems}_${state.lastDailyLoginClaimDate || ''}_${Boolean(state.season2IntroSeen)}_${petSig}_${(state.equippedPetIds || []).join(',')}_${state.matthewShopTokens ?? 0}_${state.hasMatthewShopToken}_${state.claimedQuests?.length || 0}_${playtimeBucket}_${username}`;

  if (!force && lastSavedSignatureByUid.get(scopeKey) === signature) {
    return true;
  }

  // Before doing a non-forced periodic overwrite, ensure another device hasn't jumped ahead!
  const lastCheck = lastSessionCheckAtByUid.get(scopeKey) || 0;
  if (!force && !isSandbox && Date.now() - lastCheck > 10000) {
    const foreignNewer = await hasForeignDeviceSavedMoreRecently(uid, isSandbox);
    if (foreignNewer) {
      if (foreignUpdateHandler) {
        foreignUpdateHandler(uid);
      }
      return false;
    }
  }

  const nowMs = Date.now();
  const userPayload = buildUserCloudPayload(uid, username, state, nowMs, activeSeason.seasonId);

  const [userOk, lbOk] = await Promise.all([
    rtdbRestWrite(scopeRtdbPath(`users/${uid}`, isSandbox), userPayload, 'PUT'),
    updateLeaderboardEntry(uid, username, state, activeSeason.seasonId, force, isSandbox),
  ]);

  if (userOk || lbOk) {
    lastSavedSignatureByUid.set(scopeKey, signature);
    lastKnownCloudUpdatedAtByUid.set(scopeKey, nowMs);
  }

  return userOk || lbOk;
}

export async function purchaseStormSkinAtomic(
  state: GameState,
  skinId: string,
  uid?: string | null,
  username?: string | null
): Promise<{ nextState: GameState; success: boolean; error?: string }> {
  const stormSkin = ALL_STORM_SKINS.find((s) => s.id === skinId);
  if (!stormSkin) {
    return { nextState: state, success: false, error: 'Invalid Matthew Storm skin.' };
  }

  if (state.unlockedSkins.includes(skinId)) {
    const equipped = equipSkin(state, skinId);
    saveGame(equipped);
    return { nextState: equipped, success: true };
  }

  const cost = stormSkin.gemCost ?? GEM_ECONOMY_CONFIG.stormSkinCostGems;
  if (state.gems < cost) {
    return {
      nextState: state,
      success: false,
      error: `Not enough Gems! Need ${cost} Gems (you have ${state.gems}).`,
    };
  }

  let updatedState: GameState = {
    ...state,
    gems: state.gems - cost,
    unlockedSkins: [...state.unlockedSkins, skinId],
    eventStats: {
      ...state.eventStats,
      stormSkinsPurchased: Array.from(
        new Set([...(state.eventStats?.stormSkinsPurchased || []), skinId])
      ),
    },
  };
  updatedState = equipSkin(updatedState, skinId);
  saveGame(updatedState);

  if (uid && username) {
    saveStateToCloud(uid, username, updatedState, true).catch(() => {});
  }

  return { nextState: updatedState, success: true };
}

/**
 * Shared sign-in reconciliation helper used by AccountModal & EscMenuModal:
 * - Isolates any prior owner's localStorage save so signing into another account never leaks state.
 * - Pulls & merges cloud progress before pushing back to Firebase.
 */
export async function signInAndReconcileAccount(
  uid: string,
  username: string,
  currentState: GameState
): Promise<GameState> {
  const isTesterSandbox = isSandboxSeason2Context(uid, currentState.sandboxS2Enabled);
  const baseLocalState = isTesterSandbox
    ? { ...loadSandboxGame(), sandboxS2Enabled: true }
    : currentState.lastOwnerUid && currentState.lastOwnerUid !== uid
      ? getDefaultGameState()
      : currentState;

  const merged = await loadAndReconcileCloudSave(uid, username, baseLocalState);
  const nextState: GameState = {
    ...merged,
    currentSeasonId: isTesterSandbox ? 'season_2' : merged.currentSeasonId,
    sandboxS2Enabled: isTesterSandbox ? true : merged.sandboxS2Enabled,
    lastOwnerUid: uid,
    cloudAccount: {
      uid,
      username,
      displayUsername: username,
      lastCloudSync: Date.now(),
    },
  };
  saveGame(nextState, true);
  saveStateToCloud(uid, username, nextState, true).catch(() => {});
  return nextState;
}

/**
 * Shared bidirectional Sync helper used by Manual Sync buttons:
 * - Always retrieves & merges cloud progress FIRST so a stale device never overwrites newer progress.
 */
export async function syncAccountBidirectional(
  uid: string,
  username: string,
  currentState: GameState
): Promise<{ nextState: GameState; ok: boolean }> {
  const reconciled = await loadAndReconcileCloudSave(uid, username, currentState);
  const ok = await saveStateToCloud(uid, username, reconciled, true);
  const now = Date.now();
  const nextState: GameState = {
    ...reconciled,
    lastOwnerUid: uid,
    cloudAccount: currentState.cloudAccount
      ? {
          ...currentState.cloudAccount,
          uid,
          username,
          displayUsername: username,
          lastCloudSync: now,
        }
      : {
          uid,
          username,
          displayUsername: username,
          lastCloudSync: now,
        },
  };
  saveGame(nextState, true);
  return { nextState, ok };
}
