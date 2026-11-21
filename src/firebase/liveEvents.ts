import {
  RTDB_REST_BASE,
  getAuthIdToken,
  getServerNowMs,
  rtdbRestGet,
  rtdbRestWrite,
  scopeRtdbPath,
} from './config';

export type GlobalEventType =
  | 'golden_rain'
  | 'screen_freeze'
  | 'upside_down_chaos'
  | 'blackout_flashlight';

export interface ActiveGlobalLiveEvent {
  id: string;
  uid?: string;
  type: GlobalEventType;
  kind?: 'boost' | 'attack';
  summonedByUid: string;
  summonedByUsername: string;
  targetUid?: string | null;
  targetUsername?: string | null;
  bannerText: string;
  startedAtMs: number;
  endsAtMs: number;
  durationSeconds: number;
  /** Used for Click Fast Marathon (~10x own money winner payout) & Falling Matthews / Golden Rain */
  countOrTarget?: number;
  excludeSummoner?: boolean;
  /** Winner info populated at completion of competitive events */
  marathonTopUid?: string;
  marathonTopUsername?: string;
  marathonTopClicks?: number;
}

export interface SnapEventRecord {
  uid: string;
  snapId: string;
  snappedByUid: string;
  snappedByUsername: string;
  victimUids: string[];
  isSandbox: boolean;
  timestampMs: number;
  expiresAtMs: number;
}

export interface PlayerEventCostSpec {
  type: GlobalEventType;
  kind: 'boost' | 'attack';
  label: string;
  description: string;
  image: string;
  gemCost: number;
  durationSeconds: number;
  excludeSummoner: boolean;
  supportsTarget?: boolean;
  hasCutscene?: boolean;
}

export const PLAYER_TRIGGERABLE_EVENTS: (PlayerEventCostSpec & { id: string })[] = [
  {
    id: 'evt_golden_rain',
    type: 'golden_rain',
    kind: 'boost',
    label: 'Stark Gold Rain',
    description: '100x Golden Matthews rain across every screen!',
    image: './images/s3/events/event_golden_rain.png',
    gemCost: 45,
    durationSeconds: 35,
    excludeSummoner: false,
  },
  {
    id: 'evt_screen_freeze_30',
    type: 'screen_freeze',
    kind: 'attack',
    label: 'Dr. Strange Dark Ice',
    description: 'Seals rival screens in Mirror-Dimension Dark Ice for 30s!',
    image: './images/s3/events/attack_time_freeze.png',
    gemCost: 35,
    durationSeconds: 30,
    excludeSummoner: true,
    hasCutscene: true,
  },
  {
    id: 'evt_upside_down_chaos',
    type: 'upside_down_chaos',
    kind: 'attack',
    label: 'Mirror Flip 180°',
    description: 'Flips rival screens upside-down for 30s!',
    image: './images/s3/events/attack_mirror_flip.png',
    gemCost: 40,
    durationSeconds: 30,
    excludeSummoner: true,
  },
  {
    id: 'evt_blackout_flashlight',
    type: 'blackout_flashlight',
    kind: 'attack',
    label: 'Symbiote Blackout',
    description: 'Pitch-black shadow — catch 5 Flares to clear!',
    image: './images/s3/events/attack_symbiote_blackout.png',
    gemCost: 40,
    durationSeconds: 35,
    excludeSummoner: true,
  },
];

const LOCAL_EVENT_KEY_PREFIX = 'matthew_clicker_global_event_fallback_v1';
const LOCAL_EVENT_STOP_KEY_PREFIX = 'matthew_clicker_global_event_stop_v1';
const LOCAL_TOKEN_BROADCAST_KEY_PREFIX = 'matthew_clicker_token_broadcast_fallback_v1';
const LOCAL_GOLDEN_SWARM_KEY_PREFIX = 'matthew_clicker_golden_swarm_fallback_v1';
const LOCAL_EVENT_SCORE_KEY_PREFIX = 'matthew_clicker_event_score_v1';

function getLocalEventKey(isSandbox: boolean): string {
  return `${LOCAL_EVENT_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}`;
}

function getLocalStopKey(isSandbox: boolean): string {
  return `${LOCAL_EVENT_STOP_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}`;
}

function getLocalTokenBroadcastKey(isSandbox: boolean): string {
  return `${LOCAL_TOKEN_BROADCAST_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}`;
}

function getLocalGoldenSwarmKey(isSandbox: boolean): string {
  return `${LOCAL_GOLDEN_SWARM_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}`;
}

function getLocalScoreKey(eventId: string, isSandbox: boolean): string {
  return `${LOCAL_EVENT_SCORE_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}_${eventId}`;
}

export interface GlobalTokenBroadcast {
  id: string;
  uid: string;
  username: string;
  message: string;
  timestampMs: number;
  expiresAtMs: number;
}

export interface GlobalGoldenSwarmBroadcast {
  id: string;
  uid: string;
  username: string;
  count: number;
  message: string;
  timestampMs: number;
  expiresAtMs: number;
}

export interface GlobalEventScoreEntry {
  uid: string;
  username: string;
  clicks: number;
  updatedAtMs?: number;
}

interface EvSlotRecord {
  uid: string;
  isSandbox: boolean;
  updatedAtMs: number;
  event: ActiveGlobalLiveEvent | null;
}

interface EvSwarmRecord {
  uid: string;
  isSandbox: boolean;
  timestampMs: number;
  swarm: GlobalGoldenSwarmBroadcast | null;
}

interface EvStopRecord {
  uid: string;
  stoppedAtMs: number;
  scope: 'live' | 'sbx' | 'all';
}

interface EvScoreRecord {
  uid: string;
  username: string;
  isSandbox: boolean;
  eventId: string;
  score: number;
  updatedAtMs: number;
}

const EV_RANGE_QUERY = 'orderBy=%22%24key%22&startAt=%22__ev_%22&endAt=%22__ev_%EF%A3%BF%22';
const DEV_ADMIN_EVENT_DOC_PATH = 'usernames/__admin_89nsfff2YtaEVcNTHUBDq22V4FW2';
const DEV_TESTER_EVENT_DOC_PATH = 'usernames/__admin_cKFezHsISfbZGH4tKjQyME0wvrt1';

let cachedEvStore: Record<string, any> = {};

function getEvSlotKey(uid: string, isSandbox: boolean): string {
  const safeUid = (uid || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `__ev_slot_${isSandbox ? 'sbx_' : ''}${safeUid}`;
}

function getEvSwarmKey(uid: string, isSandbox: boolean): string {
  const safeUid = (uid || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `__ev_swarm_${isSandbox ? 'sbx_' : ''}${safeUid}`;
}

function getEvScoreKey(uid: string, isSandbox: boolean): string {
  const safeUid = (uid || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `__ev_score_${isSandbox ? 'sbx_' : ''}${safeUid}`;
}

function getEvStopKey(uid: string): string {
  const safeUid = (uid || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `__ev_stop_${safeUid}`;
}

function readLocalStopAtMs(isSandbox: boolean): number {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(getLocalStopKey(isSandbox));
      const num = raw ? Number(raw) : 0;
      return Number.isFinite(num) ? num : 0;
    }
  } catch {
    // ignore
  }
  return 0;
}

async function fetchEvStore(timeoutMs = 2000): Promise<Record<string, any> | null> {
  if (typeof fetch === 'undefined') return null;
  const token = await getAuthIdToken(900);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const baseUrl = `${RTDB_REST_BASE}/usernames.json?${EV_RANGE_QUERY}`;
    let res = await fetch(token ? `${baseUrl}&auth=${encodeURIComponent(token)}` : baseUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok && token && (res.status === 401 || res.status === 403)) {
      res = await fetch(baseUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
    }
    if (!res.ok) return null;
    const json = await res.json();
    if (json && typeof json === 'object') {
      cachedEvStore = json;
      return json;
    }
    cachedEvStore = {};
    return {};
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function extractActiveEventFromStore(
  store: Record<string, any> | null | undefined,
  isSandbox: boolean,
  nowMs: number = getServerNowMs()
): ActiveGlobalLiveEvent | null {
  let latestStopMs = readLocalStopAtMs(isSandbox);
  const candidates: ActiveGlobalLiveEvent[] = [];

  if (store && typeof store === 'object') {
    for (const [key, val] of Object.entries(store)) {
      if (!val || typeof val !== 'object') continue;
      if (key.startsWith('__ev_stop_')) {
        const stopRec = val as EvStopRecord;
        if (
          typeof stopRec.stoppedAtMs === 'number' &&
          (stopRec.scope === 'all' ||
            (isSandbox && stopRec.scope === 'sbx') ||
            (!isSandbox && stopRec.scope === 'live'))
        ) {
          latestStopMs = Math.max(latestStopMs, stopRec.stoppedAtMs);
        }
      } else if (key.startsWith('__ev_slot_')) {
        const slot = val as EvSlotRecord;
        const slotIsSbx = Boolean(slot.isSandbox || key.startsWith('__ev_slot_sbx_'));
        if (slotIsSbx !== isSandbox) continue;
        const ev = slot.event;
        if (ev && ev.id && ev.endsAtMs && nowMs <= ev.endsAtMs + 12_000) {
          candidates.push(ev);
        }
      }
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getLocalEventKey(isSandbox));
      if (saved) {
        const parsed = JSON.parse(saved) as ActiveGlobalLiveEvent;
        if (parsed && parsed.id && parsed.endsAtMs && nowMs <= parsed.endsAtMs + 12_000) {
          candidates.push(parsed);
        }
      }
    }
  } catch {
    // ignore parse error
  }

  const valid = candidates.filter((ev) => (ev.startedAtMs || 0) > latestStopMs);
  if (valid.length === 0) return null;
  valid.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0));
  return valid[0];
}

export function extractLatestSwarmFromStore(
  store: Record<string, any> | null | undefined,
  isSandbox: boolean,
  nowMs: number = getServerNowMs()
): GlobalGoldenSwarmBroadcast | null {
  const candidates: GlobalGoldenSwarmBroadcast[] = [];

  if (store && typeof store === 'object') {
    for (const [key, val] of Object.entries(store)) {
      if (!val || typeof val !== 'object') continue;
      if (key.startsWith('__ev_swarm_')) {
        const rec = val as EvSwarmRecord;
        const recIsSbx = Boolean(rec.isSandbox || key.startsWith('__ev_swarm_sbx_'));
        if (recIsSbx !== isSandbox) continue;
        const sw = rec.swarm;
        if (sw && sw.id && sw.expiresAtMs && nowMs <= sw.expiresAtMs) {
          candidates.push(sw);
        }
      }
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getLocalGoldenSwarmKey(isSandbox));
      if (saved) {
        const parsed = JSON.parse(saved) as GlobalGoldenSwarmBroadcast;
        if (parsed && parsed.id && parsed.expiresAtMs && nowMs <= parsed.expiresAtMs) {
          candidates.push(parsed);
        }
      }
    }
  } catch {
    // ignore
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
  return candidates[0];
}

export function extractScoresFromStore(
  store: Record<string, any> | null | undefined,
  eventId: string,
  isSandbox: boolean
): GlobalEventScoreEntry[] {
  const byUid: Record<string, GlobalEventScoreEntry> = {};

  if (store && typeof store === 'object') {
    for (const [key, val] of Object.entries(store)) {
      if (!val || typeof val !== 'object' || !key.startsWith('__ev_score_')) continue;
      const rec = val as EvScoreRecord;
      const recIsSbx = Boolean(rec.isSandbox || key.startsWith('__ev_score_sbx_'));
      if (recIsSbx !== isSandbox || rec.eventId !== eventId || typeof rec.score !== 'number') {
        continue;
      }
      const prev = byUid[rec.uid];
      if (!prev || rec.score > prev.clicks) {
        byUid[rec.uid] = {
          uid: rec.uid,
          username: rec.username || 'Player',
          clicks: Math.floor(rec.score),
          updatedAtMs: rec.updatedAtMs,
        };
      }
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getLocalScoreKey(eventId, isSandbox));
      if (saved) {
        const localMap = JSON.parse(saved) as Record<string, GlobalEventScoreEntry>;
        for (const [uid, entry] of Object.entries(localMap)) {
          if (!entry || typeof entry.clicks !== 'number') continue;
          const prev = byUid[uid];
          if (!prev || entry.clicks > prev.clicks) {
            byUid[uid] = entry;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return Object.values(byUid).sort((a, b) => b.clicks - a.clicks);
}

export async function summonGlobalLiveEvent(params: {
  spec: PlayerEventCostSpec;
  uid: string;
  username: string;
  isSandbox?: boolean;
  broadcastToAll?: boolean;
  excludeSummoner?: boolean;
  targetUid?: string | null;
  targetUsername?: string | null;
}): Promise<{ ok: boolean; cloudSynced?: boolean; event?: ActiveGlobalLiveEvent }> {
  const now = getServerNowMs();
  const isSbx = Boolean(params.isSandbox);
  const effectiveExclude =
    params.excludeSummoner !== undefined ? params.excludeSummoner : params.spec.excludeSummoner;
  const targetSuffix = params.targetUsername ? ` on ${params.targetUsername}` : ' on Everyone Else';
  const bannerMap: Record<GlobalEventType, string> = {
    golden_rain: `${params.username} summoned Stark Gold Rain (100x)!`,
    screen_freeze: `${params.username} cast Time Freeze${targetSuffix} (${params.spec.durationSeconds}s)!`,
    upside_down_chaos: `${params.username} cast Mirror Flip 180°${targetSuffix}!`,
    blackout_flashlight: `${params.username} unleashed Symbiote Blackout${targetSuffix}!`,
  };

  const event: ActiveGlobalLiveEvent = {
    id: `gevt_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    uid: params.uid,
    type: params.spec.type,
    kind: params.spec.kind,
    summonedByUid: params.uid,
    summonedByUsername: params.username,
    targetUid: params.targetUid || null,
    targetUsername: params.targetUsername || null,
    bannerText: bannerMap[params.spec.type],
    startedAtMs: now,
    // Offset by 4.5s intro cutscene playback so full event duration runs after cutscene ends
    endsAtMs: now + (params.spec.durationSeconds + 4.5) * 1000,
    durationSeconds: params.spec.durationSeconds,
    countOrTarget: params.spec.type === 'golden_rain' ? 100 : undefined,
    excludeSummoner: effectiveExclude,
  };

  const scopes = params.broadcastToAll ? [false, true] : [isSbx];
  for (const sc of scopes) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(getLocalStopKey(sc));
        localStorage.setItem(getLocalEventKey(sc), JSON.stringify(event));
      }
    } catch {
      // Ignore storage quota errors
    }
    const slotKey = getEvSlotKey(params.uid, sc);
    cachedEvStore[slotKey] = {
      uid: params.uid,
      isSandbox: sc,
      updatedAtMs: now,
      event,
    } satisfies EvSlotRecord;
  }

  // Write to caller-owned `usernames/__ev_slot_{uid}` (top-level `uid === auth.uid`) so every signed-in player & dev can always overwrite without RTDB lockouts
  const writeResults = await Promise.all(
    scopes.map((sc) => {
      const slotKey = getEvSlotKey(params.uid, sc);
      const payload: EvSlotRecord = {
        uid: params.uid,
        isSandbox: sc,
        updatedAtMs: now,
        event,
      };
      return rtdbRestWrite(`usernames/${slotKey}`, payload, 'PUT', 3500).catch(() => false);
    })
  );

  const cloudSynced = writeResults.some(Boolean);
  return { ok: true, cloudSynced, event };
}

export async function clearGlobalLiveEvent(
  isSandbox: boolean = false,
  broadcastToAll: boolean = false,
  uid?: string
): Promise<void> {
  const now = getServerNowMs();
  const scopes = broadcastToAll ? [false, true] : [Boolean(isSandbox)];
  for (const sc of scopes) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(getLocalEventKey(sc));
        localStorage.setItem(getLocalStopKey(sc), String(now));
      }
    } catch {
      // Ignore storage errors
    }
    if (uid) {
      delete cachedEvStore[getEvSlotKey(uid, sc)];
    }
  }

  const effectiveUid = uid || '89nsfff2YtaEVcNTHUBDq22V4FW2';
  const stopKey = getEvStopKey(effectiveUid);
  const stopRec: EvStopRecord = {
    uid: effectiveUid,
    stoppedAtMs: now,
    scope: broadcastToAll ? 'all' : isSandbox ? 'sbx' : 'live',
  };
  cachedEvStore[stopKey] = stopRec;

  await Promise.all([
    rtdbRestWrite(`usernames/${stopKey}`, stopRec, 'PUT', 3000).catch(() => false),
    ...(uid
      ? scopes.map((sc) =>
          rtdbRestWrite(
            `usernames/${getEvSlotKey(uid, sc)}`,
            {
              uid,
              isSandbox: sc,
              updatedAtMs: now,
              event: null,
            } satisfies EvSlotRecord,
            'PUT',
            3000
          ).catch(() => false)
        )
      : []),
  ]);
}

export async function broadcastGlobalGoldenSwarm(params: {
  uid: string;
  username: string;
  count?: number;
  isSandbox?: boolean;
  broadcastToAll?: boolean;
}): Promise<GlobalGoldenSwarmBroadcast> {
  const now = getServerNowMs();
  const isSbx = Boolean(params.isSandbox);
  const count = Math.min(24, Math.max(8, Math.floor(params.count ?? 18)));
  const broadcast: GlobalGoldenSwarmBroadcast = {
    id: `gswarm_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    uid: params.uid,
    username: params.username || 'Developer',
    count,
    message: `${params.username || 'Developer'} spawned ${count} Flying Golden Matthews across every screen!`,
    timestampMs: now,
    expiresAtMs: now + 90_000,
  };

  const scopes = params.broadcastToAll ? [false, true] : [isSbx];
  for (const sc of scopes) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(getLocalGoldenSwarmKey(sc), JSON.stringify(broadcast));
      }
    } catch {
      // Ignore storage quota errors
    }
    const swKey = getEvSwarmKey(params.uid, sc);
    cachedEvStore[swKey] = {
      uid: params.uid,
      isSandbox: sc,
      timestampMs: now,
      swarm: broadcast,
    } satisfies EvSwarmRecord;
  }

  await Promise.all(
    scopes.map((sc) =>
      rtdbRestWrite(
        `usernames/${getEvSwarmKey(params.uid, sc)}`,
        {
          uid: params.uid,
          isSandbox: sc,
          timestampMs: now,
          swarm: broadcast,
        } satisfies EvSwarmRecord,
        'PUT',
        3500
      ).catch(() => false)
    )
  );
  return broadcast;
}

export async function fetchLatestGlobalGoldenSwarm(
  isSandbox: boolean = false
): Promise<GlobalGoldenSwarmBroadcast | null> {
  const now = getServerNowMs();
  const store = await fetchEvStore(2000);
  const fromEv = extractLatestSwarmFromStore(store, isSandbox, now);
  if (fromEv) return fromEv;

  try {
    const [adminDoc, testerDoc] = await Promise.all([
      rtdbRestGet<{ goldenSwarm?: GlobalGoldenSwarmBroadcast | null }>(
        DEV_ADMIN_EVENT_DOC_PATH,
        2000
      ).catch(() => null),
      rtdbRestGet<{ goldenSwarm?: GlobalGoldenSwarmBroadcast | null }>(
        DEV_TESTER_EVENT_DOC_PATH,
        2000
      ).catch(() => null),
    ]);
    const candidates = [adminDoc?.goldenSwarm, testerDoc?.goldenSwarm].filter(
      (s): s is GlobalGoldenSwarmBroadcast =>
        Boolean(s && s.id && s.expiresAtMs && now <= s.expiresAtMs)
    );
    if (candidates.length > 0) {
      candidates.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
      return candidates[0];
    }
  } catch {
    // ignore
  }
  return extractLatestSwarmFromStore(null, isSandbox, now);
}

export async function fetchActiveGlobalLiveEvent(
  isSandbox: boolean = false
): Promise<ActiveGlobalLiveEvent | null> {
  const now = getServerNowMs();
  const store = await fetchEvStore(2000);
  const fromEv = extractActiveEventFromStore(store, isSandbox, now);
  if (fromEv) return fromEv;

  let stopFloor = readLocalStopAtMs(isSandbox);
  if (store) {
    for (const [k, v] of Object.entries(store)) {
      if (k.startsWith('__ev_stop_') && v && typeof (v as EvStopRecord).stoppedAtMs === 'number') {
        stopFloor = Math.max(stopFloor, (v as EvStopRecord).stoppedAtMs);
      }
    }
  }

  try {
    const [adminDoc, testerDoc] = await Promise.all([
      rtdbRestGet<{ activeGlobalEvent?: ActiveGlobalLiveEvent | null }>(
        DEV_ADMIN_EVENT_DOC_PATH,
        2000
      ).catch(() => null),
      rtdbRestGet<{ activeGlobalEvent?: ActiveGlobalLiveEvent | null }>(
        DEV_TESTER_EVENT_DOC_PATH,
        2000
      ).catch(() => null),
    ]);
    const candidates = [adminDoc?.activeGlobalEvent, testerDoc?.activeGlobalEvent].filter(
      (ev): ev is ActiveGlobalLiveEvent =>
        Boolean(
          ev &&
            ev.id &&
            ev.endsAtMs &&
            now <= ev.endsAtMs + 12_000 &&
            (ev.startedAtMs || 0) > stopFloor
        )
    );
    if (candidates.length > 0) {
      candidates.sort((a, b) => (b.startedAtMs || 0) - (a.startedAtMs || 0));
      return candidates[0];
    }
  } catch {
    // ignore
  }
  return null;
}

export async function broadcastMatthewTokenPull(params: {
  uid: string;
  username: string;
  isSandbox?: boolean;
}): Promise<GlobalTokenBroadcast> {
  const now = getServerNowMs();
  const isSbx = Boolean(params.isSandbox);
  const broadcast: GlobalTokenBroadcast = {
    id: `tok_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    uid: params.uid,
    username: params.username || 'A lucky player',
    message: `${params.username || 'A lucky player'} just pulled the ULTRA-RARE MATTHEW SHOP TOKEN!`,
    timestampMs: now,
    expiresAtMs: now + 90_000,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getLocalTokenBroadcastKey(isSbx), JSON.stringify(broadcast));
    }
  } catch {
    // ignore storage quota errors
  }
  await rtdbRestWrite(
    scopeRtdbPath('usernames/__token_broadcast', isSbx),
    broadcast,
    'PUT'
  ).catch(() => false);
  return broadcast;
}

export async function fetchLatestMatthewTokenBroadcast(
  isSandbox: boolean = false
): Promise<GlobalTokenBroadcast | null> {
  const now = getServerNowMs();
  try {
    const data = await rtdbRestGet<GlobalTokenBroadcast>(
      scopeRtdbPath('usernames/__token_broadcast', isSandbox),
      2000
    );
    if (data && data.id && data.expiresAtMs && now <= data.expiresAtMs) {
      return data;
    }
  } catch {
    // fallback below
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getLocalTokenBroadcastKey(isSandbox));
      if (saved) {
        const parsed = JSON.parse(saved) as GlobalTokenBroadcast;
        if (parsed && parsed.id && parsed.expiresAtMs && now <= parsed.expiresAtMs) {
          return parsed;
        }
      }
    }
  } catch {
    // ignore parse error
  }
  return null;
}

export async function submitGlobalEventScore(params: {
  eventId: string;
  uid: string;
  username: string;
  score: number;
  isSandbox?: boolean;
}): Promise<void> {
  const isSbx = Boolean(params.isSandbox);
  const now = getServerNowMs();
  const safeScore = Math.max(0, Math.floor(params.score));
  const record: EvScoreRecord = {
    uid: params.uid,
    username: params.username || 'Player',
    isSandbox: isSbx,
    eventId: params.eventId,
    score: safeScore,
    updatedAtMs: now,
  };
  const key = getEvScoreKey(params.uid, isSbx);
  cachedEvStore[key] = record;

  try {
    if (typeof localStorage !== 'undefined') {
      const lk = getLocalScoreKey(params.eventId, isSbx);
      const raw = localStorage.getItem(lk);
      const map = raw ? (JSON.parse(raw) as Record<string, GlobalEventScoreEntry>) : {};
      map[params.uid] = {
        uid: params.uid,
        username: params.username || 'Player',
        clicks: safeScore,
        updatedAtMs: now,
      };
      localStorage.setItem(lk, JSON.stringify(map));
    }
  } catch {
    // ignore
  }

  await rtdbRestWrite(`usernames/${key}`, record, 'PUT', 2500).catch(() => false);
}

export async function fetchGlobalEventLeaderboard(
  eventId: string,
  isSandbox: boolean = false
): Promise<GlobalEventScoreEntry[]> {
  const store = (await fetchEvStore(2000)) || cachedEvStore;
  return extractScoresFromStore(store, eventId, isSandbox);
}

export async function submitMarathonScore(params: {
  eventId: string;
  uid: string;
  username: string;
  clicks: number;
  isSandbox?: boolean;
}): Promise<void> {
  return submitGlobalEventScore({
    eventId: params.eventId,
    uid: params.uid,
    username: params.username,
    score: params.clicks,
    isSandbox: params.isSandbox,
  });
}

export async function fetchMarathonLeaderboard(
  eventId: string,
  isSandbox: boolean = false
): Promise<GlobalEventScoreEntry[]> {
  return fetchGlobalEventLeaderboard(eventId, isSandbox);
}

export interface GlobalEventsStreamSnapshot {
  activeEvent: ActiveGlobalLiveEvent | null;
  latestSwarm: GlobalGoldenSwarmBroadcast | null;
  store: Record<string, any>;
}

const LOCAL_SNAP_KEY_PREFIX = 'matthew_clicker_infinity_snap_v1';

export function extractLatestPendingSnapFromStore(
  store: Record<string, any> | null | undefined,
  currentUid: string | null | undefined,
  lastProcessedSnapId: string | null | undefined,
  isSandbox: boolean,
  nowMs: number = getServerNowMs()
): SnapEventRecord | null {
  if (!currentUid) return null;
  const candidates: SnapEventRecord[] = [];

  if (store && typeof store === 'object') {
    for (const [key, val] of Object.entries(store)) {
      if (!val || typeof val !== 'object' || !key.startsWith('__ev_snap_')) continue;
      const snap = val as SnapEventRecord;
      if (
        snap.snapId &&
        Boolean(snap.isSandbox) === isSandbox &&
        nowMs <= (snap.expiresAtMs || 0) &&
        Array.isArray(snap.victimUids) &&
        snap.victimUids.includes(currentUid) &&
        snap.snappedByUid !== currentUid &&
        snap.snapId !== lastProcessedSnapId
      ) {
        candidates.push(snap);
      }
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`${LOCAL_SNAP_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}`);
      if (raw) {
        const snap = JSON.parse(raw) as SnapEventRecord;
        if (
          snap &&
          snap.snapId &&
          nowMs <= (snap.expiresAtMs || 0) &&
          Array.isArray(snap.victimUids) &&
          snap.victimUids.includes(currentUid) &&
          snap.snapId !== lastProcessedSnapId
        ) {
          candidates.push(snap);
        }
      }
    }
  } catch {
    // ignore
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
  return candidates[0];
}

export async function broadcastInfinitySnap(params: {
  uid: string;
  username: string;
  victimUids: string[];
  isSandbox?: boolean;
  allowSelfVictimForTest?: boolean;
}): Promise<SnapEventRecord> {
  const now = getServerNowMs();
  const isSbx = Boolean(params.isSandbox);
  const filteredVictims = Array.from(
    new Set(
      params.victimUids.filter(
        (id) => Boolean(id) && (params.allowSelfVictimForTest || id !== params.uid)
      )
    )
  );
  const snap: SnapEventRecord = {
    uid: params.uid,
    snapId: `snap_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    snappedByUid: params.uid,
    snappedByUsername: params.username || 'Thanos',
    victimUids: filteredVictims,
    isSandbox: isSbx,
    timestampMs: now,
    // Keep active 7 days so offline snapped players still see the dust cutscene when they next log in
    expiresAtMs: now + 7 * 24 * 60 * 60 * 1000,
  };

  const safeUid = (params.uid || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  const key = `__ev_snap_${isSbx ? 'sbx_' : ''}${safeUid}`;
  cachedEvStore[key] = snap;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${LOCAL_SNAP_KEY_PREFIX}_${isSbx ? 'sbx' : 'live'}`, JSON.stringify(snap));
    }
  } catch {
    // ignore
  }

  await rtdbRestWrite(`usernames/${key}`, snap, 'PUT', 3500).catch(() => false);
  return snap;
}

/**
 * Sub-second real-time stream + fast 750ms fallback sync for global events, Golden Matthew swarms, and event scoreboards.
 * Uses Firebase RTDB Server-Sent Events (`EventSource`) on the lightweight `usernames/__ev_*` key range so events appear
 * across every screen in < 1 second without opening Firebase SDK WebSockets.
 */
export function subscribeToGlobalEventsRealtime(
  isSandbox: boolean,
  onUpdate: (snapshot: GlobalEventsStreamSnapshot) => void
): () => void {
  let closed = false;
  let localStore: Record<string, any> = { ...cachedEvStore };
  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const notify = () => {
    if (closed) return;
    const now = getServerNowMs();
    cachedEvStore = localStore;
    onUpdate({
      activeEvent: extractActiveEventFromStore(localStore, isSandbox, now),
      latestSwarm: extractLatestSwarmFromStore(localStore, isSandbox, now),
      store: localStore,
    });
  };

  const applySseFrame = (rawData: string, isPatch: boolean) => {
    try {
      const parsed = JSON.parse(rawData) as { path?: string; data?: any };
      const path = typeof parsed?.path === 'string' ? parsed.path : '/';
      const data = parsed?.data;

      if (path === '/') {
        if (isPatch && data && typeof data === 'object') {
          for (const [k, v] of Object.entries(data)) {
            if (v === null) delete localStore[k];
            else localStore[k] = v;
          }
        } else {
          localStore = data && typeof data === 'object' ? { ...data } : {};
        }
        notify();
        return;
      }

      const trimmed = path.replace(/^\/+/, '');
      const segments = trimmed.split('/').filter(Boolean);
      const topKey = segments[0];
      if (!topKey) return;

      if (segments.length === 1) {
        if (isPatch && data && typeof data === 'object') {
          localStore[topKey] = { ...(localStore[topKey] || {}), ...data };
        } else if (data === null) {
          delete localStore[topKey];
        } else {
          localStore[topKey] = data;
        }
      } else {
        // Nested mutation inside a key; mutate leaf or trigger quick fetch
        let target: Record<string, any> =
          localStore[topKey] && typeof localStore[topKey] === 'object'
            ? { ...localStore[topKey] }
            : {};
        localStore[topKey] = target;
        let cursor = target;
        for (let i = 1; i < segments.length - 1; i++) {
          const seg = segments[i];
          if (!cursor[seg] || typeof cursor[seg] !== 'object') {
            cursor[seg] = {};
          }
          cursor = cursor[seg];
        }
        const leaf = segments[segments.length - 1];
        if (isPatch && data && typeof data === 'object') {
          cursor[leaf] = { ...(cursor[leaf] || {}), ...data };
        } else if (data === null) {
          delete cursor[leaf];
        } else {
          cursor[leaf] = data;
        }
      }
      notify();
    } catch {
      // Ignore malformed SSE frame
    }
  };

  const connectSse = () => {
    if (closed || typeof EventSource === 'undefined') return;
    try {
      es?.close();
      const url = `${RTDB_REST_BASE}/usernames.json?${EV_RANGE_QUERY}`;
      es = new EventSource(url);
      es.addEventListener('put', (evt: Event) => {
        const msg = evt as MessageEvent<string>;
        if (msg?.data) applySseFrame(msg.data, false);
      });
      es.addEventListener('patch', (evt: Event) => {
        const msg = evt as MessageEvent<string>;
        if (msg?.data) applySseFrame(msg.data, true);
      });
      es.onerror = () => {
        try {
          es?.close();
        } catch {
          // ignore
        }
        es = null;
        if (!closed && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectSse();
          }, 2500);
        }
      };
    } catch {
      // Fall back cleanly to 750ms poll
    }
  };

  const fastPoll = async () => {
    if (closed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const fresh = await fetchEvStore(1500);
    if (!closed && fresh) {
      localStore = fresh;
      notify();
    }
  };

  connectSse();
  fastPoll();
  const pollTimer = setInterval(fastPoll, 750);

  return () => {
    closed = true;
    clearInterval(pollTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try {
      es?.close();
    } catch {
      // ignore
    }
  };
}
