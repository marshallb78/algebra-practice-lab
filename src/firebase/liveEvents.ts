import { rtdbRestDelete, rtdbRestGet, rtdbRestWrite, scopeRtdbPath } from './config';

export type GlobalEventType =
  | 'click_marathon'
  | 'falling_matthews'
  | 'golden_rain'
  | 'zombie_boss_raid'
  | 'screen_freeze';

export interface ActiveGlobalLiveEvent {
  id: string;
  type: GlobalEventType;
  summonedByUid: string;
  summonedByUsername: string;
  bannerText: string;
  startedAtMs: number;
  endsAtMs: number;
  durationSeconds: number;
  /** Used for Click Fast Marathon (~10x own money winner payout) & Falling Matthews / Golden Rain */
  countOrTarget?: number;
  excludeSummoner?: boolean;
  /** Winner info populated at completion of Click Fast Marathon */
  marathonTopUid?: string;
  marathonTopUsername?: string;
  marathonTopClicks?: number;
}

export interface PlayerEventCostSpec {
  type: GlobalEventType;
  label: string;
  description: string;
  gemCost: number;
  durationSeconds: number;
  excludeSummoner: boolean;
}

export const PLAYER_TRIGGERABLE_EVENTS: (PlayerEventCostSpec & { id: string })[] = [
  {
    id: 'evt_click_marathon',
    type: 'click_marathon',
    label: 'Click Fast Marathon (60s)',
    description: 'Everyone competes to click fastest for 60s! Winner earns ~10x their own money!',
    gemCost: 35,
    durationSeconds: 60,
    excludeSummoner: false,
  },
  {
    id: 'evt_falling_matthews',
    type: 'falling_matthews',
    label: 'Click Falling Matthews',
    description: 'Rains clickable tumbling Matthews across every player screen for bonus loot!',
    gemCost: 25,
    durationSeconds: 30,
    excludeSummoner: false,
  },
  {
    id: 'evt_golden_rain',
    type: 'golden_rain',
    label: '100 Golden Matthew Rain',
    description: 'Summons 100 flying Golden Matthews swarming across the server!',
    gemCost: 45,
    durationSeconds: 35,
    excludeSummoner: false,
  },
  {
    id: 'evt_zombie_boss_raid',
    type: 'zombie_boss_raid',
    label: 'Server Zombie Boss Raid',
    description: 'Unleashes an armored Giant Zombie Boss on EVERYONE ELSE (you stay safe)!',
    gemCost: 40,
    durationSeconds: 55,
    excludeSummoner: true,
  },
  {
    id: 'evt_screen_freeze_30',
    type: 'screen_freeze',
    label: 'Screen Freeze — 30s Tier',
    description: 'Encases EVERYONE ELSE’s screen in solid ice for 30s (tap to shatter frost)!',
    gemCost: 30,
    durationSeconds: 30,
    excludeSummoner: true,
  },
  {
    id: 'evt_screen_freeze_60',
    type: 'screen_freeze',
    label: 'Screen Freeze — 60s Tier',
    description: 'Deep-freezes EVERYONE ELSE’s screen for a full 60s (you stay unfrozen)!',
    gemCost: 55,
    durationSeconds: 60,
    excludeSummoner: true,
  },
];

const LOCAL_EVENT_KEY_PREFIX = 'matthew_clicker_global_event_fallback_v1';
const LOCAL_TOKEN_BROADCAST_KEY_PREFIX = 'matthew_clicker_token_broadcast_fallback_v1';
const LOCAL_GOLDEN_SWARM_KEY_PREFIX = 'matthew_clicker_golden_swarm_fallback_v1';

function getLocalEventKey(isSandbox: boolean): string {
  return `${LOCAL_EVENT_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}`;
}

function getLocalTokenBroadcastKey(isSandbox: boolean): string {
  return `${LOCAL_TOKEN_BROADCAST_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}`;
}

function getLocalGoldenSwarmKey(isSandbox: boolean): string {
  return `${LOCAL_GOLDEN_SWARM_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}`;
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

export async function summonGlobalLiveEvent(params: {
  spec: PlayerEventCostSpec;
  uid: string;
  username: string;
  isSandbox?: boolean;
  broadcastToAll?: boolean;
}): Promise<{ ok: boolean; event?: ActiveGlobalLiveEvent }> {
  const now = Date.now();
  const isSbx = Boolean(params.isSandbox);
  const bannerMap: Record<GlobalEventType, string> = {
    click_marathon: `${params.username} Summoned a Click Event! (60s Marathon)`,
    falling_matthews: `${params.username} Summoned a Click Event! (Falling Matthews)`,
    golden_rain: `${params.username} Summoned a Click Event! (100 Golden Matthews)`,
    zombie_boss_raid: `${params.username} Unleashed a Zombie Boss Raid on Everyone Else!`,
    screen_freeze: `${params.username} Froze Everyone Else's Screen (${params.spec.durationSeconds}s)!`,
  };

  const event: ActiveGlobalLiveEvent = {
    id: `gevt_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type: params.spec.type,
    summonedByUid: params.uid,
    summonedByUsername: params.username,
    bannerText: bannerMap[params.spec.type],
    startedAtMs: now,
    // Offset by 4.5s intro cutscene playback so full event duration runs after cutscene ends
    endsAtMs: now + (params.spec.durationSeconds + 4.5) * 1000,
    durationSeconds: params.spec.durationSeconds,
    countOrTarget: params.spec.type === 'golden_rain' ? 100 : undefined,
    excludeSummoner: params.spec.excludeSummoner,
  };

  const scopes = params.broadcastToAll ? [false, true] : [isSbx];
  for (const sc of scopes) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(getLocalEventKey(sc), JSON.stringify(event));
      }
    } catch {
      // Ignore storage quota errors
    }
  }

  // Write under `usernames/__global_live_event` so Firebase RTDB security rules allow all signed-in players to broadcast and read
  await Promise.all(
    scopes.map((sc) =>
      rtdbRestWrite(scopeRtdbPath('usernames/__global_live_event', sc), event, 'PUT').catch(
        () => false
      )
    )
  );
  return { ok: true, event };
}

export async function clearGlobalLiveEvent(
  isSandbox: boolean = false,
  broadcastToAll: boolean = false
): Promise<void> {
  const scopes = broadcastToAll ? [false, true] : [Boolean(isSandbox)];
  for (const sc of scopes) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(getLocalEventKey(sc));
      }
    } catch {
      // Ignore storage errors
    }
  }
  await Promise.all(
    scopes.map((sc) =>
      rtdbRestDelete(scopeRtdbPath('usernames/__global_live_event', sc)).catch(() => false)
    )
  );
}

export async function broadcastGlobalGoldenSwarm(params: {
  uid: string;
  username: string;
  count?: number;
  isSandbox?: boolean;
  broadcastToAll?: boolean;
}): Promise<GlobalGoldenSwarmBroadcast> {
  const now = Date.now();
  const isSbx = Boolean(params.isSandbox);
  const count = Math.min(24, Math.max(8, Math.floor(params.count ?? 18)));
  const broadcast: GlobalGoldenSwarmBroadcast = {
    id: `gswarm_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    uid: params.uid,
    username: params.username || 'Developer',
    count,
    message: `${params.username || 'Developer'} spawned ${count} Flying Golden Matthews across every screen!`,
    timestampMs: now,
    expiresAtMs: now + 60_000,
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
  }
  await Promise.all(
    scopes.map((sc) =>
      rtdbRestWrite(scopeRtdbPath('usernames/__golden_swarm', sc), broadcast, 'PUT').catch(
        () => false
      )
    )
  );
  return broadcast;
}

export async function fetchLatestGlobalGoldenSwarm(
  isSandbox: boolean = false
): Promise<GlobalGoldenSwarmBroadcast | null> {
  const now = Date.now();
  try {
    const data = await rtdbRestGet<GlobalGoldenSwarmBroadcast>(
      scopeRtdbPath('usernames/__golden_swarm', isSandbox),
      2500
    );
    if (data && data.id && data.expiresAtMs && now <= data.expiresAtMs) {
      return data;
    }
  } catch {
    // Fallback below
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getLocalGoldenSwarmKey(isSandbox));
      if (saved) {
        const parsed = JSON.parse(saved) as GlobalGoldenSwarmBroadcast;
        if (parsed && parsed.id && parsed.expiresAtMs && now <= parsed.expiresAtMs) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export async function fetchActiveGlobalLiveEvent(
  isSandbox: boolean = false
): Promise<ActiveGlobalLiveEvent | null> {
  const now = Date.now();
  try {
    const data = await rtdbRestGet<ActiveGlobalLiveEvent>(
      scopeRtdbPath('usernames/__global_live_event', isSandbox),
      3000
    );
    if (data && data.id && data.endsAtMs && now <= data.endsAtMs + 6000) {
      return data;
    }
  } catch {
    // Fall back to local cache below
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getLocalEventKey(isSandbox));
      if (saved) {
        const parsed = JSON.parse(saved) as ActiveGlobalLiveEvent;
        if (parsed && parsed.id && parsed.endsAtMs && now <= parsed.endsAtMs + 6000) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

export async function broadcastMatthewTokenPull(params: {
  uid: string;
  username: string;
  isSandbox?: boolean;
}): Promise<GlobalTokenBroadcast> {
  const now = Date.now();
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
  const now = Date.now();
  try {
    const data = await rtdbRestGet<GlobalTokenBroadcast>(
      scopeRtdbPath('usernames/__token_broadcast', isSandbox),
      2500
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

export async function submitMarathonScore(params: {
  eventId: string;
  uid: string;
  username: string;
  clicks: number;
  isSandbox?: boolean;
}): Promise<void> {
  await rtdbRestWrite(
    scopeRtdbPath(`usernames/__marathon_${params.eventId}`, params.isSandbox),
    {
      [params.uid]: {
        uid: params.uid,
        username: params.username,
        clicks: Math.floor(params.clicks),
        updatedAtMs: Date.now(),
      },
    },
    'PATCH'
  ).catch(() => false);
}

export async function fetchMarathonLeaderboard(
  eventId: string,
  isSandbox: boolean = false
): Promise<{ uid: string; username: string; clicks: number }[]> {
  const map = await rtdbRestGet<Record<string, { uid: string; username: string; clicks: number }>>(
    scopeRtdbPath(`usernames/__marathon_${eventId}`, isSandbox),
    3000
  );
  if (!map || typeof map !== 'object') return [];
  return Object.values(map)
    .filter((x) => x && typeof x.clicks === 'number')
    .sort((a, b) => b.clicks - a.clicks);
}

