import { getFirebaseServices, rtdbRestGet, rtdbRestWrite, rtdbRestDelete, scopeRtdbPath } from './config';
import { getActiveSeason } from '../utils/scheduleEngine';

export const OFFICIAL_BAN_MESSAGE =
  'You have been banned because of suspicious behavior including cheating, using auto clickers, or hacking.';

export const DEV_ADMIN_USERNAME = 'marshallb78';
export const DEV_ADMIN_UID = '89nsfff2YtaEVcNTHUBDq22V4FW2';
export const DEV_TESTER_UID = 'cKFezHsISfbZGH4tKjQyME0wvrt1';
export const AUTHORIZED_DEV_UIDS = new Set<string>([DEV_ADMIN_UID, DEV_TESTER_UID]);

const LOCAL_BAN_STORAGE_PREFIX = 'matthew_clicker_ban_v2_';

export type BanStatus = 'banned' | 'temp_banned' | 'pardoned';

export interface BanRecord {
  uid: string;
  username: string;
  normalizedUsername: string;
  status: BanStatus;
  reason: string;
  detectedCps?: number;
  bannedBy: string;
  bannedAtMs: number;
}

export interface ResetRecord {
  uid: string;
  username: string;
  resetAtMs: number;
}

export interface ServerBroadcast {
  id: string;
  message: string;
  theme: 'gold' | 'red' | 'cyan' | 'purple';
  active: boolean;
  createdAtMs: number;
  author: string;
}

export interface ProbationReport {
  uid: string;
  username: string;
  normalizedUsername: string;
  reason: string;
  detectedCps: number;
  reportedAtMs: number;
  status: 'probation' | 'cleared' | 'banned';
}

export interface ProbationResolution {
  status: 'cleared' | 'banned';
  resolvedAtMs: number;
}

interface AdminModerationDoc {
  uid: string;
  username: string;
  updatedAtMs: number;
  bansByUid?: Record<string, BanRecord>;
  bansByUsername?: Record<string, BanRecord>;
  resetsByUid?: Record<string, ResetRecord>;
  broadcast?: ServerBroadcast | null;
  probationResolutionsByUid?: Record<string, ProbationResolution>;
}

/**
 * Checks whether a UID belongs strictly to one of the 2 authorized developer accounts.
 * NEVER grants privileges by username so Inspect Element / localStorage spoofing cannot bypass it.
 */
export function isDevAdminAccount(uid?: string | null, _username?: string | null): boolean {
  if (!uid || typeof uid !== 'string') return false;
  return AUTHORIZED_DEV_UIDS.has(uid.trim());
}

/**
 * Verifies in browser runtime that Firebase Auth's cryptographically signed currentUser.uid
 * matches the claimed developer UID (blocks localStorage / React state spoofing via DevTools).
 */
export function isVerifiedLiveDevSession(uid?: string | null): boolean {
  if (!isDevAdminAccount(uid)) return false;
  if (typeof window === 'undefined') return true;
  const { auth } = getFirebaseServices();
  if (!auth?.currentUser) return false;
  return auth.currentUser.uid === uid!.trim();
}

// Dynamic bans are managed in Firebase RTDB (`usernames/__admin_*` and `users/{uid}`).
// Season 1 banned accounts were permanently purged; no hardcoded default bans remain.
export const DEFAULT_BANNED_ACCOUNTS: Record<string, BanRecord> = {};

export const DEFAULT_BANNED_USERNAMES = new Set<string>();

let cachedBansByUid: Record<string, BanRecord> = {};
let cachedBansByUsername: Record<string, BanRecord> = {};
let cachedResetsByUid: Record<string, ResetRecord> = {};
let cachedBroadcast: ServerBroadcast | null = null;
let cachedProbationResolutionsByUid: Record<string, ProbationResolution> = {};
let lastBanFetchMs = 0;

function saveLocalBanRecord(record: BanRecord): void {
  if (typeof window === 'undefined') return;
  try {
    if (record.uid) {
      localStorage.setItem(`${LOCAL_BAN_STORAGE_PREFIX}uid_${record.uid}`, JSON.stringify(record));
    }
    if (record.normalizedUsername) {
      localStorage.setItem(
        `${LOCAL_BAN_STORAGE_PREFIX}user_${record.normalizedUsername.toLowerCase()}`,
        JSON.stringify(record)
      );
    }
  } catch {
    // ignore storage errors
  }
}

function clearLocalBanRecord(uid?: string | null, username?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (uid) {
      localStorage.removeItem(`${LOCAL_BAN_STORAGE_PREFIX}uid_${uid}`);
    }
    const norm = (username || '').trim().toLowerCase();
    if (norm) {
      localStorage.removeItem(`${LOCAL_BAN_STORAGE_PREFIX}user_${norm}`);
    }
  } catch {
    // ignore
  }
}

function loadLocalBanRecord(uid?: string | null, username?: string | null): BanRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    if (uid) {
      const raw = localStorage.getItem(`${LOCAL_BAN_STORAGE_PREFIX}uid_${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw) as BanRecord;
        if (parsed && parsed.status && parsed.status !== 'pardoned') return parsed;
      }
    }
    const norm = (username || '').trim().toLowerCase();
    if (norm) {
      const raw = localStorage.getItem(`${LOCAL_BAN_STORAGE_PREFIX}user_${norm}`);
      if (raw) {
        const parsed = JSON.parse(raw) as BanRecord;
        if (parsed && parsed.status && parsed.status !== 'pardoned') return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function mergeBanRecordIntoMaps(
  byUid: Record<string, BanRecord>,
  byUser: Record<string, BanRecord>,
  rec: BanRecord
): void {
  if (!rec || typeof rec !== 'object' || !rec.status) return;
  const uidKey = rec.uid || '';
  const norm = (rec.normalizedUsername || rec.username || '').trim().toLowerCase();
  const recTime = typeof rec.bannedAtMs === 'number' ? rec.bannedAtMs : 0;

  if (uidKey) {
    const existing = byUid[uidKey];
    const existingTime = existing?.bannedAtMs || 0;
    if (!existing || recTime >= existingTime) {
      byUid[uidKey] = rec;
    }
  }

  if (norm) {
    const existing = byUser[norm];
    const existingTime = existing?.bannedAtMs || 0;
    if (!existing || recTime >= existingTime) {
      byUser[norm] = rec;
    }
  }
}

export async function refreshCloudBans(force = false): Promise<{
  byUid: Record<string, BanRecord>;
  byUsername: Record<string, BanRecord>;
  resetsByUid: Record<string, ResetRecord>;
  broadcast: ServerBroadcast | null;
}> {
  const now = Date.now();
  if (!force && now - lastBanFetchMs < 15000) {
    return {
      byUid: cachedBansByUid,
      byUsername: cachedBansByUsername,
      resetsByUid: cachedResetsByUid,
      broadcast: cachedBroadcast,
    };
  }

  try {
    // Read ONLY Marshallb78's compact admin document instead of downloading the entire `usernames` map
    // (~98% RTDB download bandwidth reduction).
    const adminDoc = await rtdbRestGet<AdminModerationDoc>(
      `usernames/__admin_${DEV_ADMIN_UID}`,
      3000
    );

    const nextByUid: Record<string, BanRecord> = {};
    const nextByUser: Record<string, BanRecord> = {};
    const nextResets: Record<string, ResetRecord> = { ...cachedResetsByUid };
    let nextBroadcast: ServerBroadcast | null = cachedBroadcast;
    let nextProbationResolutions: Record<string, ProbationResolution> = {
      ...cachedProbationResolutionsByUid,
    };

    // Preserve any in-memory records just written locally so polling never drops a fresh ban/unban
    for (const rec of Object.values(cachedBansByUid)) {
      mergeBanRecordIntoMaps(nextByUid, nextByUser, rec);
    }
    for (const rec of Object.values(cachedBansByUsername)) {
      mergeBanRecordIntoMaps(nextByUid, nextByUser, rec);
    }

    if (adminDoc && typeof adminDoc === 'object') {
      if (adminDoc.bansByUid && typeof adminDoc.bansByUid === 'object') {
        for (const rec of Object.values(adminDoc.bansByUid)) {
          mergeBanRecordIntoMaps(nextByUid, nextByUser, rec);
        }
      }
      if (adminDoc.bansByUsername && typeof adminDoc.bansByUsername === 'object') {
        for (const rec of Object.values(adminDoc.bansByUsername)) {
          mergeBanRecordIntoMaps(nextByUid, nextByUser, rec);
        }
      }
      if (adminDoc.resetsByUid && typeof adminDoc.resetsByUid === 'object') {
        for (const [rUid, rRec] of Object.entries(adminDoc.resetsByUid)) {
          if (rRec && typeof rRec.resetAtMs === 'number') {
            const prev = nextResets[rUid];
            if (!prev || rRec.resetAtMs >= prev.resetAtMs) {
              nextResets[rUid] = rRec;
            }
          }
        }
      }
      if (adminDoc.probationResolutionsByUid && typeof adminDoc.probationResolutionsByUid === 'object') {
        for (const [pUid, pRes] of Object.entries(adminDoc.probationResolutionsByUid)) {
          if (pRes && typeof pRes.resolvedAtMs === 'number') {
            const prev = nextProbationResolutions[pUid];
            if (!prev || pRes.resolvedAtMs >= prev.resolvedAtMs) {
              nextProbationResolutions[pUid] = pRes;
            }
          }
        }
      }
      if ('broadcast' in adminDoc) {
        nextBroadcast = adminDoc.broadcast && adminDoc.broadcast.active ? adminDoc.broadcast : null;
      }
    }

    cachedBansByUid = nextByUid;
    cachedBansByUsername = nextByUser;
    cachedResetsByUid = nextResets;
    cachedBroadcast = nextBroadcast;
    cachedProbationResolutionsByUid = nextProbationResolutions;
    lastBanFetchMs = now;
  } catch {
    // keep cached
  }

  return {
    byUid: cachedBansByUid,
    byUsername: cachedBansByUsername,
    resetsByUid: cachedResetsByUid,
    broadcast: cachedBroadcast,
  };
}

export function getCachedResetRecord(uid?: string | null): ResetRecord | null {
  if (!uid) return null;
  return cachedResetsByUid[uid] || null;
}

export function getCachedServerBroadcast(): ServerBroadcast | null {
  return cachedBroadcast;
}

export function getCachedBanRecord(
  uid?: string | null,
  username?: string | null
): BanRecord | null {
  if (isDevAdminAccount(uid, username)) return null;

  const norm = (username || '').trim().toLowerCase();

  // Check both byUid and byUsername and pick whichever has the newest timestamp
  const uidRec = uid ? cachedBansByUid[uid] : undefined;
  const userRec = norm ? cachedBansByUsername[norm] : undefined;

  let chosen: BanRecord | undefined = uidRec;
  if (userRec) {
    if (!chosen || (userRec.bannedAtMs || 0) >= (chosen.bannedAtMs || 0)) {
      chosen = userRec;
    }
  }

  if (chosen) {
    if (chosen.status === 'pardoned') return null;
    return chosen;
  }

  // Also check localStorage fallback so a banned player on this device never escapes before sync
  const localRec = loadLocalBanRecord(uid, username);
  if (localRec) {
    return localRec;
  }

  return null;
}

/**
 * Checks whether the current account is banned or temp-banned:
 * 1. Refreshes global cloud bans (`usernames/__admin_*`).
 * 2. Also checks the player's own `users/{uid}` document (`banStatus`) so a banned account
 *    stays enforced across sessions.
 * 3. If Marshallb78 pardoned the player (`status === 'pardoned'` with newer timestamp),
 *    clears the player's local ban and `users/{uid}` banStatus automatically!
 */
export async function checkAccountBanStatus(
  uid?: string | null,
  username?: string | null,
  forceRefresh = false
): Promise<BanRecord | null> {
  if (isDevAdminAccount(uid, username)) return null;

  const norm = (username || '').trim().toLowerCase();

  const [, userDoc] = await Promise.all([
    refreshCloudBans(forceRefresh),
    uid && !uid.startsWith('local_') && !uid.startsWith('user_')
      ? rtdbRestGet<Record<string, any>>(`users/${uid}`, 2500).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Check if Marshallb78 explicitly pardoned this account
  const adminUidRec = uid ? cachedBansByUid[uid] : undefined;
  const adminUserRec = norm ? cachedBansByUsername[norm] : undefined;
  const newestAdminRec =
    adminUidRec && adminUserRec
      ? (adminUserRec.bannedAtMs || 0) >= (adminUidRec.bannedAtMs || 0)
        ? adminUserRec
        : adminUidRec
      : adminUidRec || adminUserRec;

  // Also inspect the player's own `users/{uid}` document for `banStatus`
  if (
    userDoc &&
    (userDoc.banStatus === 'banned' || userDoc.banStatus === 'temp_banned')
  ) {
    const userDocBanTime =
      typeof userDoc.resetAtMs === 'number'
        ? userDoc.resetAtMs
        : typeof userDoc.updatedAtMs === 'number'
        ? userDoc.updatedAtMs
        : 1762905600000;

    // If Marshallb78 pardoned them AFTER their ban timestamp, clear the ban on their user doc & local storage!
    if (
      newestAdminRec &&
      newestAdminRec.status === 'pardoned' &&
      (newestAdminRec.bannedAtMs || 0) >= userDocBanTime
    ) {
      clearLocalBanRecord(uid, username);
      if (uid) {
        rtdbRestWrite(
          `users/${uid}`,
          { banStatus: 'pardoned', banReason: null, updatedAtMs: Date.now() },
          'PATCH'
        ).catch(() => {});
      }
      return null;
    }

    // Otherwise, this user's own `users/{uid}` doc says they are banned/temp_banned!
    const userBanRec: BanRecord = {
      uid: uid!,
      username: username || userDoc.username || 'Unknown Player',
      normalizedUsername: norm || (userDoc.username || 'unknown').toLowerCase(),
      status: userDoc.banStatus as BanStatus,
      reason: userDoc.banReason || OFFICIAL_BAN_MESSAGE,
      detectedCps: typeof userDoc.detectedCps === 'number' ? userDoc.detectedCps : undefined,
      bannedBy: 'Marshallb78',
      bannedAtMs: userDocBanTime,
    };
    mergeBanRecordIntoMaps(cachedBansByUid, cachedBansByUsername, userBanRec);
    saveLocalBanRecord(userBanRec);
  } else if (newestAdminRec && newestAdminRec.status === 'pardoned') {
    clearLocalBanRecord(uid, username);
    return null;
  }

  const finalBan = getCachedBanRecord(uid, username);

  // If banned, ensure the player's own client keeps its leaderboard entry deleted & user doc zeroed
  if (finalBan && uid && !uid.startsWith('local_') && !uid.startsWith('user_')) {
    saveLocalBanRecord(finalBan);
    wipePlayerProgressAndLeaderboard(
      uid,
      username || finalBan.username,
      finalBan.status,
      finalBan.reason,
      finalBan.bannedAtMs
    ).catch(() => {});
  }

  return finalBan;
}

/**
 * Removes a banned player from `leaderboards/{seasonId}/{uid}` and marks `banStatus` on `users/{uid}`
 * while PRESERVING their saved coins, upgrades, skins, and Season 2 pets/inventory so unbanning restores them cleanly.
 */
export async function wipePlayerProgressAndLeaderboard(
  targetUid: string,
  targetUsername: string,
  banStatus: BanStatus,
  reason: string,
  banTimestampMs: number = Date.now(),
  seasonId: string = getActiveSeason().seasonId
): Promise<void> {
  await Promise.all([
    rtdbRestDelete(`leaderboards/${seasonId}/${targetUid}`).catch(() => false),
    rtdbRestWrite(
      `users/${targetUid}`,
      {
        uid: targetUid,
        username: targetUsername,
        banStatus,
        banReason: reason,
        bannedAtMs: banTimestampMs,
        updatedAtMs: banTimestampMs,
      },
      'PATCH'
    ).catch(() => false),
  ]);
}

export const hideBannedPlayerFromLeaderboard = wipePlayerProgressAndLeaderboard;

/**
 * Helper for Marshallb78 to write updates to his own admin moderation document
 * (`usernames/__admin_${adminUid}` where top-level `uid === auth.uid`, guaranteed allowed by RTDB rules!).
 */
async function updateAdminModerationDoc(
  mutator: (doc: AdminModerationDoc) => AdminModerationDoc
): Promise<boolean> {
  const { auth } = getFirebaseServices();
  const adminUid = auth?.currentUser?.uid || DEV_ADMIN_UID;
  const path = `usernames/__admin_${adminUid}`;

  const existing = await rtdbRestGet<AdminModerationDoc>(path, 3000);
  const baseDoc: AdminModerationDoc = {
    uid: adminUid,
    username: 'Marshallb78',
    updatedAtMs: Date.now(),
    bansByUid: {
      ...DEFAULT_BANNED_ACCOUNTS,
      ...(existing?.bansByUid || {}),
    },
    bansByUsername: {
      liamkd: DEFAULT_BANNED_ACCOUNTS['jIIqvA8aVzMUbFqh4I8Drq4M5FT2'],
      wessy: DEFAULT_BANNED_ACCOUNTS['ZzqxlRHiRUNDNG3nkgvxfCLkD153'],
      dryce: DEFAULT_BANNED_ACCOUNTS['JFw0K4bgUHg3GpzcnWV44sUpFnj1'],
      ...(existing?.bansByUsername || {}),
    },
    resetsByUid: {
      ...(existing?.resetsByUid || {}),
    },
    broadcast: existing?.broadcast || cachedBroadcast || null,
    probationResolutionsByUid: {
      ...cachedProbationResolutionsByUid,
      ...(existing?.probationResolutionsByUid || {}),
    },
  };

  const nextDoc = mutator(baseDoc);
  nextDoc.uid = adminUid; // Must match auth.uid for RTDB security rule `data.child('uid').val() === auth.uid`
  nextDoc.updatedAtMs = Date.now();

  const ok = await rtdbRestWrite(path, nextDoc, 'PUT');
  await refreshCloudBans(true);
  return ok;
}

/**
 * Called by Marshallb78 from the Dev Tools panel to officially & permanently ban (or temp-ban) a player.
 */
export async function adminBanPlayer(
  targetUid: string,
  targetUsername: string,
  reason: string = OFFICIAL_BAN_MESSAGE,
  status: 'banned' | 'temp_banned' = 'banned'
): Promise<boolean> {
  if (isDevAdminAccount(targetUid, targetUsername)) return false;

  const cleanUser = targetUsername.trim() || targetUid;
  const norm = cleanUser.toLowerCase();
  const uidKey = targetUid || `user_${norm}`;
  const now = Date.now();

  const record: BanRecord = {
    uid: uidKey,
    username: cleanUser,
    normalizedUsername: norm,
    status,
    reason,
    bannedBy: 'Marshallb78',
    bannedAtMs: now,
  };

  cachedBansByUid[uidKey] = record;
  cachedBansByUsername[norm] = record;

  return updateAdminModerationDoc((doc) => {
    doc.bansByUid = { ...(doc.bansByUid || {}), [uidKey]: record };
    doc.bansByUsername = { ...(doc.bansByUsername || {}), [norm]: record };
    return doc;
  });
}

/**
 * Called by Marshallb78 from the Dev Tools panel to unban / pardon a player.
 */
export async function adminUnbanPlayer(
  targetUid: string,
  targetUsername: string
): Promise<boolean> {
  const cleanUser = targetUsername.trim() || targetUid;
  const norm = cleanUser.toLowerCase();
  const uidKey = targetUid || `user_${norm}`;
  const now = Date.now();

  const record: BanRecord = {
    uid: uidKey,
    username: cleanUser,
    normalizedUsername: norm,
    status: 'pardoned',
    reason: 'Pardoned by Marshallb78',
    bannedBy: 'Marshallb78',
    bannedAtMs: now,
  };

  // Update in-memory caches immediately for both UID and username
  cachedBansByUid[uidKey] = record;
  cachedBansByUsername[norm] = record;
  // Also pardon any other UIDs that share the same normalizedUsername (e.g. wessy had 2 UIDs)
  for (const [k, v] of Object.entries(cachedBansByUid)) {
    if (v && (v.normalizedUsername || v.username || '').toLowerCase() === norm) {
      cachedBansByUid[k] = { ...record, uid: k };
    }
  }
  clearLocalBanRecord(uidKey, cleanUser);

  return updateAdminModerationDoc((doc) => {
    const nextByUid = { ...(doc.bansByUid || {}), [uidKey]: record };
    for (const [k, v] of Object.entries(nextByUid)) {
      if (v && (v.normalizedUsername || v.username || '').toLowerCase() === norm) {
        nextByUid[k] = { ...record, uid: k };
      }
    }
    doc.bansByUid = nextByUid;
    doc.bansByUsername = { ...(doc.bansByUsername || {}), [norm]: record };
    return doc;
  });
}

/**
 * Called by Marshallb78 from Dev Tools (or by a player resetting their own progress)
 * to reset a player's score/coins/rebirths to 0 without banning them.
 */
export async function adminResetPlayerScore(
  targetUid: string,
  targetUsername: string,
  seasonId: string = getActiveSeason().seasonId
): Promise<boolean> {
  if (!targetUid) return false;
  const now = Date.now();
  const resetRec: ResetRecord = {
    uid: targetUid,
    username: targetUsername || 'Reset Player',
    resetAtMs: now,
  };
  cachedResetsByUid[targetUid] = resetRec;

  const { auth } = getFirebaseServices();
  const currentUid = auth?.currentUser?.uid;

  // If the user is resetting their own account, they own `leaderboards/.../${targetUid}` and `users/${targetUid}`
  if (currentUid === targetUid) {
    await Promise.all([
      rtdbRestWrite(
        `leaderboards/${seasonId}/${targetUid}`,
        {
          uid: targetUid,
          username: targetUsername || 'Reset Player',
          seasonalScore: 0,
          lifetimeCoins: 0,
          coins: 0,
          totalClicks: 0,
          rebirthCount: 0,
          ascensionMultiplier: 1,
          equippedSkin: 'classic_matthew',
          unlockedSkins: ['classic_matthew'],
          updatedAtMs: now,
          isReset: true,
        },
        'PUT'
      ).catch(() => false),
      rtdbRestWrite(
        `users/${targetUid}`,
        {
          resetAtMs: now,
          updatedAtMs: now,
          seasons: {
            [seasonId]: {
              seasonId,
              coins: 0,
              lifetimeCoins: 0,
              seasonalScore: 0,
              clicks: 0,
              criticalClicks: 0,
              upgrades: {},
              prestigeCount: 0,
              prestigeShards: 0,
              lifetimePrestigeShards: 0,
              lastSaveTime: now,
              resetAtMs: now,
            },
          },
        },
        'PATCH'
      ).catch(() => false),
    ]);
  }

  // If Marshallb78 is resetting another player from Dev Tools, store in Marshallb78's admin doc
  if (isDevAdminAccount(currentUid, auth?.currentUser?.displayName)) {
    await updateAdminModerationDoc((doc) => {
      doc.resetsByUid = { ...(doc.resetsByUid || {}), [targetUid]: resetRec };
      return doc;
    });
  }

  return true;
}

/**
 * Called by Marshallb78 from Dev Tools to publish or clear a live global server announcement banner.
 */
export async function adminSetServerBroadcast(
  message: string | null,
  theme: 'gold' | 'red' | 'cyan' | 'purple' = 'gold'
): Promise<boolean> {
  const clean = (message || '').trim();
  const broadcast: ServerBroadcast | null = clean
    ? {
        id: `bc_${Date.now()}`,
        message: clean,
        theme,
        active: true,
        createdAtMs: Date.now(),
        author: 'Marshallb78',
      }
    : null;

  cachedBroadcast = broadcast;
  return updateAdminModerationDoc((doc) => {
    doc.broadcast = broadcast;
    return doc;
  });
}

// ============================================================================
// ANTI-CHEAT PROBATION SYSTEM (Admin Notification -> Manual Ban or Clear)
// ============================================================================

const LOCAL_PROBATION_PREFIX = 'matthew_clicker_probation_v1_';

export function loadLocalProbationState(uid?: string | null): ProbationReport | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_PROBATION_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProbationReport;
    if (parsed && parsed.status === 'probation') return parsed;
  } catch {
    // ignore
  }
  return null;
}

export function clearLocalProbationState(uid?: string | null): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    localStorage.removeItem(`${LOCAL_PROBATION_PREFIX}${uid}`);
  } catch {
    // ignore
  }
}

/**
 * Places an account under probation WITHOUT banning it, and sends a notification to Firebase
 * so Marshallb78 can review and choose whether to ban or clear them.
 */
export async function reportAccountProbation(
  uid: string,
  username: string,
  detectedCps: number,
  reason: string,
  seasonId: string = getActiveSeason().seasonId,
  isSandbox: boolean = false
): Promise<ProbationReport | null> {
  if (!uid || isDevAdminAccount(uid, username)) return null;

  const cleanUser = username.trim() || uid;
  const norm = cleanUser.toLowerCase();
  const now = Date.now();

  const report: ProbationReport = {
    uid,
    username: cleanUser,
    normalizedUsername: norm,
    reason,
    detectedCps: Number(detectedCps.toFixed(1)),
    reportedAtMs: now,
    status: 'probation',
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${LOCAL_PROBATION_PREFIX}${uid}`, JSON.stringify(report));
    } catch {
      // ignore
    }
  }

  if (!uid.startsWith('local_') && !uid.startsWith('user_')) {
    const lbPath = scopeRtdbPath(`leaderboards/${seasonId}/${uid}`, isSandbox);
    await Promise.all([
      rtdbRestWrite(
        `users/${uid}`,
        {
          probationStatus: 'probation',
          probationReason: reason,
          probationCps: report.detectedCps,
          probationAtMs: now,
          updatedAtMs: now,
        },
        'PATCH'
      ).catch(() => false),
      rtdbRestWrite(
        lbPath,
        {
          probation: report,
          updatedAtMs: now,
        },
        'PATCH'
      ).catch(() => false),
      rtdbRestWrite(`admin/probation_alerts/${uid}`, report, 'PUT').catch(() => false),
    ]);
  }

  return report;
}

/**
 * Checks whether a player's probation was cleared or escalated to a ban by Marshallb78.
 */
export async function syncOwnProbationStatus(
  uid?: string | null,
  username?: string | null
): Promise<boolean> {
  if (!uid || isDevAdminAccount(uid, username)) return false;

  const localProb = loadLocalProbationState(uid);
  const res = cachedProbationResolutionsByUid[uid];
  if (localProb && res && res.resolvedAtMs >= localProb.reportedAtMs) {
    if (res.status === 'cleared') {
      clearLocalProbationState(uid);
      if (!uid.startsWith('local_') && !uid.startsWith('user_')) {
        rtdbRestWrite(
          `users/${uid}`,
          { probationStatus: null, probationReason: null, probationCps: null, probationAtMs: null },
          'PATCH'
        ).catch(() => {});
      }
      return false;
    }
  }

  if (localProb) return true;

  if (!uid.startsWith('local_') && !uid.startsWith('user_')) {
    try {
      const userDoc = await rtdbRestGet<Record<string, any>>(`users/${uid}`, 2500);
      if (userDoc && userDoc.probationStatus === 'probation') {
        const atMs = typeof userDoc.probationAtMs === 'number' ? userDoc.probationAtMs : Date.now();
        if (res && res.resolvedAtMs >= atMs && res.status === 'cleared') {
          clearLocalProbationState(uid);
          rtdbRestWrite(
            `users/${uid}`,
            { probationStatus: null, probationReason: null, probationCps: null, probationAtMs: null },
            'PATCH'
          ).catch(() => {});
          return false;
        }
        return true;
      }
    } catch {
      // ignore
    }
  }

  return false;
}

/**
 * Fetches pending anti-cheat probation alerts for Marshallb78's Admin Panel & live screen notifications.
 */
export async function fetchProbationAlerts(
  seasonId: string = getActiveSeason().seasonId,
  isSandbox: boolean = false
): Promise<ProbationReport[]> {
  const alertsByUid = new Map<string, ProbationReport>();

  const [adminAlertsObj, lbObj] = await Promise.all([
    rtdbRestGet<Record<string, ProbationReport>>('admin/probation_alerts', 2500).catch(() => null),
    rtdbRestGet<Record<string, Record<string, any>>>(
      scopeRtdbPath(`leaderboards/${seasonId}`, isSandbox),
      2500
    ).catch(() => null),
    refreshCloudBans(false),
  ]);

  const considerReport = (raw: any, fallbackUid?: string) => {
    if (!raw || typeof raw !== 'object') return;
    const uid = String(raw.uid || fallbackUid || '').trim();
    if (!uid || isDevAdminAccount(uid, raw.username)) return;
    const reportedAtMs = typeof raw.reportedAtMs === 'number' ? raw.reportedAtMs : 0;
    const resolution = cachedProbationResolutionsByUid[uid];
    if (resolution && resolution.resolvedAtMs >= reportedAtMs) return;
    if (getCachedBanRecord(uid, raw.username)) return;
    const prev = alertsByUid.get(uid);
    if (!prev || reportedAtMs >= prev.reportedAtMs) {
      alertsByUid.set(uid, {
        uid,
        username: String(raw.username || uid),
        normalizedUsername: String(raw.normalizedUsername || raw.username || uid).toLowerCase(),
        reason: String(raw.reason || 'Suspicious click rate detected'),
        detectedCps: Number(raw.detectedCps) || 0,
        reportedAtMs: reportedAtMs || Date.now(),
        status: 'probation',
      });
    }
  };

  if (adminAlertsObj && typeof adminAlertsObj === 'object') {
    for (const [uid, rec] of Object.entries(adminAlertsObj)) {
      considerReport(rec, uid);
    }
  }

  if (lbObj && typeof lbObj === 'object') {
    for (const [uid, row] of Object.entries(lbObj)) {
      if (row && typeof row === 'object' && row.probation) {
        considerReport(row.probation, uid);
      }
    }
  }

  return Array.from(alertsByUid.values()).sort((a, b) => b.reportedAtMs - a.reportedAtMs);
}

/**
 * Called by Marshallb78 from Dev Tools to either officially BAN a probation account
 * or CLEAR its probation flag.
 */
export async function adminResolveProbation(
  targetUid: string,
  targetUsername: string,
  action: 'ban' | 'clear',
  seasonId: string = getActiveSeason().seasonId,
  isSandbox: boolean = false
): Promise<boolean> {
  if (!targetUid) return false;
  const now = Date.now();
  const resolution: ProbationResolution = {
    status: action === 'ban' ? 'banned' : 'cleared',
    resolvedAtMs: now,
  };
  cachedProbationResolutionsByUid[targetUid] = resolution;

  if (action === 'ban') {
    await adminBanPlayer(targetUid, targetUsername, OFFICIAL_BAN_MESSAGE, 'banned');
  }

  await Promise.all([
    updateAdminModerationDoc((doc) => {
      doc.probationResolutionsByUid = {
        ...(doc.probationResolutionsByUid || {}),
        [targetUid]: resolution,
      };
      return doc;
    }),
    rtdbRestDelete(`admin/probation_alerts/${targetUid}`).catch(() => false),
    rtdbRestWrite(
      scopeRtdbPath(`leaderboards/${seasonId}/${targetUid}`, isSandbox),
      { probation: null },
      'PATCH'
    ).catch(() => false),
  ]);

  return true;
}

// ============================================================================
// PLAYER SUSPICION REPORTS (Leaderboard Peer Reports -> Dev Notifications Only)
// ============================================================================

export interface PlayerSuspicionReport {
  id: string;
  reporterUid: string;
  reporterUsername: string;
  targetUid: string;
  targetUsername: string;
  targetHighestCps: number;
  targetScore: number;
  reportedAtMs: number;
  reason?: string;
}

/**
 * Sends a peer suspicion report ("<reporter> reported <target>") to devs without banning anyone.
 */
export async function submitPlayerSuspicionReport(params: {
  reporterUid?: string | null;
  reporterUsername: string;
  targetUid: string;
  targetUsername: string;
  targetHighestCps: number;
  targetScore: number;
  reason?: string;
}): Promise<PlayerSuspicionReport | null> {
  if (!params.targetUid || !params.targetUsername) return null;
  // Never create suspicion reports targeting Marshallb78 admin account
  if (isDevAdminAccount(params.targetUid, params.targetUsername)) return null;

  const now = Date.now();
  const safeTarget = params.targetUid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'target';
  const safeReporter =
    (params.reporterUid || params.reporterUsername || 'player')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 16) || 'player';
  const id = `${now}_${safeTarget}_${safeReporter}`;

  const report: PlayerSuspicionReport = {
    id,
    reporterUid: params.reporterUid || 'guest',
    reporterUsername: params.reporterUsername.trim() || 'A Player',
    targetUid: params.targetUid,
    targetUsername: params.targetUsername,
    targetHighestCps: Number((params.targetHighestCps || 0).toFixed(1)),
    targetScore: Math.floor(params.targetScore || 0),
    reportedAtMs: now,
    reason: params.reason?.trim() || 'Suspicious activity reported from leaderboard',
  };

  const ok = await rtdbRestWrite(`admin/player_reports/${id}`, report, 'PUT').catch(() => false);
  return ok ? report : null;
}

export async function fetchPlayerSuspicionReports(): Promise<PlayerSuspicionReport[]> {
  const raw = await rtdbRestGet<Record<string, PlayerSuspicionReport>>(
    'admin/player_reports',
    2500
  ).catch(() => null);
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .filter(([, rec]) => rec && typeof rec === 'object' && rec.targetUid && rec.targetUsername)
    .map(([id, rec]) => ({
      ...rec,
      id: rec.id || id,
      targetHighestCps: Number(rec.targetHighestCps) || 0,
      targetScore: Number(rec.targetScore) || 0,
      reportedAtMs: Number(rec.reportedAtMs) || 0,
    }))
    .sort((a, b) => b.reportedAtMs - a.reportedAtMs);
}

export async function dismissPlayerSuspicionReport(reportId: string): Promise<boolean> {
  if (!reportId) return false;
  return rtdbRestDelete(`admin/player_reports/${reportId}`).catch(() => false);
}

// ============================================================================
// FIREBASE CLEANUP & ORGANIZATION (Remove Season 1 Clutter, Keep Accounts & Skins)
// ============================================================================

export interface FirebaseHealthSummary {
  realUsernamesCount: number;
  legacyClutterKeys: string[];
  season1LeaderboardCount: number;
  season2LeaderboardCount: number;
  usersCount: number;
  sandboxPresent: boolean;
}

export async function inspectFirebaseStructureSummary(): Promise<FirebaseHealthSummary> {
  const [usernamesObj, lbS1Obj, lbS2Obj, usersObj, sandboxObj] = await Promise.all([
    rtdbRestGet<Record<string, any>>('usernames', 3500).catch(() => null),
    rtdbRestGet<Record<string, any>>('leaderboards/season_1', 3500).catch(() => null),
    rtdbRestGet<Record<string, any>>('leaderboards/season_2', 3500).catch(() => null),
    rtdbRestGet<Record<string, any>>('users', 3500).catch(() => null),
    rtdbRestGet<Record<string, any>>('sandbox_s2', 2500).catch(() => null),
  ]);

  const clutterKeys: string[] = [];
  let realUsernamesCount = 0;

  if (usernamesObj && typeof usernamesObj === 'object') {
    for (const key of Object.keys(usernamesObj)) {
      if (
        key.startsWith('__autoban_') ||
        key.startsWith('__moderation_') ||
        key.startsWith('__test_')
      ) {
        clutterKeys.push(key);
      } else if (!key.startsWith('__admin_')) {
        realUsernamesCount += 1;
      }
    }
  }

  return {
    realUsernamesCount,
    legacyClutterKeys: clutterKeys,
    season1LeaderboardCount: lbS1Obj && typeof lbS1Obj === 'object' ? Object.keys(lbS1Obj).length : 0,
    season2LeaderboardCount: lbS2Obj && typeof lbS2Obj === 'object' ? Object.keys(lbS2Obj).length : 0,
    usersCount: usersObj && typeof usersObj === 'object' ? Object.keys(usersObj).length : 0,
    sandboxPresent: Boolean(sandboxObj && typeof sandboxObj === 'object'),
  };
}

/**
 * Removes obsolete Season 1 leaderboard bloat & old `__autoban_*`/`__moderation_*`/`__test_*` clutter
 * from RTDB while 100% preserving real player accounts (`usernames/{name}`), unlocked skins, gems, and Season 2 saves (`users/{uid}`).
 */
export async function cleanupLegacySeason1FirebaseClutter(options?: {
  deleteSeason1Leaderboard?: boolean;
  deleteSandbox?: boolean;
}): Promise<{ deletedKeys: string[]; failedKeys: string[] }> {
  const deleteS1 = options?.deleteSeason1Leaderboard ?? true;
  const deleteSandbox = options?.deleteSandbox ?? true;

  const summary = await inspectFirebaseStructureSummary();
  const deletedKeys: string[] = [];
  const failedKeys: string[] = [];

  for (const key of summary.legacyClutterKeys) {
    const ok = await rtdbRestDelete(`usernames/${key}`).catch(() => false);
    if (ok) deletedKeys.push(`usernames/${key}`);
    else failedKeys.push(`usernames/${key}`);
  }

  if (deleteS1 && summary.season1LeaderboardCount > 0) {
    const ok = await rtdbRestDelete('leaderboards/season_1').catch(() => false);
    if (ok) deletedKeys.push('leaderboards/season_1');
    else failedKeys.push('leaderboards/season_1');
  }

  if (deleteSandbox && summary.sandboxPresent) {
    const ok = await rtdbRestDelete('sandbox_s2').catch(() => false);
    if (ok) deletedKeys.push('sandbox_s2');
    else failedKeys.push('sandbox_s2');
  }

  // Also ensure active live schema index note exists under admin/schema_info (best-effort)
  rtdbRestWrite(
    'admin/schema_overview',
    {
      activeSeason: 'season_2',
      organizedAtMs: Date.now(),
      nodes: {
        users: 'Player saves, skins, gems, pets, crates & probation status',
        usernames: 'Username login locks + __admin_<uid> moderation config',
        leaderboards: 'Active season_2 leaderboard',
        events: 'Global Live Events state',
        admin: 'Probation cheat alerts & overview',
      },
    },
    'PUT'
  ).catch(() => false);

  return { deletedKeys, failedKeys };
}

/**
 * Permanently deletes ALL currently banned & temp-banned accounts (users/{uid}, usernames/{lock},
 * leaderboards/season_1/{uid}, leaderboards/season_2/{uid}, admin/probation_alerts/{uid},
 * and admin moderation ban records) when executed by signed-in Marshallb78 dev admin.
 */
export async function purgeAllBannedAccountsFromRtdb(): Promise<{
  purgedUids: number;
  purgedUsernames: number;
  clearedBanRecords: number;
}> {
  const adminDoc = await rtdbRestGet<AdminModerationDoc>(
    `usernames/__admin_${DEV_ADMIN_UID}`,
    4500
  ).catch(() => null);
  const allUsernames = await rtdbRestGet<Record<string, any>>('usernames', 4500).catch(() => null);

  const bannedUids = new Set<string>();
  const collectBanned = (rec?: BanRecord) => {
    if (!rec || (rec.status !== 'banned' && rec.status !== 'temp_banned')) return;
    if (rec.uid && !isDevAdminAccount(rec.uid, rec.username)) {
      bannedUids.add(rec.uid);
    }
  };

  if (adminDoc?.bansByUid) {
    Object.values(adminDoc.bansByUid).forEach(collectBanned);
  }
  if (adminDoc?.bansByUsername) {
    Object.values(adminDoc.bansByUsername).forEach(collectBanned);
  }
  Object.values(cachedBansByUid).forEach(collectBanned);

  let purgedUsernames = 0;
  if (allUsernames && typeof allUsernames === 'object') {
    for (const [key, val] of Object.entries(allUsernames)) {
      if (key.startsWith('__admin_')) continue;
      if (val && typeof val === 'object' && typeof val.uid === 'string' && bannedUids.has(val.uid)) {
        const ok = await rtdbRestDelete(`usernames/${key}`).catch(() => false);
        if (ok) purgedUsernames++;
      }
    }
  }

  let purgedUids = 0;
  for (const uid of bannedUids) {
    const [uOk] = await Promise.all([
      rtdbRestDelete(`users/${uid}`).catch(() => false),
      rtdbRestDelete(`leaderboards/season_1/${uid}`).catch(() => false),
      rtdbRestDelete(`leaderboards/season_2/${uid}`).catch(() => false),
      rtdbRestDelete(`sandbox_season_2/leaderboards/season_2/${uid}`).catch(() => false),
      rtdbRestDelete(`admin/probation_alerts/${uid}`).catch(() => false),
    ]);
    if (uOk) purgedUids++;
  }

  const clearedBanRecords =
    (adminDoc?.bansByUid ? Object.keys(adminDoc.bansByUid).length : 0) +
    (adminDoc?.bansByUsername ? Object.keys(adminDoc.bansByUsername).length : 0);

  await rtdbRestWrite(
    `usernames/__admin_${DEV_ADMIN_UID}`,
    {
      bansByUid: {},
      bansByUsername: {},
      updatedAtMs: Date.now(),
    },
    'PATCH'
  ).catch(() => false);

  cachedBansByUid = {};
  cachedBansByUsername = {};
  if (typeof window !== 'undefined') {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LOCAL_BAN_STORAGE_PREFIX)) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  return { purgedUids, purgedUsernames, clearedBanRecords };
}
