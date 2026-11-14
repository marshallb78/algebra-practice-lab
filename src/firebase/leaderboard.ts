import {
  rtdbRestGet,
  rtdbRestWrite,
  rtdbRestWriteKeepalive,
  rtdbRestDelete,
  scopeRtdbPath,
} from './config';
import { GameState, SeasonWinnerBadge } from '../types/game';
import { SEASON_2_CONFIG } from '../config/gameConfig';
import { getActiveSeason } from '../utils/scheduleEngine';
import { getAscensionMultiplier } from '../data/prestige';
import {
  getCachedBanRecord,
  getCachedResetRecord,
  isDevAdminAccount,
  refreshCloudBans,
} from './moderation';

/**
 * Players who remain unbanned with full cloud saves and gameplay progression,
 * while staying omitted from all seasonal and mini leaderboards.
 */
export const LEADERBOARD_EXCLUDED_UIDS = new Set<string>([
  '0eFt9SNVpPSxm9SGPcD6n9W5u3E3', // GABBYDADDY69
]);

export const LEADERBOARD_EXCLUDED_USERNAMES = new Set<string>([
  'gabbydaddy69',
]);

export function isExcludedFromLeaderboard(
  uid?: string | null,
  username?: string | null,
  seasonId?: string | null,
  nowMs: number = Date.now()
): boolean {
  if (uid && LEADERBOARD_EXCLUDED_UIDS.has(uid.trim())) return true;
  const norm = (username || '').trim().toLowerCase();
  if (norm && LEADERBOARD_EXCLUDED_USERNAMES.has(norm)) return true;

  // Keep devs (Marshallb78 & testmarshall) completely off Season 2+ leaderboards until Monday launch
  const targetSeason = seasonId ?? getActiveSeason(nowMs).seasonId;
  if (
    nowMs < SEASON_2_CONFIG.launchTimeMs &&
    targetSeason !== 'season_1' &&
    isDevAdminAccount(uid, username)
  ) {
    return true;
  }

  return false;
}

export interface LeaderboardEntry {
  uid: string;
  username: string;
  seasonalScore: number;
  lifetimeCoins: number;
  totalClicks: number;
  highestCps?: number;
  rebirthCount: number;
  ascensionMultiplier: number;
  equippedSkin: string;
  unlockedSkins: string[];
  updatedAtMs: number;
  totalPlaytimeSeconds?: number;
  coins?: number;
  prestigeShards?: number;
  lifetimePrestigeShards?: number;
  gems?: number;
  lifetimeGems?: number;
  winnerBadges?: SeasonWinnerBadge[];
  clanName?: string | null;
  chestsOpened?: number;
  zombiesDefeated?: number;
  upgrades?: Record<string, number>;
  claimedQuests?: string[];
  unlockedAchievements?: string[];
  isReset?: boolean;
}

const lastPublishedSnapshotByUid = new Map<
  string,
  {
    score: number;
    rebirths: number;
    skin: string;
    skinsCount: number;
    playtimeBucket: number;
    username: string;
    publishedAtMs: number;
  }
>();

export function evictLeaderboardCacheForUid(uid: string): void {
  lastPublishedSnapshotByUid.delete(uid);
}

function parseRawEntry(uid: string, d: Record<string, any>): LeaderboardEntry {
  const rebirths = typeof d.rebirthCount === 'number' ? d.rebirthCount : 0;
  const shards = typeof d.prestigeShards === 'number' ? d.prestigeShards : rebirths;
  return {
    uid: d.uid || uid,
    username: d.username || 'Anonymous Matthew',
    seasonalScore: typeof d.seasonalScore === 'number' ? d.seasonalScore : 0,
    lifetimeCoins:
      typeof d.lifetimeCoins === 'number'
        ? d.lifetimeCoins
        : typeof d.seasonalScore === 'number'
        ? d.seasonalScore
        : 0,
    totalClicks: typeof d.totalClicks === 'number' ? d.totalClicks : 0,
    highestCps: typeof d.highestCps === 'number' ? d.highestCps : 0,
    rebirthCount: rebirths,
    ascensionMultiplier:
      typeof d.ascensionMultiplier === 'number'
        ? d.ascensionMultiplier
        : getAscensionMultiplier(shards),
    equippedSkin: d.equippedSkin || 'classic_matthew',
    unlockedSkins:
      Array.isArray(d.unlockedSkins) && d.unlockedSkins.length > 0
        ? d.unlockedSkins
        : [d.equippedSkin || 'classic_matthew'],
    updatedAtMs: typeof d.updatedAtMs === 'number' ? d.updatedAtMs : 0,
    totalPlaytimeSeconds:
      typeof d.totalPlaytimeSeconds === 'number' ? d.totalPlaytimeSeconds : undefined,
    coins: typeof d.coins === 'number' ? d.coins : undefined,
    prestigeShards: typeof d.prestigeShards === 'number' ? d.prestigeShards : undefined,
    lifetimePrestigeShards:
      typeof d.lifetimePrestigeShards === 'number' ? d.lifetimePrestigeShards : undefined,
    gems: typeof d.gems === 'number' ? d.gems : undefined,
    lifetimeGems: typeof d.lifetimeGems === 'number' ? d.lifetimeGems : undefined,
    upgrades: d.upgrades && typeof d.upgrades === 'object' ? d.upgrades : undefined,
    claimedQuests: Array.isArray(d.claimedQuests) ? d.claimedQuests : undefined,
    unlockedAchievements: Array.isArray(d.unlockedAchievements)
      ? d.unlockedAchievements
      : undefined,
    winnerBadges: Array.isArray(d.winnerBadges) ? d.winnerBadges : undefined,
    clanName: typeof d.clanName === 'string' ? d.clanName : null,
    chestsOpened: typeof d.chestsOpened === 'number' ? d.chestsOpened : 0,
    zombiesDefeated: typeof d.zombiesDefeated === 'number' ? d.zombiesDefeated : 0,
    isReset: Boolean(d.isReset),
  };
}

export function buildLeaderboardPayload(
  uid: string,
  username: string,
  state: GameState,
  nowMs: number = Date.now()
) {
  const validatedScore = Math.max(
    0,
    Math.floor(Math.max(state.seasonalScore || 0, state.lifetimeCoins || 0))
  );
  const rebirths = state.prestigeCount || 0;
  const skin = state.equippedSkin || 'classic_matthew';
  const unlockedSkins =
    Array.isArray(state.unlockedSkins) && state.unlockedSkins.length > 0
      ? state.unlockedSkins
      : ['classic_matthew'];
  const playtimeSeconds = Math.floor(state.totalPlaytimeSeconds || 0);

  return {
    uid,
    username,
    seasonalScore: validatedScore,
    lifetimeCoins: Math.floor(state.lifetimeCoins || 0),
    coins: Math.floor(state.coins || 0),
    totalClicks: Math.floor(state.clicks || 0),
    highestCps: Number((state.highestCps || 0).toFixed(1)),
    rebirthCount: rebirths,
    prestigeShards: state.prestigeShards || 0,
    lifetimePrestigeShards: state.lifetimePrestigeShards || 0,
    gems: state.gems || 0,
    lifetimeGems: state.lifetimeGems || 0,
    ascensionMultiplier: getAscensionMultiplier(state.prestigeShards),
    equippedSkin: skin,
    unlockedSkins,
    upgrades: state.upgrades || {},
    claimedQuests: state.claimedQuests || [],
    unlockedAchievements: state.unlockedAchievements || [],
    totalPlaytimeSeconds: playtimeSeconds,
    winnerBadges: state.winnerBadges || [],
    clanName: state.clanName || null,
    chestsOpened: Math.floor(state.chestsOpened || 0),
    zombiesDefeated: Math.floor(state.zombiesDefeated || 0),
    updatedAtMs: nowMs,
    isReset: false,
  };
}

/**
 * Synchronous keepalive leaderboard write used on tab/app close.
 */
export function updateLeaderboardEntryKeepalive(
  uid: string,
  username: string,
  state: GameState,
  seasonId: string = getActiveSeason().seasonId,
  isSandbox: boolean = false
): void {
  if (
    !uid ||
    !username ||
    getCachedBanRecord(uid, username) ||
    isExcludedFromLeaderboard(uid, username, seasonId)
  ) {
    return;
  }
  const payload = buildLeaderboardPayload(uid, username, state, Date.now());
  rtdbRestWriteKeepalive(scopeRtdbPath(`leaderboards/${seasonId}/${uid}`, isSandbox), payload, 'PUT');
}

/**
 * Publishes the player's validated seasonal score, stats, unlocked skins, and progress snapshot
 * directly to Firebase Realtime Database (`leaderboards/{seasonId}/{uid}`) via stateless REST!
 */
export async function updateLeaderboardEntry(
  uid: string,
  username: string,
  state: GameState,
  seasonId: string = getActiveSeason().seasonId,
  force = false,
  isSandbox: boolean = false
): Promise<boolean> {
  if (!uid || !username) return false;

  // Never allow banned or temp-banned accounts onto the leaderboard
  const ban = getCachedBanRecord(uid, username);
  if (ban) {
    rtdbRestDelete(scopeRtdbPath(`leaderboards/${seasonId}/${uid}`, isSandbox)).catch(() => {});
    return false;
  }

  // Players hidden from the leaderboard keep all cloud saves & gameplay, just skip publishing
  if (isExcludedFromLeaderboard(uid, username, seasonId)) {
    evictLeaderboardCacheForUid(uid);
    rtdbRestDelete(scopeRtdbPath(`leaderboards/${seasonId}/${uid}`, isSandbox)).catch(() => {});
    return true;
  }

  const nowMs = Date.now();
  const payload = buildLeaderboardPayload(uid, username, state, nowMs);
  const playtimeBucket = Math.floor(payload.totalPlaytimeSeconds / 30);
  const cacheKey = `${isSandbox ? 'sbx_' : ''}${seasonId}_${uid}`;

  const prev = lastPublishedSnapshotByUid.get(cacheKey);
  if (
    !force &&
    prev &&
    prev.score === payload.seasonalScore &&
    prev.rebirths === payload.rebirthCount &&
    prev.skin === payload.equippedSkin &&
    prev.skinsCount === payload.unlockedSkins.length &&
    prev.playtimeBucket === playtimeBucket &&
    prev.username === username
  ) {
    return true;
  }

  const ok = await rtdbRestWrite(
    scopeRtdbPath(`leaderboards/${seasonId}/${uid}`, isSandbox),
    payload,
    'PUT'
  );

  if (ok) {
    lastPublishedSnapshotByUid.set(cacheKey, {
      score: payload.seasonalScore,
      rebirths: payload.rebirthCount,
      skin: payload.equippedSkin,
      skinsCount: payload.unlockedSkins.length,
      playtimeBucket,
      username,
      publishedAtMs: nowMs,
    });
  }

  return ok;
}

/**
 * Fetches the top worldwide leaderboard entries for a given season:
 * 1. Refreshes cloud bans (`bans` & `bans_by_username`) and reads `leaderboards/{seasonId}` from RTDB.
 * 2. Ignores legacy Firestore data for any UID that exists in RTDB or has been reset/banned.
 * 3. Filters out all banned and temp-banned accounts automatically.
 */
export async function fetchWorldwideLeaderboard(
  seasonId: string = getActiveSeason().seasonId,
  maxEntries = 500,
  isSandbox: boolean = false
): Promise<LeaderboardEntry[]> {
  try {
    const [rtdbObj] = await Promise.all([
      rtdbRestGet<Record<string, Record<string, any>>>(
        scopeRtdbPath(`leaderboards/${seasonId}`, isSandbox),
        3500
      ),
      refreshCloudBans(),
    ]);

    const mergedByUid = new Map<string, LeaderboardEntry>();

    // Overlay live Realtime Database entries
    if (rtdbObj && typeof rtdbObj === 'object') {
      for (const [uid, raw] of Object.entries(rtdbObj)) {
        if (!raw || typeof raw !== 'object') continue;
        const rtdbEntry = parseRawEntry(uid, raw);

        // If this player is banned or temp-banned, purge from RTDB and skip
        if (getCachedBanRecord(rtdbEntry.uid, rtdbEntry.username)) {
          rtdbRestDelete(`leaderboards/${seasonId}/${uid}`).catch(() => {});
          mergedByUid.delete(rtdbEntry.uid);
          continue;
        }

        // Skip unbanned leaderboard-hidden players (and clean up pre-launch dev entries)
        if (isExcludedFromLeaderboard(rtdbEntry.uid, rtdbEntry.username, seasonId)) {
          rtdbRestDelete(scopeRtdbPath(`leaderboards/${seasonId}/${uid}`, isSandbox)).catch(() => {});
          mergedByUid.delete(rtdbEntry.uid);
          continue;
        }

        // If this account was explicitly reset and hasn't earned a new score after resetAtMs, keep them off the board
        const resetRec = getCachedResetRecord(rtdbEntry.uid);
        if (
          (rtdbEntry.isReset && rtdbEntry.seasonalScore <= 0) ||
          (resetRec && rtdbEntry.updatedAtMs <= resetRec.resetAtMs)
        ) {
          mergedByUid.delete(rtdbEntry.uid);
          continue;
        }

        mergedByUid.set(rtdbEntry.uid, rtdbEntry);
      }
    }

    // 3. Final filter against banned or leaderboard-excluded usernames/UIDs
    const cleanEntries = Array.from(mergedByUid.values()).filter(
      (entry) =>
        !getCachedBanRecord(entry.uid, entry.username) &&
        !isExcludedFromLeaderboard(entry.uid, entry.username, seasonId)
    );

    return sortLeaderboardDeterministically(cleanEntries).slice(0, maxEntries);
  } catch (err) {
    console.warn('Could not fetch worldwide leaderboard:', err);
    return [];
  }
}

export function sortLeaderboardDeterministically(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.seasonalScore !== a.seasonalScore) {
      return b.seasonalScore - a.seasonalScore;
    }
    if (b.rebirthCount !== a.rebirthCount) {
      return b.rebirthCount - a.rebirthCount;
    }
    if (a.updatedAtMs !== b.updatedAtMs) {
      return a.updatedAtMs - b.updatedAtMs;
    }
    return a.uid.localeCompare(b.uid);
  });
}

export async function fetchPlayerLeaderboardEntry(
  uid: string,
  seasonId: string = getActiveSeason().seasonId
): Promise<LeaderboardEntry | null> {
  if (!uid || isExcludedFromLeaderboard(uid, null, seasonId)) return null;

  try {
    const rtdbRaw = await rtdbRestGet<Record<string, any>>(
      `leaderboards/${seasonId}/${uid}`,
      3000
    );
    if (rtdbRaw && typeof rtdbRaw === 'object') {
      const parsed = parseRawEntry(uid, rtdbRaw);
      if (
        getCachedBanRecord(parsed.uid, parsed.username) ||
        isExcludedFromLeaderboard(parsed.uid, parsed.username, seasonId)
      ) {
        return null;
      }
      if (parsed.isReset && parsed.seasonalScore <= 0) return null;
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

export interface SeasonPlacementRewards {
  isChampion: boolean;
  isTop10: boolean;
  rank: number | null;
}

export const SEASON_1_CHAMPION_USERNAME = 'liamkd3';

/**
 * Evaluates a player's official Season 1 final placement:
 * - World Champion (`champion_matthew` + Season 1 Winner badge) is strictly reserved for `liamkd3`.
 * - Top 10 (#1-#10) earn `liam_matthew`.
 */
export async function checkSeason1PlacementRewards(
  uid?: string | null,
  username?: string | null
): Promise<SeasonPlacementRewards> {
  if (!uid) return { isChampion: false, isTop10: false, rank: null };
  const passedUsername = (username || '').trim().toLowerCase();
  try {
    const standings = await fetchWorldwideLeaderboard('season_1', 25, false);
    const idx = standings.findIndex((entry) => entry.uid === uid);
    const matchedEntry = idx >= 0 ? standings[idx] : null;
    const resolvedUsername = (passedUsername || matchedEntry?.username || '').trim().toLowerCase();
    const isChampion = resolvedUsername === SEASON_1_CHAMPION_USERNAME;
    const rank = idx >= 0 ? idx + 1 : null;
    const isTop10 = isChampion || (rank !== null && rank <= 10);
    return {
      isChampion,
      isTop10,
      rank,
    };
  } catch {
    const isChampion = passedUsername === SEASON_1_CHAMPION_USERNAME;
    return { isChampion, isTop10: isChampion, rank: null };
  }
}
