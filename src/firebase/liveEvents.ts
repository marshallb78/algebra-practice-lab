import { rtdbRestGet, rtdbRestWrite, scopeRtdbPath } from './config';

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

function getLocalEventKey(isSandbox: boolean): string {
  return `${LOCAL_EVENT_KEY_PREFIX}_${isSandbox ? 'sbx' : 'live'}`;
}

export async function summonGlobalLiveEvent(params: {
  spec: PlayerEventCostSpec;
  uid: string;
  username: string;
  isSandbox?: boolean;
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

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getLocalEventKey(isSbx), JSON.stringify(event));
    }
  } catch {
    // Ignore storage quota errors
  }

  const path = scopeRtdbPath(`events/activeGlobal`, isSbx);
  await rtdbRestWrite(path, event, 'PUT').catch(() => false);
  return { ok: true, event };
}

export async function fetchActiveGlobalLiveEvent(
  isSandbox: boolean = false
): Promise<ActiveGlobalLiveEvent | null> {
  const now = Date.now();
  try {
    const data = await rtdbRestGet<ActiveGlobalLiveEvent>(
      scopeRtdbPath('events/activeGlobal', isSandbox),
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

export async function submitMarathonScore(params: {
  eventId: string;
  uid: string;
  username: string;
  clicks: number;
  isSandbox?: boolean;
}): Promise<void> {
  await rtdbRestWrite(
    scopeRtdbPath(`events/marathon/${params.eventId}/${params.uid}`, params.isSandbox),
    {
      uid: params.uid,
      username: params.username,
      clicks: Math.floor(params.clicks),
      updatedAtMs: Date.now(),
    },
    'PUT'
  ).catch(() => false);
}

export async function fetchMarathonLeaderboard(
  eventId: string,
  isSandbox: boolean = false
): Promise<{ uid: string; username: string; clicks: number }[]> {
  const map = await rtdbRestGet<Record<string, { uid: string; username: string; clicks: number }>>(
    scopeRtdbPath(`events/marathon/${eventId}`, isSandbox),
    3000
  );
  if (!map || typeof map !== 'object') return [];
  return Object.values(map)
    .filter((x) => x && typeof x.clicks === 'number')
    .sort((a, b) => b.clicks - a.clicks);
}

