import React, { useState, useEffect, useRef } from 'react';
import { CosmeticSlot, GameState } from './types/game';
import {
  loadGame,
  loadSandboxGame,
  saveGame,
  performBetaWipeIfDue,
  performSeasonalRollover,
  getPermanentTokenFreeSkinIds,
} from './utils/storage';
import {
  equipSkin,
  getSkinById,
  checkAndApplyMilestoneUnlocks,
  isSeason2OnlySkinId,
} from './data/skins';
import { ALL_CURSORS, getCursorById } from './data/cursors';
import { CRATE_DEFINITIONS, CrateOpenResult, CrateType, rollCrateReward } from './data/crates';
import { MATTHEW_VAULT_SKINS } from './data/season2Skins';
import { ALL_MARVEL_SKINS } from './data/season3Skins';
import { checkAndAutoClaimQuests } from './data/quests';
import {
  addCoinsWithKrillionCarry,
  calculateClickPower,
  calculateOfflineEarnings,
  calculateCPS,
  clampFiniteCoinAmount,
  MAX_SAFE_SEASON_COINS,
} from './utils/calculations';
import { formatCoins, formatNumber } from './utils/formatters';
import {
  getActiveSeason,
  getEffectiveSeasonInfo,
  isFridayBonusActive,
  evaluateMatthewStormState,
} from './utils/scheduleEngine';
import {
  MATTHEW_STORM_CONFIG,
  SEASON_CONFIG,
  SEASON_2_CONFIG,
  SEASON_3_CONFIG,
  TEST_ISOLATION_CONFIG,
  isAuthorizedDevUid,
  isSandboxSeason2Context,
} from './config/gameConfig';
import { getFirebaseServices, getServerNowMs, syncServerClockOffset } from './firebase/config';
import {
  claimSingleDeviceSession,
  logoutPlayer,
  subscribeToAuthChanges,
  verifySingleDeviceSession,
} from './firebase/auth';
import {
  clearCloudSaveSignature,
  hasCompletedInitialCloudPull,
  hasForeignDeviceSavedMoreRecently,
  loadAndReconcileCloudSave,
  registerForeignCloudUpdateHandler,
  saveStateToCloud,
  saveStateToCloudKeepalive,
} from './firebase/cloudSave';
import {
  LeaderboardEntry,
  checkSeason1PlacementRewards,
  fetchWorldwideLeaderboard,
  isLeaderboardPlayerOnline,
} from './firebase/leaderboard';
import {
  BanRecord,
  PlayerSuspicionReport,
  ProbationReport,
  ServerBroadcast,
  adminPublishGlobalEvent,
  adminPublishGoldenSwarm,
  checkAccountBanStatus,
  enforceAutoBan50Cps,
  fetchPlayerSuspicionReports,
  fetchProbationAlerts,
  getCachedServerBroadcast,
  isVerifiedLiveDevSession,
  loadLocalProbationState,
  reportAccountProbation,
  syncOwnProbationStatus,
} from './firebase/moderation';
import {
  ActiveGlobalLiveEvent,
  PLAYER_TRIGGERABLE_EVENTS,
  PlayerEventCostSpec,
  SnapEventRecord,
  broadcastGlobalGoldenSwarm,
  broadcastInfinitySnap,
  broadcastMatthewTokenPull,
  clearGlobalLiveEvent,
  extractLatestPendingSnapFromStore,
  fetchLatestMatthewTokenBroadcast,
  subscribeToGlobalEventsRealtime,
  summonGlobalLiveEvent,
} from './firebase/liveEvents';
import {
  ChestLootResult,
  ALL_INFINITY_STONE_IDS,
  getInfinityStoneDefinition,
  hasAllInfinityStones,
  rollChestLoot,
} from './data/infinityGauntlet';
import { COSMETIC_ITEMS, getCosmeticById } from './data/cosmetics';
import { FrozenIntroCutsceneModal } from './components/s2/FrozenIntroCutsceneModal';
import { MarvelIntroCutsceneModal } from './components/s3/MarvelIntroCutsceneModal';
import { SnapDustCutsceneModal } from './components/s3/SnapDustCutsceneModal';
import { ThanosResetCutsceneModal } from './components/s3/ThanosResetCutsceneModal';
import { DevTestMenuModal } from './components/DevTestMenuModal';
import { ChestOpenCutsceneModal } from './components/s2/ChestOpenCutsceneModal';
import { CrateOpenCutsceneModal } from './components/s2/CrateOpenCutsceneModal';
import { EquippedCursorFollower } from './components/s2/CursorVisual';
import { TokenUnlockCutsceneModal } from './components/s2/TokenUnlockCutsceneModal';
import { EventCutsceneModal, LiveEventCutsceneKind } from './components/s2/EventCutsceneModal';
import { GemItemShopModal } from './components/s2/GemItemShopModal';
import {
  LiveEventsHubModal,
  ActiveGlobalEventOverlay,
} from './components/s2/LiveEventsOverlay';
import { useGameLoop } from './hooks/useGameLoop';
import { ClickerArea } from './components/ClickerArea';
import { RightPanel } from './components/RightPanel';
import { ParticleCanvas, particleEngine } from './components/ParticleCanvas';
import { GoldenMatthewEvent } from './components/GoldenMatthewEvent';
import { OfflineProgressModal } from './components/OfflineProgressModal';
import { SkinQualityModal } from './components/SkinQualityModal';
import { AccountModal } from './components/AccountModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { MatthewStormModal } from './components/MatthewStormModal';
import { IntroCutsceneModal } from './components/IntroCutsceneModal';
import { EscMenuModal } from './components/EscMenuModal';
import { SeasonDowntimeModal } from './components/SeasonDowntimeModal';
import { BannedScreenModal } from './components/BannedScreenModal';
import { DevToolsModal, SandboxTestAction } from './components/DevToolsModal';
import { soundManager } from './audio/soundManager';
import { BALANCE } from './data/balance';
import { X, Sparkles, ChevronUp, ChevronDown, ShieldAlert } from 'lucide-react';

interface Toast {
  id: number;
  title: string;
  subtitle: string;
}

function getBootInitialState(): GameState {
  // Pre-Monday Season 2 dev preview must completely reset on every reload; never boot into sandbox storage.
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(TEST_ISOLATION_CONFIG.sandboxStorageKey);
    }
  } catch {
    // ignore boot storage cleanup error
  }
  return loadGame();
}

export function App() {
  const [state, setState] = useState<GameState>(() => getBootInitialState());
  const [showEscMenu, setShowEscMenu] = useState(false);
  const [showSkinQualityModal, setShowSkinQualityModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showStormShop, setShowStormShop] = useState(false);
  const [showStormRecap, setShowStormRecap] = useState(false);
  const [showDevToolsModal, setShowDevToolsModal] = useState(false);
  const [showDevTestMenu, setShowDevTestMenu] = useState(false);
  const [forceSpawnChestCounter, setForceSpawnChestCounter] = useState(0);
  const [showIntroCutscene, setShowIntroCutscene] = useState<boolean>(true);

  // Season 2 / Season 3 Preview states
  const [sandboxS2Enabled, setSandboxS2Enabled] = useState<boolean>(() =>
    Boolean(state.sandboxS2Enabled)
  );
  const sandboxS2EnabledRef = useRef<boolean>(Boolean(state.sandboxS2Enabled));
  sandboxS2EnabledRef.current = sandboxS2Enabled;
  const [sandboxS3Enabled, setSandboxS3Enabled] = useState<boolean>(() =>
    Boolean(state.sandboxS3Enabled)
  );
  const sandboxS3EnabledRef = useRef<boolean>(Boolean(state.sandboxS3Enabled));
  sandboxS3EnabledRef.current = sandboxS3Enabled;
  const isGameplayPausedRef = useRef<boolean>(false);
  const [showFrozenIntro, setShowFrozenIntro] = useState(false);
  const [showMarvelIntro, setShowMarvelIntro] = useState(false);
  const [showThanosReset, setShowThanosReset] = useState(false);
  const [pendingSnapCutscene, setPendingSnapCutscene] = useState<{
    snap: SnapEventRecord;
    isPreview?: boolean;
  } | null>(null);
  const [isSnapBusy, setIsSnapBusy] = useState(false);
  const [showItemShopModal, setShowItemShopModal] = useState(false);
  const [showLiveEventsModal, setShowLiveEventsModal] = useState(false);
  const [pendingEventCutscene, setPendingEventCutscene] = useState<{
    id: string;
    kind: LiveEventCutsceneKind;
    summonedBy?: string;
  } | null>(null);
  const [chestCutsceneLoot, setChestCutsceneLoot] = useState<ChestLootResult | null>(null);
  const [crateCutsceneResult, setCrateCutsceneResult] = useState<CrateOpenResult | null>(null);
  const [showTokenCutscene, setShowTokenCutscene] = useState(false);
  const [sessionLockedByOtherDevice, setSessionLockedByOtherDevice] = useState(false);
  const [activeGlobalEvent, setActiveGlobalEvent] = useState<ActiveGlobalLiveEvent | null>(null);
  const activeGlobalEventRef = useRef<ActiveGlobalLiveEvent | null>(null);
  activeGlobalEventRef.current = activeGlobalEvent;
  const [evStoreSnapshot, setEvStoreSnapshot] = useState<Record<string, any>>({});
  const [sandboxStormStartMs, setSandboxStormStartMs] = useState<number | null>(null);
  const [previewDowntimeOverride, setPreviewDowntimeOverride] = useState(false);

  const [activeBanRecord, setActiveBanRecord] = useState<BanRecord | null>(null);
  const [isProbationActive, setIsProbationActive] = useState<boolean>(() =>
    Boolean(loadLocalProbationState(state.cloudAccount?.uid))
  );
  const [probationAlerts, setProbationAlerts] = useState<ProbationReport[]>([]);
  const seenProbationKeysRef = useRef<Set<string>>(new Set());
  const [playerReports, setPlayerReports] = useState<PlayerSuspicionReport[]>([]);
  const seenPlayerReportIdsRef = useRef<Set<string>>(new Set());
  const seenTokenBroadcastIdRef = useRef<string | null>(null);
  const [goldenSwarmTrigger, setGoldenSwarmTrigger] = useState<{ id: string; count: number } | null>(
    null
  );
  const seenGoldenSwarmIdRef = useRef<string | null>(null);
  const [allPlayersList, setAllPlayersList] = useState<LeaderboardEntry[]>([]);
  const [top3Players, setTop3Players] = useState<LeaderboardEntry[]>([]);
  const [onlinePlayersCount, setOnlinePlayersCount] = useState<number>(1);
  const [serverBroadcast, setServerBroadcast] = useState<ServerBroadcast | null>(null);

  // Schedule & Live Event state
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [offlineData, setOfflineData] = useState<{ elapsed: number; coins: number } | null>(null);
  const [notifications, setNotifications] = useState<Toast[]>([]);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Blocks local state ticks, offline calculations, and cloud writes on initial load until
  // Firebase Auth & latest Cloud Save retrieval finish!
  const [isInitialCloudHydrating, setIsInitialCloudHydrating] = useState<boolean>(true);
  const isHydratingCloudRef = useRef<boolean>(true);
  const isReconcilingCloudRef = useRef<boolean>(false);
  const offlineCheckedForUidRef = useRef<string | null>(null);
  const lastForegroundCheckAtRef = useRef<number>(0);
  const sessionTokenRef = useRef<string>('');
  const hydrateProfileRef = useRef<
    ((uid: string, username: string, notifySync?: boolean) => Promise<void>) | null
  >(null);
  const frozenIntroSessionTriggeredRef = useRef<boolean>(false);
  const marvelIntroSessionTriggeredRef = useRef<boolean>(false);
  const lastCutsceneEventIdRef = useRef<string | null>(null);
  const mondayRolloverTriggeredRef = useRef<boolean>(false);

  const prevStormStatusRef = useRef<string>('pre_countdown');
  const prevWaveIndexRef = useRef<number>(-1);

  const activeUid = state.cloudAccount?.uid || null;
  const activeUsername =
    state.cloudAccount?.displayUsername || state.cloudAccount?.username || null;
  const verifiedDevSandbox = isVerifiedLiveDevSession(activeUid) && sandboxS2Enabled;
  const verifiedDevSandboxS3 = isVerifiedLiveDevSession(activeUid) && sandboxS3Enabled;
  const seasonInfo = getEffectiveSeasonInfo(
    activeUid,
    verifiedDevSandbox,
    nowMs,
    verifiedDevSandboxS3
  );
  const isSandbox = seasonInfo.isSandbox;
  const isS3Active = Boolean(seasonInfo.isMarvelActive);
  const isS2Active = seasonInfo.isFrozenApocalypseActive || isS3Active;
  const seasonLabel = isS3Active
    ? `Season #${seasonInfo.seasonNumber}: Marvel${isSandbox ? ' (PREVIEW)' : ''}`
    : isS2Active
    ? `Season #${seasonInfo.seasonNumber}: Frozen Apocalypse${isSandbox ? ' (PREVIEW)' : ''}`
    : `Season #${seasonInfo.seasonNumber}`;
  const seasonRemainingSec = Math.max(0, Math.floor(seasonInfo.remainingMs / 1000));

  const fridayBonus = isFridayBonusActive(nowMs) || (isSandbox && sandboxStormStartMs !== null);
  const stormState = evaluateMatthewStormState(
    nowMs,
    isSandbox ? sandboxStormStartMs : null,
    seasonInfo
  );
  const isStormActive = stormState.status === 'active';
  const stormWaveMultiplier = isStormActive
    ? stormState.currentWave
      ? stormState.currentWave.multiplier
      : MATTHEW_STORM_CONFIG.baseStormMultiplier
    : 1;

  const serverNowMs = getServerNowMs();
  const equippedCursor = getCursorById(state.equippedCursorId);
  const isTargetedByActiveEvent = activeGlobalEvent?.targetUid
    ? activeGlobalEvent.targetUid === state.cloudAccount?.uid
    : !activeGlobalEvent?.excludeSummoner ||
      activeGlobalEvent?.summonedByUid !== state.cloudAccount?.uid;
  const isScreenFrozen = Boolean(
    isS2Active &&
      !equippedCursor?.freezeImmune &&
      activeGlobalEvent &&
      activeGlobalEvent.type === 'screen_freeze' &&
      activeGlobalEvent.endsAtMs > serverNowMs &&
      isTargetedByActiveEvent
  );

  const handleNotify = (title: string, subtitle: string) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev.slice(-4), { id, title, subtitle }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3500);
  };

  const applyLocalBanReset = (ban: BanRecord) => {
    // Score-preserving ban: lock gameplay & hide from leaderboard without erasing saved progress
    // so an admin unban restores the player's rank intact.
    setActiveBanRecord(ban);
    setOfflineData(null);
  };

  const handleCheatProbationDetected = async ({ reason, cps }: { reason: string; cps: number }) => {
    const curr = stateRef.current;
    const uid = curr.cloudAccount?.uid || `local_${curr.cloudAccount?.username || 'player'}`;
    const username =
      curr.cloudAccount?.displayUsername || curr.cloudAccount?.username || 'Player';
    const eff = getEffectiveSeasonInfo(
      curr.cloudAccount?.uid,
      sandboxS2EnabledRef.current && isVerifiedLiveDevSession(curr.cloudAccount?.uid),
      Date.now(),
      sandboxS3EnabledRef.current && isVerifiedLiveDevSession(curr.cloudAccount?.uid)
    );

    setIsProbationActive(true);
    handleNotify(
      'AUTO CLICKER DETECTED',
      'You have been detected using an auto clicker. Your gameplay is paused for dev review.'
    );
    await reportAccountProbation(uid, username, cps, reason, eff.seasonId, eff.isSandbox);
    if (isVerifiedLiveDevSession(curr.cloudAccount?.uid)) {
      const latest = await fetchProbationAlerts(eff.seasonId, eff.isSandbox).catch(() => []);
      setProbationAlerts(latest);
    }
  };

  const handleAutoBan50CpsDetected = async (cps: number) => {
    const curr = stateRef.current;
    const uid = curr.cloudAccount?.uid || `local_${curr.cloudAccount?.username || 'player'}`;
    const username =
      curr.cloudAccount?.displayUsername || curr.cloudAccount?.username || 'Player';
    if (isVerifiedLiveDevSession(curr.cloudAccount?.uid)) return;
    const eff = getEffectiveSeasonInfo(curr.cloudAccount?.uid, false, Date.now());
    const [banRec] = await Promise.all([
      enforceAutoBan50Cps(uid, username, cps, eff.seasonId, eff.isSandbox),
      reportAccountProbation(
        uid,
        username,
        cps,
        `Auto-banned at ${Math.round(cps)} CPS (>= 50 CPS cutoff)`,
        eff.seasonId,
        eff.isSandbox
      ).catch(() => null),
    ]);
    if (banRec) {
      applyLocalBanReset(banRec);
    }
  };

  const refreshMiniLeaderboard = async () => {
    try {
      const currUid = stateRef.current.cloudAccount?.uid || null;
      const eff = getEffectiveSeasonInfo(
        currUid,
        sandboxS2Enabled && isVerifiedLiveDevSession(currUid),
        Date.now(),
        sandboxS3Enabled && isVerifiedLiveDevSession(currUid)
      );
      const entries = await fetchWorldwideLeaderboard(eff.seasonId, 500, eff.isSandbox);
      setAllPlayersList(entries);
      setTop3Players(entries.slice(0, 3));
      const onlineNow = entries.filter((e) => isLeaderboardPlayerOnline(e, currUid)).length;
      setOnlinePlayersCount(Math.max(currUid ? 1 : 0, onlineNow));
      setServerBroadcast(getCachedServerBroadcast());
    } catch {
      // ignore transient error
    }
  };

  // Poll cloud bans, probation alerts, single-device session lock & Top 3 Mini Leaderboard every 30s (skipped when tab hidden)
  useEffect(() => {
    const checkBanAndLeaderboard = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const curr = stateRef.current;
      const uid = curr.cloudAccount?.uid || null;
      const username =
        curr.cloudAccount?.displayUsername || curr.cloudAccount?.username || null;
      const eff = getEffectiveSeasonInfo(
        uid,
        sandboxS2Enabled && isVerifiedLiveDevSession(uid),
        Date.now(),
        sandboxS3Enabled && isVerifiedLiveDevSession(uid)
      );

      const ban = await checkAccountBanStatus(uid, username, false);
      if (ban) {
        applyLocalBanReset(ban);
      } else {
        setActiveBanRecord(null);
      }

      if (uid && !ban) {
        const prob = await syncOwnProbationStatus(uid, username).catch(() => false);
        setIsProbationActive(prob);
      } else {
        setIsProbationActive(false);
      }

      if (isVerifiedLiveDevSession(uid)) {
        const [alerts, peerReports] = await Promise.all([
          fetchProbationAlerts(eff.seasonId, eff.isSandbox).catch(() => []),
          fetchPlayerSuspicionReports().catch(() => []),
        ]);
        setProbationAlerts(alerts);
        for (const alert of alerts) {
          const key = `${alert.uid}:${alert.reportedAtMs}`;
          if (!seenProbationKeysRef.current.has(key)) {
            seenProbationKeysRef.current.add(key);
            handleNotify(
              'CHEAT PROBATION ALERT!',
              `${alert.username} flagged (${alert.detectedCps} CPS) — review in Dev Tools!`
            );
          }
        }
        setPlayerReports(peerReports);
        for (const rep of peerReports) {
          if (!seenPlayerReportIdsRef.current.has(rep.id)) {
            seenPlayerReportIdsRef.current.add(rep.id);
            handleNotify(
              'PLAYER REPORT',
              `${rep.reporterUsername} reported ${rep.targetUsername} (Peak ${rep.targetHighestCps} CPS)`
            );
          }
        }
      }

      if (uid && !ban && sessionTokenRef.current) {
        const res = await verifySingleDeviceSession(uid, sessionTokenRef.current, eff.isSandbox);
        if (!res.valid) {
          setSessionLockedByOtherDevice(true);
        }
      }

      setServerBroadcast(getCachedServerBroadcast());
      await refreshMiniLeaderboard();
    };

    checkBanAndLeaderboard();
    const interval = setInterval(checkBanAndLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [state.cloudAccount?.uid, state.cloudAccount?.displayUsername, sandboxS2Enabled, sandboxS3Enabled]);

  // At Monday midnight Season 2 launch, exit any active dev sandbox preview and reset to fresh Season 2
  useEffect(() => {
    if (nowMs < SEASON_2_CONFIG.launchTimeMs) return;
    if (mondayRolloverTriggeredRef.current) return;
    if (
      sandboxS3Enabled ||
      state.currentSeasonId === 'season_3' ||
      isS3Active ||
      seasonInfo.isDowntime
    ) {
      return;
    }
    if (!sandboxS2Enabled && state.currentSeasonId === 'season_2') return;
    mondayRolloverTriggeredRef.current = true;

    sandboxS2EnabledRef.current = false;
    setSandboxS2Enabled(false);
    if (nowMs >= SEASON_3_CONFIG.launchTimeMs) {
      sandboxS3EnabledRef.current = false;
      setSandboxS3Enabled(false);
    }
    setSandboxStormStartMs(null);
    setPreviewDowntimeOverride(false);

    const liveBase = loadGame();
    const currAcc = stateRef.current.cloudAccount;
    const rollToLiveSeason2 = async () => {
      const placement = currAcc?.uid
        ? await checkSeason1PlacementRewards(currAcc.uid, currAcc.displayUsername)
        : { isChampion: false, isTop10: false, rank: null };
      const rolled = performSeasonalRollover(
        liveBase,
        'season_2',
        placement.isChampion,
        placement.isTop10
      );
      const nextState: GameState = {
        ...rolled,
        sandboxS2Enabled: false,
        cloudAccount: currAcc,
      };
      saveGame(nextState);
      setState(nextState);
      if (currAcc?.uid) {
        saveStateToCloud(currAcc.uid, currAcc.displayUsername, nextState, true).catch(() => {});
      }
      handleNotify('SEASON 2 LIVE!', 'Frozen Apocalypse has officially launched!');
    };
    rollToLiveSeason2();
  }, [nowMs, sandboxS2Enabled, state.currentSeasonId]);

  // Disable right-click context menu globally so fast trackpad clicking never opens a browser menu
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', preventContextMenu);
    return () => window.removeEventListener('contextmenu', preventContextMenu);
  }, []);

  // ESC Key Listener: Opens/closes the Full In-Game Menu Screen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showIntroCutscene || activeBanRecord) return;
      e.preventDefault();

      if (showDevToolsModal) {
        setShowDevToolsModal(false);
        return;
      }
      if (showItemShopModal) {
        setShowItemShopModal(false);
        return;
      }
      if (showLiveEventsModal) {
        setShowLiveEventsModal(false);
        return;
      }
      if (showSkinQualityModal) {
        setShowSkinQualityModal(false);
        return;
      }
      if (showLeaderboardModal) {
        setShowLeaderboardModal(false);
        return;
      }
      if (showStormShop) {
        setShowStormShop(false);
        return;
      }
      setShowEscMenu((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showIntroCutscene,
    activeBanRecord,
    showDevToolsModal,
    showItemShopModal,
    showLiveEventsModal,
    showSkinQualityModal,
    showLeaderboardModal,
    showStormShop,
  ]);

  // 1-second schedule ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Always play season-appropriate music: S2/S3 Event Synth during events, Winter/Marvel or Chill in S1
  useEffect(() => {
    if (
      showIntroCutscene ||
      showFrozenIntro ||
      showMarvelIntro ||
      Boolean(pendingSnapCutscene) ||
      pendingEventCutscene ||
      showTokenCutscene ||
      chestCutsceneLoot ||
      crateCutsceneResult
    ) {
      return;
    }
    const isStormMusic =
      stormState.status === 'active' || stormState.status === 'fullscreen_10s_countdown';
    const isGlobalLiveEventActive = Boolean(
      activeGlobalEvent && activeGlobalEvent.endsAtMs > getServerNowMs()
    );
    if (seasonInfo.isDowntime) {
      soundManager.setMusicTrack('s3_downtime');
    } else if (isS3Active) {
      soundManager.setMusicTrack(
        isStormMusic || isGlobalLiveEventActive ? 's3_event' : 's3_marvel'
      );
    } else if (isS2Active) {
      soundManager.setMusicTrack(
        isStormMusic || isGlobalLiveEventActive ? 's2_event' : 's2_winter'
      );
    } else {
      soundManager.setMusicTrack(isStormMusic ? 'storm' : 'chill');
    }
  }, [
    seasonInfo.isDowntime,
    isS3Active,
    isS2Active,
    stormState.status,
    activeGlobalEvent,
    showIntroCutscene,
    showFrozenIntro,
    showMarvelIntro,
    pendingSnapCutscene,
    pendingEventCutscene,
    showTokenCutscene,
    chestCutsceneLoot,
    crateCutsceneResult,
  ]);

  // Mandatory Sign-In: Must sign in BEFORE loading screen, downtime preview, or one-time cutscene
  useEffect(() => {
    if (
      !isInitialCloudHydrating &&
      !activeBanRecord &&
      !state.cloudAccount &&
      !showAccountModal &&
      !showEscMenu
    ) {
      setShowAccountModal(true);
    }
  }, [
    isInitialCloudHydrating,
    activeBanRecord,
    state.cloudAccount,
    showAccountModal,
    showEscMenu,
  ]);

  // Detect Matthew Storm wave transitions and event completion
  useEffect(() => {
    const prevStatus = prevStormStatusRef.current;
    const currStatus = stormState.status;

    if (prevStatus !== 'active' && currStatus === 'active') {
      soundManager.playThunder();
      particleEngine.emitMatthewRain(
        40,
        stateRef.current.unlockedSkins.map((id) => getSkinById(id).image)
      );
      handleNotify(
        '⚡ MATTHEW STORM IS LIVE! ⚡',
        'All-Day Friday 4× Click & CPS Multiplier + Secret Storm Vault unlocked!'
      );
      if (isS2Active && !showIntroCutscene && !showFrozenIntro) {
        const stormId = `storm_${sandboxStormStartMs ?? 'friday'}_${new Date(nowMs).toISOString().slice(0, 10)}`;
        if (lastCutsceneEventIdRef.current !== stormId) {
          lastCutsceneEventIdRef.current = stormId;
          setPendingEventCutscene({ id: stormId, kind: 'storm' });
        }
      }
    }

    if (prevStatus === 'active' && currStatus === 'ended') {
      setShowStormShop(false);
      setShowStormRecap(true);
    }

    prevStormStatusRef.current = currStatus;

    const currWaveIdx = stormState.currentWave ? stormState.currentWave.waveIndex : -1;
    if (currStatus === 'active' && currWaveIdx !== -1 && currWaveIdx !== prevWaveIndexRef.current) {
      soundManager.playStormWaveStart();
      particleEngine.emitMatthewRain(
        35,
        stateRef.current.unlockedSkins.map((id) => getSkinById(id).image)
      );
      handleNotify(
        `⚡ STORM WAVE #${currWaveIdx} (${stormState.currentWave?.multiplier}×)!`,
        'Giant Matthew spawned!'
      );
    }
    prevWaveIndexRef.current = currWaveIdx;
  }, [stormState.status, stormState.currentWave]);

  // Step 0: On page load (BEFORE gameplay ticks, offline calculations, or cloud saves run),
  // wait for Firebase Auth & retrieve the most recent cloud save for this player.
  useEffect(() => {
    let cancelled = false;

    const finishHydration = () => {
      if (cancelled) return;
      isHydratingCloudRef.current = false;
      setIsInitialCloudHydrating(false);
    };

    const hydrateProfileFromCloud = async (uid: string, username: string, notifySync = false) => {
      if (cancelled) return;
      isReconcilingCloudRef.current = true;
      try {
        const isMondayLaunched = Date.now() >= SEASON_2_CONFIG.launchTimeMs;
        if (isMondayLaunched && sandboxS2EnabledRef.current) {
          sandboxS2EnabledRef.current = false;
          setSandboxS2Enabled(false);
        }
        const eff = getEffectiveSeasonInfo(
          uid,
          sandboxS2EnabledRef.current && isVerifiedLiveDevSession(uid),
          Date.now(),
          sandboxS3EnabledRef.current && isVerifiedLiveDevSession(uid)
        );
        const targetSandbox = eff.isSandbox;

        const ban = await checkAccountBanStatus(uid, username, true);
        if (ban) {
          applyLocalBanReset(ban);
          return;
        }

        const claimedToken = await claimSingleDeviceSession(uid, targetSandbox).catch(() => '');
        if (claimedToken) sessionTokenRef.current = claimedToken;
        setSessionLockedByOtherDevice(false);
        syncServerClockOffset(uid).catch(() => {});

        const liveInSandbox =
          targetSandbox &&
          (stateRef.current.sandboxS2Enabled ||
            stateRef.current.sandboxS3Enabled ||
            stateRef.current.currentSeasonId === 'season_2' ||
            stateRef.current.currentSeasonId === 'season_3');
        const baseLocalState = targetSandbox
          ? {
              ...(liveInSandbox ? stateRef.current : loadSandboxGame()),
              sandboxS2Enabled: Boolean(sandboxS2EnabledRef.current || stateRef.current.sandboxS2Enabled),
              sandboxS3Enabled: Boolean(sandboxS3EnabledRef.current || stateRef.current.sandboxS3Enabled),
            }
          : stateRef.current;

        const season1Ended = Date.now() >= SEASON_CONFIG.epochStartMs + SEASON_CONFIG.activePlayDurationMs;
        const [merged, s1Placement] = await Promise.all([
          loadAndReconcileCloudSave(uid, username, baseLocalState),
          season1Ended
            ? checkSeason1PlacementRewards(uid, username)
            : Promise.resolve({ isChampion: false, isTop10: false, rank: null }),
        ]);
        if (cancelled) return;

        // Calculate offline earnings once using the retrieved cloud save (never stale localStorage)
        if (offlineCheckedForUidRef.current !== uid) {
          offlineCheckedForUidRef.current = uid;
          const nowSec = Math.floor(Date.now() / 1000);
          const { elapsedSeconds, coinsEarned } = calculateOfflineEarnings(
            merged,
            nowSec,
            eff.seasonId
          );
          if (elapsedSeconds > 15 && coinsEarned > 0 && merged.coins > 0) {
            setOfflineData({ elapsed: elapsedSeconds, coins: coinsEarned });
          } else {
            setOfflineData(null);
          }
        }

        let grantedNewS1Reward = false;
        setState((prev) => {
          const prevInSandbox =
            targetSandbox &&
            (prev.sandboxS2Enabled ||
              prev.sandboxS3Enabled ||
              prev.currentSeasonId === 'season_2' ||
              prev.currentSeasonId === 'season_3');
          const sourceBase = targetSandbox
            ? prevInSandbox
              ? prev
              : loadSandboxGame()
            : prev;
          const { state: checkedPrev } = performBetaWipeIfDue(sourceBase, Date.now());
          const sameOwner = !checkedPrev.lastOwnerUid || checkedPrev.lastOwnerUid === uid;
          const resolvedSandboxFlag = Boolean(
            targetSandbox &&
              (sandboxS2EnabledRef.current || merged.sandboxS2Enabled || checkedPrev.sandboxS2Enabled)
          );
          const canKeepChampion =
            s1Placement.isChampion ||
            username.trim().toLowerCase() === 'liamkd3' ||
            (Array.isArray(merged.winnerBadges) &&
              merged.winnerBadges.some((b) => b.seasonNumber >= 2));
          const stripPreLaunchS2 =
            !targetSandbox && Date.now() < SEASON_2_CONFIG.launchTimeMs;
          const rawCombinedSkins = sameOwner
            ? Array.from(new Set([...checkedPrev.unlockedSkins, ...merged.unlockedSkins]))
            : merged.unlockedSkins;
          const baseSkins = rawCombinedSkins.filter(
            (id) =>
              (id !== 'champion_matthew' || canKeepChampion) &&
              (!stripPreLaunchS2 || !isSeason2OnlySkinId(id))
          );
          if (
            (sameOwner && checkedPrev.unlockedSkins.includes('champion_matthew') && !canKeepChampion) ||
            (stripPreLaunchS2 && rawCombinedSkins.some((id) => isSeason2OnlySkinId(id)))
          ) {
            grantedNewS1Reward = true;
          }

          const bonusSkins: string[] = [];
          if (s1Placement.isChampion && !baseSkins.includes('champion_matthew')) {
            bonusSkins.push('champion_matthew');
            grantedNewS1Reward = true;
          }
          if ((s1Placement.isTop10 || s1Placement.isChampion) && !baseSkins.includes('liam_matthew')) {
            bonusSkins.push('liam_matthew');
            grantedNewS1Reward = true;
          }
          const finalSkins = bonusSkins.length > 0 ? [...baseSkins, ...bonusSkins] : baseSkins;

          const nextBadges = Array.isArray(merged.winnerBadges)
            ? merged.winnerBadges.filter((b) => b.seasonNumber !== 1 || canKeepChampion)
            : [];
          if (s1Placement.isChampion && !nextBadges.some((b) => b.seasonNumber === 1)) {
            nextBadges.push({
              seasonNumber: 1,
              label: 'Season 1 Winner',
              awardedAt: Date.now(),
            });
            grantedNewS1Reward = true;
          }

          const nextEquippedSkin =
            (!canKeepChampion && merged.equippedSkin === 'champion_matthew') ||
            (stripPreLaunchS2 && isSeason2OnlySkinId(merged.equippedSkin)) ||
            !finalSkins.includes(merged.equippedSkin)
              ? 'classic_matthew'
              : merged.equippedSkin;

          const next: GameState = {
            ...merged,
            equippedSkin: nextEquippedSkin,
            currentSeasonId: eff.seasonId,
            sandboxS2Enabled: resolvedSandboxFlag,
            sandboxS3Enabled: Boolean(
              eff.isMarvelActive && eff.isSandbox && sandboxS3EnabledRef.current
            ),
            activeSessionToken: sessionTokenRef.current || merged.activeSessionToken,
            season2IntroSeen: Boolean(
              checkedPrev.season2IntroSeen ||
                merged.season2IntroSeen ||
                frozenIntroSessionTriggeredRef.current
            ),
            season3IntroSeen: Boolean(
              checkedPrev.season3IntroSeen ||
                merged.season3IntroSeen ||
                marvelIntroSessionTriggeredRef.current
            ),
            unlockedSkins: finalSkins,
            winnerBadges: nextBadges,
            lastOwnerUid: uid,
            lastSaveTime: Date.now(),
            cloudAccount: {
              uid,
              username,
              displayUsername: username,
              lastCloudSync: Date.now(),
            },
          };
          saveGame(next, true);
          return next;
        });

        if (grantedNewS1Reward) {
          saveStateToCloud(uid, username, stateRef.current, true).catch(() => {});
          if (s1Placement.isChampion) {
            handleNotify(
              'SEASON 1 CHAMPION!',
              'Unlocked World Champion Matthew & Liam Top 10 skin!'
            );
          } else if (s1Placement.isTop10) {
            handleNotify(
              `SEASON 1 #${s1Placement.rank} FINALIST!`,
              'Unlocked the exclusive Season 1 Top 10 Liam skin!'
            );
          }
        }

        if (notifySync) {
          handleNotify('CLOUD SAVE SYNCED!', 'Loaded newer progress from your other device!');
        }
        refreshMiniLeaderboard();
      } finally {
        isReconcilingCloudRef.current = false;
        finishHydration();
      }
    };
    hydrateProfileRef.current = hydrateProfileFromCloud;

    const unsubscribe = subscribeToAuthChanges(async (profile) => {
      if (!profile) return;
      await hydrateProfileFromCloud(profile.uid, profile.username, false);
    });

    // Ensure initial hydration always resolves even if the player is a guest / signed out
    const waitForInitialAuth = async () => {
      try {
        const { auth } = getFirebaseServices();
        if (auth && typeof auth.authStateReady === 'function') {
          await Promise.race([
            auth.authStateReady(),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);
        }

        if (cancelled) return;

        const { auth: resolvedAuth } = getFirebaseServices();
        const currentUser = resolvedAuth?.currentUser;

        if (currentUser) {
          const fallbackName =
            currentUser.displayName ||
            (currentUser.email ? currentUser.email.split('@')[0] : 'player');
          const uid = currentUser.uid;
          if (!hasCompletedInitialCloudPull(uid) && !isReconcilingCloudRef.current) {
            await hydrateProfileFromCloud(uid, fallbackName, false);
          } else {
            finishHydration();
          }
          return;
        }

        // Not signed into Firebase Auth: check if local guest offline earnings apply
        const curr = stateRef.current;
        if (!curr.cloudAccount) {
          const nowSec = Math.floor(Date.now() / 1000);
          const { elapsedSeconds, coinsEarned } = calculateOfflineEarnings(
            curr,
            nowSec,
            getActiveSeason().seasonId
          );
          if (elapsedSeconds > 15 && coinsEarned > 0 && curr.coins > 0) {
            setOfflineData({ elapsed: elapsedSeconds, coins: coinsEarned });
          }
        }
        finishHydration();
      } catch {
        finishHydration();
      }
    };

    waitForInitialAuth();

    // Register foreign-device conflict handler + tab wake-up sync so switching back to an open tab
    // pulls newer cloud data instead of overwriting it!
    const pullIfAnotherDeviceUpdated = async (forceCheck = false) => {
      const curr = stateRef.current;
      if (
        cancelled ||
        !curr.cloudAccount?.uid ||
        isHydratingCloudRef.current ||
        isReconcilingCloudRef.current ||
        isGameplayPausedRef.current
      ) {
        return;
      }
      const now = Date.now();
      if (!forceCheck && now - lastForegroundCheckAtRef.current < 8000) return;
      lastForegroundCheckAtRef.current = now;

      const currUser = curr.cloudAccount.displayUsername || curr.cloudAccount.username || null;
      const eff = getEffectiveSeasonInfo(
        curr.cloudAccount.uid,
        sandboxS2EnabledRef.current && isVerifiedLiveDevSession(curr.cloudAccount.uid),
        now,
        sandboxS3EnabledRef.current && isVerifiedLiveDevSession(curr.cloudAccount.uid)
      );
      const foreignNewer = await hasForeignDeviceSavedMoreRecently(
        curr.cloudAccount.uid,
        eff.isSandbox
      );
      if (foreignNewer) {
        if (sessionTokenRef.current) {
          const sessionRes = await verifySingleDeviceSession(
            curr.cloudAccount.uid,
            sessionTokenRef.current,
            eff.isSandbox
          );
          if (!sessionRes.valid) {
            setSessionLockedByOtherDevice(true);
            return;
          }
        }
        await hydrateProfileFromCloud(
          curr.cloudAccount.uid,
          curr.cloudAccount.displayUsername,
          true
        );
      }
    };

    registerForeignCloudUpdateHandler((uid) => {
      if (stateRef.current.cloudAccount?.uid === uid) {
        setSessionLockedByOtherDevice(true);
      }
    });

    const onWindowFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        pullIfAnotherDeviceUpdated(false).catch(() => {});
      }
    };
    window.addEventListener('focus', onWindowFocusOrVisible);
    document.addEventListener('visibilitychange', onWindowFocusOrVisible);

    return () => {
      cancelled = true;
      unsubscribe();
      registerForeignCloudUpdateHandler(null);
      window.removeEventListener('focus', onWindowFocusOrVisible);
      document.removeEventListener('visibilitychange', onWindowFocusOrVisible);
    };
  }, []);

  // Lightweight 10-second single-device session verification while tab is visible
  useEffect(() => {
    const uid = state.cloudAccount?.uid;
    if (!uid || activeBanRecord || sessionLockedByOtherDevice) return;
    const id = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (!sessionTokenRef.current || isHydratingCloudRef.current || isReconcilingCloudRef.current) return;
      const eff = getEffectiveSeasonInfo(
        uid,
        sandboxS2EnabledRef.current && isVerifiedLiveDevSession(uid),
        Date.now(),
        sandboxS3EnabledRef.current && isVerifiedLiveDevSession(uid)
      );
      const res = await verifySingleDeviceSession(uid, sessionTokenRef.current, eff.isSandbox);
      if (!res.valid) {
        setSessionLockedByOtherDevice(true);
      }
    }, 10000);
    return () => clearInterval(id);
  }, [state.cloudAccount?.uid, activeBanRecord, sessionLockedByOtherDevice]);

  // Fast 20-second Realtime Database Profile + Leaderboard sync while playing, plus keepalive flush on close/background
  useEffect(() => {
    const syncProfileAndLeaderboard = () => {
      if (
        isHydratingCloudRef.current ||
        isReconcilingCloudRef.current ||
        activeBanRecord ||
        sessionLockedByOtherDevice ||
        (typeof document !== 'undefined' && document.visibilityState === 'hidden')
      ) {
        return;
      }
      const curr = stateRef.current;
      if (!curr.cloudAccount) return;
      saveStateToCloud(
        curr.cloudAccount.uid,
        curr.cloudAccount.displayUsername,
        curr,
        false
      ).catch(() => {});
    };

    const syncInterval = setInterval(syncProfileAndLeaderboard, 20000);

    const flushOnHideOrUnload = () => {
      if (
        isHydratingCloudRef.current ||
        isReconcilingCloudRef.current ||
        activeBanRecord ||
        sessionLockedByOtherDevice
      ) {
        return;
      }
      const curr = stateRef.current;
      saveGame(curr);
      if (curr.cloudAccount) {
        saveStateToCloudKeepalive(
          curr.cloudAccount.uid,
          curr.cloudAccount.displayUsername,
          curr
        );
      }
    };

    const onVisibilityHide = () => {
      if (document.visibilityState === 'hidden') {
        flushOnHideOrUnload();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityHide);
    window.addEventListener('pagehide', flushOnHideOrUnload);
    window.addEventListener('beforeunload', flushOnHideOrUnload);
    return () => {
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', onVisibilityHide);
      window.removeEventListener('pagehide', flushOnHideOrUnload);
      window.removeEventListener('beforeunload', flushOnHideOrUnload);
    };
  }, [activeBanRecord]);

  // Keyboard Easter Egg ("rain" — ignored when typing in inputs)
  useEffect(() => {
    let buffer = '';
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key.length === 1) {
        buffer = (buffer + e.key.toLowerCase()).slice(-10);
        if (buffer.endsWith('rain')) {
          particleEngine.emitMatthewRain(
            45,
            stateRef.current.unlockedSkins.map((id) => getSkinById(id).image)
          );
          soundManager.playSkinUnlock();
          handleNotify('EASTER EGG: MATTHEW RAIN!', 'Raining your unlocked Matthews!');
          buffer = '';
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleClaimOffline = () => {
    if (offlineData && !activeBanRecord) {
      setState((prev) => {
        const next: GameState = {
          ...prev,
          coins: prev.coins + offlineData.coins,
          lifetimeCoins: prev.lifetimeCoins + offlineData.coins,
          seasonalScore: prev.seasonalScore + offlineData.coins,
          lastSaveTime: Date.now(),
          lastActiveInputTimestamp: Date.now(),
        };
        saveGame(next);
        if (next.cloudAccount) {
          saveStateToCloud(
            next.cloudAccount.uid,
            next.cloudAccount.displayUsername,
            next,
            true
          ).catch(() => {});
        }
        return next;
      });
      setOfflineData(null);
    }
  };

  const isGameplayPaused =
    seasonInfo.isDowntime ||
    isInitialCloudHydrating ||
    Boolean(activeBanRecord) ||
    isProbationActive ||
    sessionLockedByOtherDevice ||
    showIntroCutscene ||
    showFrozenIntro ||
    showMarvelIntro ||
    showThanosReset ||
    Boolean(pendingSnapCutscene) ||
    Boolean(pendingEventCutscene) ||
    Boolean(chestCutsceneLoot) ||
    Boolean(crateCutsceneResult) ||
    showTokenCutscene ||
    Boolean(offlineData);
  isGameplayPausedRef.current = isGameplayPaused;

  useGameLoop({
    state,
    setState,
    onNotify: (title, subtitle) => handleNotify(title, subtitle),
    liveContext: {
      fridayBonusActive: fridayBonus,
      stormWaveMultiplier,
      isStormActive,
    },
    enabled: !isGameplayPaused && !isScreenFrozen,
  });

  // Season 3 Periodic Thanos Coin-Reset Event (every 5-10 minutes)
  useEffect(() => {
    if (!isS3Active || isGameplayPaused) return;
    const delayMs = 300_000 + Math.floor(Math.random() * 300_000);
    const timer = window.setTimeout(() => {
      setShowThanosReset(true);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [isS3Active, isGameplayPaused]);

  // Trigger 3D widescreen cutscene ONLY for necessary events (Time Freeze)
  useEffect(() => {
    if (
      seasonInfo.isDowntime ||
      showIntroCutscene ||
      showFrozenIntro ||
      showMarvelIntro ||
      Boolean(pendingSnapCutscene) ||
      activeBanRecord ||
      !activeGlobalEvent ||
      activeGlobalEvent.endsAtMs <= getServerNowMs()
    ) {
      return;
    }
    if (
      activeGlobalEvent.type === 'screen_freeze' &&
      lastCutsceneEventIdRef.current !== activeGlobalEvent.id
    ) {
      lastCutsceneEventIdRef.current = activeGlobalEvent.id;
      setPendingEventCutscene({
        id: activeGlobalEvent.id,
        kind: activeGlobalEvent.type,
        summonedBy: activeGlobalEvent.summonedByUsername,
      });
    }
  }, [
    seasonInfo.isDowntime,
    activeGlobalEvent,
    nowMs,
    showIntroCutscene,
    showFrozenIntro,
    showMarvelIntro,
    pendingSnapCutscene,
    activeBanRecord,
  ]);

  // Sub-second real-time stream + fast fallback sync for global events, Golden Swarms & Infinity Snaps (live + next-login victims)
  useEffect(() => {
    if (seasonInfo.isDowntime || isInitialCloudHydrating || activeBanRecord) {
      setActiveGlobalEvent(null);
      return;
    }

    const unsubscribe = subscribeToGlobalEventsRealtime(isSandbox, (snap) => {
      setEvStoreSnapshot(snap.store);

      const latest = activeGlobalEventRef.current;
      if (!(latest && latest.id.startsWith('preview_') && latest.endsAtMs > Date.now())) {
        setActiveGlobalEvent((prev) => {
          if (prev?.id === snap.activeEvent?.id && prev?.endsAtMs === snap.activeEvent?.endsAtMs) {
            return prev;
          }
          return snap.activeEvent;
        });
      }

      const currUid = stateRef.current.cloudAccount?.uid || '';
      const lastSnapProcessed = stateRef.current.lastProcessedSnapId || null;
      const pendingSnap = extractLatestPendingSnapFromStore(
        snap.store,
        currUid,
        lastSnapProcessed,
        isSandbox,
        getServerNowMs()
      );
      if (pendingSnap) {
        setPendingSnapCutscene((existing) =>
          existing?.snap.snapId === pendingSnap.snapId
            ? existing
            : { snap: pendingSnap, isPreview: false }
        );
      }

      if (snap.latestSwarm && seenGoldenSwarmIdRef.current !== snap.latestSwarm.id) {
        seenGoldenSwarmIdRef.current = snap.latestSwarm.id;
        setGoldenSwarmTrigger({
          id: snap.latestSwarm.id,
          count: snap.latestSwarm.count || 18,
        });
        handleNotify('🌟 FLYING GOLDEN MATTHEWS!', snap.latestSwarm.message);
      }
    });

    const pollTokens = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const tokenBroadcast = await fetchLatestMatthewTokenBroadcast(isSandbox).catch(() => null);
      if (
        tokenBroadcast &&
        seenTokenBroadcastIdRef.current !== tokenBroadcast.id &&
        tokenBroadcast.uid !== (stateRef.current.cloudAccount?.uid || '')
      ) {
        seenTokenBroadcastIdRef.current = tokenBroadcast.id;
        soundManager.playSkinUnlock();
        particleEngine.emitMatthewRain(
          22,
          stateRef.current.unlockedSkins.map((id) => getSkinById(id).image)
        );
        handleNotify('MATTHEW SHOP TOKEN PULLED!', tokenBroadcast.message);
      }
    };
    pollTokens();
    const tokenTimer = setInterval(pollTokens, 4000);

    return () => {
      unsubscribe();
      clearInterval(tokenTimer);
    };
  }, [seasonInfo.isDowntime, isSandbox, isInitialCloudHydrating, activeBanRecord]);

  // Season 2: Trigger animated Frozen Apocalypse launch cutscene ONCE on first entry
  useEffect(() => {
    if (
      !frozenIntroSessionTriggeredRef.current &&
      isS2Active &&
      !isS3Active &&
      !isInitialCloudHydrating &&
      !showIntroCutscene &&
      !activeBanRecord &&
      !state.season2IntroSeen
    ) {
      frozenIntroSessionTriggeredRef.current = true;
      setShowFrozenIntro(true);
    }
  }, [
    isS2Active,
    isS3Active,
    isInitialCloudHydrating,
    showIntroCutscene,
    activeBanRecord,
    state.season2IntroSeen,
  ]);

  // Season 3: Trigger Marvel Multiverse intro cutscene showcasing all 50 skins ONCE on first entry
  useEffect(() => {
    if (
      !marvelIntroSessionTriggeredRef.current &&
      isS3Active &&
      !isInitialCloudHydrating &&
      !showIntroCutscene &&
      !activeBanRecord &&
      !state.season3IntroSeen
    ) {
      marvelIntroSessionTriggeredRef.current = true;
      setShowMarvelIntro(true);
    }
  }, [
    isS3Active,
    isInitialCloudHydrating,
    showIntroCutscene,
    activeBanRecord,
    state.season3IntroSeen,
  ]);

  const handleEarnCoins = (
    amount: number,
    isClick: boolean,
    isCrit: boolean,
    krillionAmount: number = 0
  ) => {
    if (seasonInfo.isDowntime || activeBanRecord) return;
    const safeAmount = clampFiniteCoinAmount(amount, MAX_SAFE_SEASON_COINS);
    const safeKr = Number.isFinite(krillionAmount) && krillionAmount > 0 ? krillionAmount : 0;

    let unlockedSkinsNow: { id: string; name: string }[] = [];
    let autoClaimedQuestsNow: { title: string; rewardGems: number; rewardCoins: number }[] = [];

    setState((prev) => {
      const nextCombo = 0;
      const carriedCoins = addCoinsWithKrillionCarry(
        prev.coins || 0,
        prev.krillionCoins || 0,
        safeAmount,
        safeKr
      );
      const carriedLifetime = addCoinsWithKrillionCarry(
        prev.lifetimeCoins || 0,
        prev.krillionLifetime || 0,
        safeAmount,
        safeKr
      );
      const carriedScore = addCoinsWithKrillionCarry(
        prev.seasonalScore || 0,
        prev.krillionSeasonalScore || 0,
        safeAmount,
        safeKr
      );
      const baseNext: GameState = {
        ...prev,
        coins: carriedCoins.coins,
        krillionCoins: carriedCoins.krillion,
        lifetimeCoins: carriedLifetime.coins,
        krillionLifetime: carriedLifetime.krillion,
        seasonalScore: carriedScore.coins,
        krillionSeasonalScore: carriedScore.krillion,
        clicks: isClick ? prev.clicks + 1 : prev.clicks,
        lifetimeAllSeasonsClicks: isClick
          ? Math.max((prev.lifetimeAllSeasonsClicks || 0) + 1, prev.clicks + 1)
          : prev.lifetimeAllSeasonsClicks,
        criticalClicks: isCrit ? prev.criticalClicks + 1 : prev.criticalClicks,
        combo: nextCombo,
        maxComboReached: prev.maxComboReached || 0,
        comboTimer: 0,
        lastActiveInputTimestamp: Date.now(),
      };

      const { state: questState, newlyClaimed } = checkAndAutoClaimQuests(baseNext);
      if (newlyClaimed.length > 0) {
        autoClaimedQuestsNow = newlyClaimed.map((q) => ({
          title: q.title,
          rewardGems: q.rewardGems,
          rewardCoins: q.rewardCoins,
        }));
      }

      const cps = calculateCPS(questState, {
        fridayBonusActive: fridayBonus,
        stormWaveMultiplier,
      });
      const unlockCheck = checkAndApplyMilestoneUnlocks(questState, cps);
      if (unlockCheck.newlyUnlocked.length > 0) {
        unlockedSkinsNow = unlockCheck.newlyUnlocked.map((s) => ({
          id: s.id,
          name: s.name,
        }));
        saveGame(unlockCheck.state);
        return unlockCheck.state;
      }

      if (newlyClaimed.length > 0) {
        saveGame(questState);
      }

      return questState;
    });

    if (autoClaimedQuestsNow.length > 0) {
      soundManager.playBuy();
      autoClaimedQuestsNow.forEach((q) => {
        handleNotify(
          '🎯 QUEST AUTO-CLAIMED!',
          `${q.title}: +${q.rewardGems} 💎 & +${formatNumber(q.rewardCoins)} MC!`
        );
      });
    }

    if (unlockedSkinsNow.length > 0) {
      soundManager.playSkinUnlock();
      particleEngine.emitPrestige();
      particleEngine.emitMatthewRain(
        18,
        stateRef.current.unlockedSkins.map((id) => getSkinById(id).image)
      );
      unlockedSkinsNow.forEach((skin) => {
        handleNotify('NEW MATTHEW UNLOCKED!', `${skin.name} equipped!`);
      });
    }
  };

  const handleEquipSkin = (skinId: string) => {
    setState((prev) => {
      const next = equipSkin(prev, skinId);
      if (next !== prev) {
        saveGame(next);
      }
      return next;
    });
  };

  const handleCompleteIntro = () => {
    setShowIntroCutscene(false);
    if (!stateRef.current.cloudAccount) {
      setShowAccountModal(true);
    }
    setState((prev) => {
      const next = { ...prev, introCutsceneSeen: true, lastActiveInputTimestamp: Date.now() };
      saveGame(next);
      return next;
    });
  };

  const handleCompleteFrozenIntro = () => {
    frozenIntroSessionTriggeredRef.current = true;
    setShowFrozenIntro(false);
    let persistedNext: GameState | null = null;
    setState((prev) => {
      const next: GameState = {
        ...prev,
        season2IntroSeen: true,
        lastSaveTime: Date.now(),
        lastActiveInputTimestamp: Date.now(),
      };
      persistedNext = next;
      saveGame(next);
      return next;
    });
    const toPush = persistedNext || { ...stateRef.current, season2IntroSeen: true };
    if (toPush.cloudAccount) {
      saveStateToCloud(
        toPush.cloudAccount.uid,
        toPush.cloudAccount.displayUsername,
        toPush,
        true
      ).catch(() => {});
    }
  };

  const handleCompleteMarvelIntro = () => {
    marvelIntroSessionTriggeredRef.current = true;
    setShowMarvelIntro(false);
    let persistedNext: GameState | null = null;
    setState((prev) => {
      const next: GameState = {
        ...prev,
        season3IntroSeen: true,
        lastSaveTime: Date.now(),
        lastActiveInputTimestamp: Date.now(),
      };
      persistedNext = next;
      saveGame(next);
      return next;
    });
    const toPush = persistedNext || { ...stateRef.current, season3IntroSeen: true };
    if (toPush.cloudAccount) {
      saveStateToCloud(
        toPush.cloudAccount.uid,
        toPush.cloudAccount.displayUsername,
        toPush,
        true
      ).catch(() => {});
    }
    handleNotify('SEASON 3: MARVEL!', '50 Marvel Matthews & the Infinity Gauntlet await!');
  };

  const handleTriggerInfinitySnap = async (explicitTargetUid?: string) => {
    const curr = stateRef.current;
    const currUid = curr.cloudAccount?.uid || 'local_player';
    const currUsername =
      curr.cloudAccount?.displayUsername || curr.cloudAccount?.username || 'Player';
    const isDev = isAuthorizedDevUid(currUid);
    if (!isDev && !hasAllInfinityStones(curr.infinityStones)) {
      handleNotify('STONES INCOMPLETE', 'Collect all 6 Infinity Stones from Chests first!');
      return;
    }

    setIsSnapBusy(true);
    try {
      const entries =
        allPlayersList.length > 0
          ? allPlayersList
          : await fetchWorldwideLeaderboard(seasonInfo.seasonId, 500, isSandbox);
      let victimUids: string[] = [];
      if (explicitTargetUid) {
        victimUids = [explicitTargetUid];
      } else {
        const candidates = entries.filter((e) => e.uid !== currUid);
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const halfCount = Math.max(1, Math.ceil(shuffled.length / 2));
        victimUids = shuffled.slice(0, halfCount).map((c) => c.uid);
      }

      if (victimUids.length === 0) {
        handleNotify('NO OTHER PLAYERS FOUND', 'No eligible opponent players found to snap.');
        return;
      }

      const snapRec = await broadcastInfinitySnap({
        uid: currUid,
        username: currUsername,
        victimUids,
        isSandbox,
        allowSelfVictimForTest: explicitTargetUid === currUid,
      });

      setState((prev) => {
        const next: GameState = {
          ...prev,
          infinityStones: [],
          lastSaveTime: Date.now(),
        };
        saveGame(next);
        if (next.cloudAccount) {
          saveStateToCloud(next.cloudAccount.uid, next.cloudAccount.displayUsername, next, true).catch(
            () => {}
          );
        }
        return next;
      });
      handleNotify(
        'INFINITY SNAP UNLEASHED!',
        `${snapRec.victimUids.length} player${snapRec.victimUids.length === 1 ? '' : 's'} turned to dust!`
      );
      refreshMiniLeaderboard();
    } finally {
      setIsSnapBusy(false);
    }
  };

  const handleToggleSandboxS2 = async () => {
    const currUid = stateRef.current.cloudAccount?.uid;
    if (!isVerifiedLiveDevSession(currUid)) return;
    if (Date.now() >= SEASON_3_CONFIG.launchTimeMs) {
      sandboxS3EnabledRef.current = false;
      setSandboxS3Enabled(false);
      sandboxS2EnabledRef.current = false;
      setSandboxS2Enabled(false);
      setPreviewDowntimeOverride(false);
      return;
    }
    if (previewDowntimeOverride) {
      setPreviewDowntimeOverride(false);
      if (sandboxS3Enabled) return;
    }
    const turningOn = !sandboxS3Enabled;
    // Save live progress before switching into Season 3 Dev Preview (leaderboards off)
    if (turningOn) {
      saveGame({ ...stateRef.current, sandboxS2Enabled: false, sandboxS3Enabled: false }, true);
    }
    sandboxS2EnabledRef.current = false;
    setSandboxS2Enabled(false);
    sandboxS3EnabledRef.current = turningOn;
    setSandboxS3Enabled(turningOn);
    if (turningOn) {
      marvelIntroSessionTriggeredRef.current = false;
      const s3Fresh = loadSandboxGame();
      if (!s3Fresh.introCutsceneSeen && !s3Fresh.season3IntroSeen) {
        setShowIntroCutscene(true);
      }
      setState((prev) => {
        const allowChamp =
          (prev.cloudAccount?.displayUsername || '').trim().toLowerCase() === 'liamkd3' ||
          (prev.winnerBadges || []).some((b) => b.seasonNumber >= 2);
        const carrySkins = Array.from(
          new Set(['classic_matthew', ...(prev.unlockedSkins || [])])
        ).filter((id) => id !== 'champion_matthew' || allowChamp);
        const carryEquipped = carrySkins.includes(prev.equippedSkin)
          ? prev.equippedSkin
          : 'classic_matthew';
        const next: GameState = {
          ...s3Fresh,
          gems: prev.gems || 0,
          lifetimeGems: prev.lifetimeGems || 0,
          unlockedSkins: carrySkins,
          equippedSkin: carryEquipped,
          winnerBadges: Array.isArray(prev.winnerBadges) ? prev.winnerBadges : [],
          permanentAchievements: Array.isArray(prev.permanentAchievements)
            ? prev.permanentAchievements
            : [],
          seasonHistory: Array.isArray(prev.seasonHistory) ? prev.seasonHistory : [],
          settings: prev.settings || s3Fresh.settings,
          currentSeasonId: 'season_3',
          sandboxS2Enabled: false,
          sandboxS3Enabled: true,
          season3IntroSeen: false,
          lastOwnerUid: prev.lastOwnerUid,
          lastSaveTime: Date.now(),
          cloudAccount: prev.cloudAccount,
        };
        return next;
      });
      handleNotify(
        'SEASON 3: MARVEL PREVIEW ON',
        'Downtime skipped for dev testing (Leaderboards isolated to Sandbox).'
      );
      setTimeout(() => refreshMiniLeaderboard(), 80);
    } else {
      const liveLocal = loadGame();
      setState((prev) => {
        const next: GameState = {
          ...liveLocal,
          sandboxS2Enabled: false,
          sandboxS3Enabled: false,
          lastSaveTime: Date.now(),
          cloudAccount: prev.cloudAccount,
        };
        saveGame(next, true);
        return next;
      });
      handleNotify('SEASON 3 PREVIEW OFF', 'Returned to Season Downtime.');
    }
  };

  const handlePreviewGlobalEvent = (spec: PlayerEventCostSpec) => {
    if (!isVerifiedLiveDevSession(stateRef.current.cloudAccount?.uid)) return;
    const now = Date.now();
    const previewEvent: ActiveGlobalLiveEvent = {
      id: `preview_${spec.type}_${now}`,
      type: spec.type,
      summonedByUid: 'preview_other_player',
      summonedByUsername: 'PreviewPlayer',
      bannerText: `PreviewPlayer summoned ${spec.label}!`,
      startedAtMs: now,
      endsAtMs: now + (spec.durationSeconds + 5) * 1000,
      durationSeconds: spec.durationSeconds,
      excludeSummoner: spec.excludeSummoner,
    };
    lastCutsceneEventIdRef.current = previewEvent.id;
    setShowDevToolsModal(false);
    setActiveGlobalEvent(previewEvent);
    setPendingEventCutscene({
      id: previewEvent.id,
      kind: previewEvent.type,
      summonedBy: previewEvent.summonedByUsername,
    });
    handleNotify('PREVIEWING EVENT', `${spec.label} (local only, 0 Gems spent)`);
  };

  const handleDevSpawnGlobalEvent = async (
    spec: PlayerEventCostSpec,
    targetUid?: string,
    targetUsername?: string
  ) => {
    const currUid = stateRef.current.cloudAccount?.uid;
    if (!isVerifiedLiveDevSession(currUid)) return;
    const username =
      stateRef.current.cloudAccount?.displayUsername ||
      stateRef.current.cloudAccount?.username ||
      'Developer';
    const res = await summonGlobalLiveEvent({
      spec,
      uid: currUid || 'dev_admin',
      username,
      isSandbox,
      broadcastToAll: true,
      excludeSummoner: spec.excludeSummoner,
      targetUid,
      targetUsername,
    });
    if (res.ok && res.event) {
      await adminPublishGlobalEvent(res.event).catch(() => false);
      lastCutsceneEventIdRef.current = '';
      setShowDevToolsModal(false);
      setActiveGlobalEvent(res.event);
      soundManager.playStormWaveStart();
      handleNotify(
        spec.kind === 'attack' ? 'VILLAIN ATTACK LAUNCHED!' : 'GLOBAL EVENT LAUNCHED!',
        targetUsername
          ? `${spec.label} targeted on ${targetUsername} (FREE)!`
          : `${spec.label} live on everyone's screen (FREE)!`
      );
    }
  };

  const handleDevStopGlobalEvent = async () => {
    const currUid = stateRef.current.cloudAccount?.uid;
    if (!isVerifiedLiveDevSession(currUid)) return;
    await Promise.all([
      clearGlobalLiveEvent(isSandbox, true, currUid || undefined),
      adminPublishGlobalEvent(null).catch(() => false),
    ]);
    setActiveGlobalEvent(null);
    setPendingEventCutscene(null);
    handleNotify('GLOBAL EVENT STOPPED', 'Cleared the active global event across all screens.');
  };

  const handleDevSpawnGoldenSwarm = async (count = 18) => {
    const currUid = stateRef.current.cloudAccount?.uid;
    if (!isVerifiedLiveDevSession(currUid)) return;
    const username =
      stateRef.current.cloudAccount?.displayUsername ||
      stateRef.current.cloudAccount?.username ||
      'Developer';
    const b = await broadcastGlobalGoldenSwarm({
      uid: currUid || 'dev_admin',
      username,
      count,
      isSandbox,
      broadcastToAll: true,
    });
    await adminPublishGoldenSwarm(b).catch(() => false);
    seenGoldenSwarmIdRef.current = b.id;
    setGoldenSwarmTrigger({ id: b.id, count: b.count });
    setShowDevToolsModal(false);
    handleNotify('🌟 GOLDEN MATTHEW SWARM!', b.message);
  };

  const handleSandboxTestAction = (action: SandboxTestAction) => {
    if (!isSandbox || !isVerifiedLiveDevSession(stateRef.current.cloudAccount?.uid)) return;

    if (action === 'toggle_sandbox_friday_storm') {
      if (sandboxStormStartMs !== null) {
        setSandboxStormStartMs(null);
        setShowStormShop(false);
        handleNotify('FRIDAY STORM STOPPED', 'Returned to calm Frozen Apocalypse.');
      } else {
        setPreviewDowntimeOverride(false);
        setSandboxStormStartMs(
          Date.now() - (MATTHEW_STORM_CONFIG.fullscreenCountdownSeconds * 1000 + 250)
        );
        handleNotify(
          'FRIDAY STORM PREVIEW ON',
          'Previewing 4× Waves + 100× Giant Matthews + Secret Vault.'
        );
      }
      return;
    }

    if (action === 'toggle_preview_midnight_downtime') {
      setShowDevToolsModal(false);
      setSandboxStormStartMs(null);
      setShowStormShop(false);
      setPreviewDowntimeOverride(true);
      setShowStormRecap(true);
      handleNotify(
        'MIDNIGHT → SEASON DOWNTIME',
        'Previewing midnight transition to Season Downtime.'
      );
      return;
    }

    if (action === 'replay_s3_intro') {
      setShowDevToolsModal(false);
      setShowMarvelIntro(true);
      handleNotify('REPLAYING S3 INTRO', 'Playing Season 3: Marvel 50-skin cutscene.');
      return;
    }

    if (action === 'replay_s2_intro') {
      setShowDevToolsModal(false);
      setShowFrozenIntro(true);
      handleNotify('REPLAYING S2 INTRO', 'Playing Season 2 launch cutscene.');
      return;
    }

    if (action === 'grant_all_stones') {
      setState((prev) => {
        const next: GameState = {
          ...prev,
          infinityStones: [...ALL_INFINITY_STONE_IDS],
          lastSaveTime: Date.now(),
        };
        saveGame(next);
        return next;
      });
      handleNotify('ALL 6 INFINITY STONES GRANTED!', 'Open the Gauntlet tab to Snap!');
      return;
    }

    if (action === 'preview_snap_dust' || action === 'test_snap_self') {
      setShowDevToolsModal(false);
      const curr = stateRef.current;
      const username =
        curr.cloudAccount?.displayUsername || curr.cloudAccount?.username || 'Thanos';
      setPendingSnapCutscene({
        snap: {
          uid: curr.cloudAccount?.uid || 'local_tester',
          snapId: `dev_snap_${Date.now()}`,
          snappedByUid: 'dev_test',
          snappedByUsername: username,
          victimUids: [curr.cloudAccount?.uid || 'local_tester'],
          timestampMs: Date.now(),
          expiresAtMs: Date.now() + 60_000,
          isSandbox,
        },
        isPreview: action === 'preview_snap_dust',
      });
    }
  };

  const handleClaimVaultSkinWithToken = (skinId: string) => {
    if (!MATTHEW_VAULT_SKINS.some((s) => s.id === skinId)) return;
    const curr = stateRef.current;
    if (curr.unlockedSkins.includes(skinId)) return;
    const hasForeverToken = Boolean(curr.hasMatthewShopToken || (curr.matthewShopTokens ?? 0) > 0);
    if (!hasForeverToken) return;

    const updatedAt = Date.now();
    let pushedState: GameState | null = null;
    setState((prev) => {
      if (prev.unlockedSkins.includes(skinId)) return prev;
      const hasToken = Boolean(prev.hasMatthewShopToken || (prev.matthewShopTokens ?? 0) > 0);
      if (!hasToken) return prev;
      const keptTokens = Math.max(1, prev.matthewShopTokens ?? 1);
      const next: GameState = {
        ...prev,
        matthewShopTokens: keptTokens,
        hasMatthewShopToken: true,
        unlockedSkins: [...prev.unlockedSkins, skinId],
        equippedSkin: skinId,
        lastSaveTime: updatedAt,
      };
      pushedState = next;
      saveGame(next);
      return next;
    });
    const cloudTarget: GameState = pushedState || {
      ...curr,
      matthewShopTokens: Math.max(1, curr.matthewShopTokens ?? 1),
      hasMatthewShopToken: true,
      unlockedSkins: [...curr.unlockedSkins, skinId],
      equippedSkin: skinId,
      lastSaveTime: updatedAt,
    };
    saveGame(cloudTarget);
    if (cloudTarget.cloudAccount) {
      saveStateToCloud(
        cloudTarget.cloudAccount.uid,
        cloudTarget.cloudAccount.displayUsername,
        cloudTarget,
        true
      ).catch(() => {});
    }
    soundManager.playSkinUnlock();
    handleNotify('VAULT SKIN CLAIMED!', `Free Token Claim: Equipped ${getSkinById(skinId).name}!`);
  };

  const handleBuySkinWithGems = (skinId: string, gemCost: number) => {
    setState((prev) => {
      const effectiveCost = prev.hasMatthewShopToken ? 0 : gemCost;
      if (prev.unlockedSkins.includes(skinId) || prev.gems < effectiveCost) return prev;
      const next: GameState = {
        ...prev,
        gems: prev.gems - effectiveCost,
        unlockedSkins: [...prev.unlockedSkins, skinId],
        equippedSkin: skinId,
      };
      saveGame(next);
      return next;
    });
    soundManager.playSkinUnlock();
    handleNotify('SKIN UNLOCKED!', `Equipped ${getSkinById(skinId).name}!`);
  };

  const handleOpenMysteryChest = (): ChestLootResult | null => {
    const curr = stateRef.current;
    const chestCost = curr.hasMatthewShopToken ? 0 : SEASON_2_CONFIG.gemChestCostGems;
    if (curr.gems < chestCost) return null;
    const cps = calculateCPS(curr, { fridayBonusActive: fridayBonus, stormWaveMultiplier });
    const cp = calculateClickPower(curr, { fridayBonusActive: fridayBonus, stormWaveMultiplier });
    const loot = rollChestLoot(
      cps,
      cp.totalPower,
      curr.unlockedSkins,
      Boolean(curr.hasMatthewShopToken),
      Math.random,
      curr.infinityStones || []
    );

    setState((prev) => {
      const effectiveCost = prev.hasMatthewShopToken ? 0 : SEASON_2_CONFIG.gemChestCostGems;
      if (prev.gems < effectiveCost) return prev;
      const nextSkins =
        loot.foundSkinId && !prev.unlockedSkins.includes(loot.foundSkinId)
          ? [...prev.unlockedSkins, loot.foundSkinId]
          : prev.unlockedSkins;
      const gotToken = Boolean(prev.hasMatthewShopToken || loot.foundMatthewShopToken);
      const mergedWithTokenSkins = gotToken
        ? Array.from(new Set([...nextSkins, ...getPermanentTokenFreeSkinIds(false)]))
        : nextSkins;
      const nextStones =
        loot.foundInfinityStone && !(prev.infinityStones || []).includes(loot.foundInfinityStone)
          ? [...(prev.infinityStones || []), loot.foundInfinityStone]
          : prev.infinityStones || [];
      const next: GameState = {
        ...prev,
        gems: prev.gems - effectiveCost + loot.gems,
        coins: prev.coins + loot.coins,
        lifetimeCoins: prev.lifetimeCoins + loot.coins,
        seasonalScore: prev.seasonalScore + loot.coins,
        chestsOpened: (prev.chestsOpened || 0) + 1,
        matthewShopTokens: Math.max(
          gotToken ? 1 : 0,
          (prev.matthewShopTokens || 0) + (loot.foundMatthewShopToken ? 1 : 0)
        ),
        hasMatthewShopToken: gotToken,
        infinityStones: nextStones,
        unlockedCursors: gotToken
          ? Array.from(
              new Set([...(prev.unlockedCursors || []), ...ALL_CURSORS.map((c) => c.id)])
            )
          : prev.unlockedCursors,
        ownedCosmetics: gotToken
          ? Array.from(
              new Set([...(prev.ownedCosmetics || []), ...COSMETIC_ITEMS.map((c) => c.id)])
            )
          : prev.ownedCosmetics,
        unlockedSkins: mergedWithTokenSkins,
      };
      saveGame(next);
      return next;
    });

    if (loot.foundInfinityStone) {
      const stoneDef = getInfinityStoneDefinition(loot.foundInfinityStone);
      handleNotify(
        'INFINITY STONE UNCOVERED!',
        `Collected the ${stoneDef?.name || loot.foundInfinityStone}! Check the Gauntlet tab!`
      );
    }

    if (loot.foundMatthewShopToken) {
      const tokenUid = curr.cloudAccount?.uid || 'local_player';
      const tokenUser =
        curr.cloudAccount?.displayUsername || curr.cloudAccount?.username || 'A lucky player';
      broadcastMatthewTokenPull({ uid: tokenUid, username: tokenUser, isSandbox })
        .then((b) => {
          seenTokenBroadcastIdRef.current = b.id;
        })
        .catch(() => {});
    }
    setChestCutsceneLoot(loot);
    return loot;
  };

  const handleCatchFallingChest = (forceStone = false): ChestLootResult => {
    const curr = stateRef.current;
    const cps = calculateCPS(curr, { fridayBonusActive: fridayBonus, stormWaveMultiplier });
    const cp = calculateClickPower(curr, { fridayBonusActive: fridayBonus, stormWaveMultiplier });
    const loot = rollChestLoot(
      cps,
      cp.totalPower,
      curr.unlockedSkins,
      Boolean(curr.hasMatthewShopToken),
      Math.random,
      curr.infinityStones || []
    );

    if (forceStone) {
      const owned = new Set(curr.infinityStones || []);
      const missing = ALL_INFINITY_STONE_IDS.filter((id) => !owned.has(id));
      if (missing.length > 0) {
        loot.foundInfinityStone = missing[Math.floor(Math.random() * missing.length)];
      }
    }

    setState((prev) => {
      const gotToken = Boolean(prev.hasMatthewShopToken || loot.foundMatthewShopToken);
      const nextSkins = gotToken
        ? Array.from(new Set([...prev.unlockedSkins, ...getPermanentTokenFreeSkinIds(false)]))
        : prev.unlockedSkins;
      const nextStones =
        loot.foundInfinityStone && !(prev.infinityStones || []).includes(loot.foundInfinityStone)
          ? [...(prev.infinityStones || []), loot.foundInfinityStone]
          : prev.infinityStones || [];
      const next: GameState = {
        ...prev,
        gems: prev.gems + loot.gems,
        coins: prev.coins + loot.coins,
        lifetimeCoins: prev.lifetimeCoins + loot.coins,
        seasonalScore: prev.seasonalScore + loot.coins,
        chestsOpened: (prev.chestsOpened || 0) + 1,
        matthewShopTokens: Math.max(
          gotToken ? 1 : 0,
          (prev.matthewShopTokens || 0) + (loot.foundMatthewShopToken ? 1 : 0)
        ),
        hasMatthewShopToken: gotToken,
        infinityStones: nextStones,
        unlockedSkins: nextSkins,
      };
      saveGame(next);
      return next;
    });

    if (loot.foundInfinityStone) {
      const stoneDef = getInfinityStoneDefinition(loot.foundInfinityStone);
      handleNotify(
        'INFINITY STONE UNCOVERED!',
        `Collected the ${stoneDef?.name || loot.foundInfinityStone}! Check the Gauntlet tab!`
      );
    }

    setChestCutsceneLoot(loot);
    return loot;
  };

  const handleOpenCrate = (crateType: CrateType) => {
    const def = CRATE_DEFINITIONS[crateType];
    const curr = stateRef.current;
    const crateCost = curr.hasMatthewShopToken ? 0 : def.gemCost;
    if (curr.gems < crateCost) {
      handleNotify('NOT ENOUGH GEMS', `${def.name} costs ${crateCost} Gems!`);
      return;
    }

    const reward = rollCrateReward(
      crateType,
      curr.unlockedSkins,
      curr.unlockedCursors || []
    );

    setState((prev) => {
      const effectiveCost = prev.hasMatthewShopToken ? 0 : def.gemCost;
      if (prev.gems < effectiveCost) return prev;
      const nextSkins =
        reward.rewardKind === 'skin' &&
        reward.skin &&
        !prev.unlockedSkins.includes(reward.skin.id)
          ? [...prev.unlockedSkins, reward.skin.id]
          : prev.unlockedSkins;
      const nextCursors =
        reward.rewardKind === 'cursor' &&
        reward.cursor &&
        !(prev.unlockedCursors || []).includes(reward.cursor.id)
          ? [...(prev.unlockedCursors || []), reward.cursor.id]
          : prev.unlockedCursors || [];
      const duplicateRefund = prev.hasMatthewShopToken
        ? 0
        : reward.isDuplicate
        ? reward.refundGems
        : 0;

      const next: GameState = {
        ...prev,
        gems: prev.gems - effectiveCost + duplicateRefund,
        unlockedSkins: nextSkins,
        unlockedCursors: nextCursors,
        cratesOpened: (prev.cratesOpened || 0) + 1,
      };
      saveGame(next);
      return next;
    });

    soundManager.playSkinUnlock();
    setCrateCutsceneResult(reward);
  };

  const handleEquipCursor = (cursorId: string | null) => {
    const hasToken = Boolean(stateRef.current.hasMatthewShopToken);
    if (
      cursorId &&
      !hasToken &&
      !(stateRef.current.unlockedCursors || []).includes(cursorId)
    ) {
      return;
    }
    const cursor = cursorId ? getCursorById(cursorId) : null;
    setState((prev) => {
      const nextUnlocked =
        cursorId && prev.hasMatthewShopToken && !(prev.unlockedCursors || []).includes(cursorId)
          ? [...(prev.unlockedCursors || []), cursorId]
          : prev.unlockedCursors;
      const next: GameState = {
        ...prev,
        unlockedCursors: nextUnlocked,
        equippedCursorId: cursorId,
      };
      saveGame(next);
      return next;
    });
    soundManager.playClick();
    if (cursor) {
      handleNotify('CURSOR EQUIPPED!', `${cursor.name} (${cursor.abilitySummary})`);
    } else {
      handleNotify('CURSOR UNEQUIPPED', 'Reverted to default OS cursor.');
    }
  };

  const handleBuyOrEquipCosmetic = (
    cosmeticId: string,
    slot: CosmeticSlot,
    gemCost: number
  ) => {
    const item = getCosmeticById(cosmeticId);
    if (!item) return;
    setState((prev) => {
      const owned = (prev.ownedCosmetics || []).includes(cosmeticId);
      const effectiveCost = prev.hasMatthewShopToken ? 0 : gemCost;
      if (!owned && prev.gems < effectiveCost) return prev;
      const prevEq = prev.equippedCosmetics || { hat: null, glasses: null };
      const isAlreadyEquipped = prevEq[slot] === cosmeticId;
      const next: GameState = {
        ...prev,
        gems: owned ? prev.gems : prev.gems - effectiveCost,
        ownedCosmetics: owned
          ? prev.ownedCosmetics
          : [...(prev.ownedCosmetics || []), cosmeticId],
        equippedCosmetics: {
          ...prevEq,
          [slot]: isAlreadyEquipped ? null : cosmeticId,
        },
      };
      saveGame(next);
      return next;
    });
    soundManager.playBuy();
  };

  const handleTakeOverSessionHere = async () => {
    const uid = stateRef.current.cloudAccount?.uid;
    const username =
      stateRef.current.cloudAccount?.displayUsername ||
      stateRef.current.cloudAccount?.username ||
      'Player';
    if (!uid) {
      setSessionLockedByOtherDevice(false);
      return;
    }
    const claimed = await claimSingleDeviceSession(uid, isSandbox).catch(() => '');
    if (claimed) sessionTokenRef.current = claimed;
    setSessionLockedByOtherDevice(false);
    if (hydrateProfileRef.current) {
      await hydrateProfileRef.current(uid, username, true).catch(() => {});
    }
    handleNotify('SESSION CLAIMED', 'Resumed active session on this device.');
  };

  const handleSignOutFromBanScreen = async () => {
    const uid = stateRef.current.cloudAccount?.uid;
    if (uid) clearCloudSaveSignature(uid);
    offlineCheckedForUidRef.current = null;
    await logoutPlayer();
    setActiveBanRecord(null);
    setState((prev) => {
      const next: GameState = { ...prev, cloudAccount: null };
      saveGame(next);
      return next;
    });
    setShowAccountModal(true);
  };

  return (
    <div className="relative w-screen h-screen bg-[#0c0f1d] text-slate-100 flex flex-col lg:flex-row overflow-hidden font-chunky noise-overlay">
      {/* INITIAL HYDRATION CURTAIN: Prevents flashing Season 1 before Season 2 Downtime / Sandbox resolves */}
      {isInitialCloudHydrating && (
        <div className="fixed inset-0 z-[150] bg-[#040812] flex flex-col items-center justify-center select-none pointer-events-auto">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-400/25 border-t-cyan-300 animate-spin" />
        </div>
      )}

      {/* FULL-SCREEN BANNED ACCOUNT LOCK OVERLAY */}
      {activeBanRecord && (
        <BannedScreenModal
          banRecord={activeBanRecord}
          onSignOut={handleSignOutFromBanScreen}
        />
      )}

      {/* 60FPS CANVAS PARTICLES */}
      <ParticleCanvas
        reducedMotion={state.settings.reducedMotion}
        showParticles={state.settings.showParticles}
      />

      {/* FLYING GOLDEN MATTHEW & FALLING MARVEL CHEST EVENT */}
      <GoldenMatthewEvent
        state={state}
        setState={setState}
        onSpawnBonus={(text) => handleNotify('BONUS EVENT!', text)}
        onCatchChest={() => handleCatchFallingChest(false)}
        forceSpawnChestCounter={forceSpawnChestCounter}
        swarmTrigger={goldenSwarmTrigger}
        isPaused={isGameplayPaused}
      />

      {/* TOP NOTIFICATION BANNERS (Auto-Claimed Quests, Unlocks, Events) */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[95] flex flex-col gap-2 max-w-md w-full pointer-events-none px-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="pointer-events-auto flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/95 border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.35)] backdrop-blur-md animate-fade-in"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-amber-300 uppercase">{n.title}</h4>
                <p className="text-xs font-bold text-slate-100">{n.subtitle}</p>
              </div>
            </div>
            <button
              onClick={() => setNotifications((prev) => prev.filter((item) => item.id !== n.id))}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* FULL-SCREEN AUTO-CLICKER PROBATION LOCK OVERLAY (STOPS GAMEPLAY UNTIL DEV REVIEWS) */}
      {isProbationActive && !activeBanRecord && (
        <div className="fixed inset-0 z-[135] bg-slate-950/96 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border-2 border-rose-500/70 shadow-[0_0_50px_rgba(244,63,94,0.35)] text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-rose-300 uppercase tracking-wide">
              You have been detected using an auto clicker
            </h2>
            <p className="text-xs font-bold text-slate-300 leading-relaxed">
              Your gameplay has been paused and reported to the developers for review. You cannot earn coins or click while this account is under probation.
            </p>
            <div className="pt-2">
              <button
                onClick={handleSignOutFromBanScreen}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase border border-slate-700 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN SINGLE-DEVICE SESSION LOCK OVERLAY */}
      {sessionLockedByOtherDevice && !activeBanRecord && (
        <div className="fixed inset-0 z-[130] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border-2 border-amber-400/60 shadow-2xl text-center space-y-4">
            <h2 className="text-xl font-black text-amber-300 uppercase">
              Active on Another Device
            </h2>
            <p className="text-xs font-bold text-slate-300 leading-relaxed">
              This account signed in on another browser or device. Only one device can actively earn coins on an account at the same time to prevent desyncs.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <button
                onClick={handleTakeOverSessionHere}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase cursor-pointer"
              >
                Play Here Instead
              </button>
              <button
                onClick={handleSignOutFromBanScreen}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs uppercase border border-slate-700 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE SUMMONED LIVE EVENT OVERLAY (Falling Matthews, Golden Rain, Marathon, Screen Freeze) */}
      {!seasonInfo.isDowntime && activeGlobalEvent && !pendingEventCutscene && (
        <ActiveGlobalEventOverlay
          event={activeGlobalEvent}
          currentUid={state.cloudAccount?.uid || 'local_tester'}
          currentUsername={activeUsername || 'Player'}
          currentCps={calculateCPS(state, { fridayBonusActive: fridayBonus, stormWaveMultiplier })}
          currentClickPower={
            calculateClickPower(state, { fridayBonusActive: fridayBonus, stormWaveMultiplier })
              .totalPower
          }
          isSandbox={isSandbox}
          hasFireCursor={Boolean(equippedCursor?.freezeImmune)}
          evStoreSnapshot={evStoreSnapshot}
          onAwardCoins={(amount, reason) => {
            handleEarnCoins(amount, false, false);
            handleNotify('LIVE EVENT REWARD!', `${reason} (+${formatCoins(amount)} MC)`);
          }}
          onAwardGems={(amount) => {
            setState((prev) => {
              const next = { ...prev, gems: prev.gems + amount };
              saveGame(next);
              return next;
            });
            handleNotify('GEM REWARD!', `Live Event Reward (+${amount} Gems)`);
          }}
          onDrainCoinsPercent={(pct) => {
            setState((prev) => {
              const safePct = Math.max(0, Math.min(0.25, pct));
              if ((prev.krillionCoins || 0) > 0) {
                return { ...prev, krillionCoins: Math.max(0, (prev.krillionCoins || 0) * (1 - safePct)) };
              }
              return { ...prev, coins: Math.max(0, Math.floor((prev.coins || 0) * (1 - safePct))) };
            });
          }}
          onNotify={handleNotify}
        />
      )}

      {/* LEFT SIDE: MAIN MATTHEW GAME (~68% on Desktop) */}
      <div className="w-full lg:w-[68%] h-full flex flex-col z-10">
        <ClickerArea
          state={state}
          setState={setState}
          onEarnCoins={handleEarnCoins}
          onOpenSettings={() => setShowEscMenu(true)}
          onOpenAccount={() => setShowAccountModal(true)}
          onOpenLeaderboard={() => setShowLeaderboardModal(true)}
          onOpenStormShop={() => setShowStormShop(true)}
          onOpenDevTools={() => setShowDevToolsModal(true)}
          onCheatProbationDetected={handleCheatProbationDetected}
          onAutoBan50CpsDetected={handleAutoBan50CpsDetected}
          probationAlertCount={probationAlerts.length}
          isProbationActive={isProbationActive}
          top3Players={top3Players}
          onlinePlayersCount={onlinePlayersCount}
          serverBroadcast={serverBroadcast}
          onNotify={handleNotify}
          fridayBonusActive={fridayBonus}
          stormState={stormState}
          seasonLabel={seasonLabel}
          seasonRemainingSec={seasonRemainingSec}
          isSandbox={isSandbox}
          onOpenDevTestMenu={() => setShowDevTestMenu(true)}
        />
      </div>

      {/* RIGHT SIDE: UPGRADES, REBIRTH & QUESTS PANEL (~32% on Desktop) */}
      <div
        className={`fixed lg:relative inset-x-0 bottom-0 z-30 transition-transform duration-300 lg:translate-y-0 lg:w-[32%] lg:h-full ${
          mobilePanelOpen
            ? 'translate-y-0 h-[65vh]'
            : 'translate-y-[calc(100%-52px)] lg:translate-y-0 h-[65vh] lg:h-full'
        }`}
      >
        <div
          onClick={() => setMobilePanelOpen((prev) => !prev)}
          className="lg:hidden h-[52px] bg-[#101426] border-t-2 border-slate-700 flex items-center justify-between px-4 cursor-pointer select-none text-amber-300 font-black text-sm shadow-xl"
        >
          <span>Skins, Upgrades &amp; Gauntlet ({state.unlockedSkins.length} Matthews)</span>
          {mobilePanelOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </div>

        <div className="h-[calc(100%-52px)] lg:h-full w-full">
          <RightPanel
            state={state}
            setState={setState}
            isSandbox={isSandbox}
            playersList={allPlayersList}
            isSnapBusy={isSnapBusy}
            onTriggerInfinitySnap={() => handleTriggerInfinitySnap()}
            onOpenSkinQualityModal={() => setShowSkinQualityModal(true)}
            onNotify={handleNotify}
            onBuySkinWithGems={handleBuySkinWithGems}
            onClaimVaultSkinWithToken={handleClaimVaultSkinWithToken}
            onOpenMysteryChest={handleOpenMysteryChest}
            onBuyOrEquipCosmetic={handleBuyOrEquipCosmetic}
            onOpenCrate={handleOpenCrate}
            onEquipCursor={handleEquipCursor}
            onEventSummoned={(evt) => {
              setActiveGlobalEvent(evt);
            }}
          />
        </div>
      </div>

      {/* UNIFIED SANDBOX DEV TEST MENU MODAL (z-[210]) */}
      <DevTestMenuModal
        isOpen={showDevTestMenu}
        onClose={() => setShowDevTestMenu(false)}
        state={state}
        onSetMoneyGems={(coins, gems, krillion = 0) => {
          setState((prev) => {
            const next: GameState = {
              ...prev,
              coins,
              krillionCoins: krillion,
              gems,
              lastSaveTime: Date.now(),
            };
            saveGame(next);
            return next;
          });
          handleNotify(
            'DEV SANDBOX UPDATED',
            `Set Coins to ${formatCoins(coins)} & Gems to ${gems}!`
          );
        }}
        onGiveStone={() => {
          setState((prev) => {
            const owned = new Set(prev.infinityStones || []);
            const missing = ALL_INFINITY_STONE_IDS.filter((id) => !owned.has(id));
            if (missing.length === 0) return prev;
            const pick = missing[Math.floor(Math.random() * missing.length)];
            const next: GameState = {
              ...prev,
              infinityStones: [...(prev.infinityStones || []), pick],
              lastSaveTime: Date.now(),
            };
            saveGame(next);
            return next;
          });
          handleNotify('INFINITY STONE ADDED', 'Open Gauntlet tab to view it lit up!');
        }}
        onGiveAllStones={() => handleSandboxTestAction('grant_all_stones')}
        onClearStones={() => {
          setState((prev) => {
            const next: GameState = { ...prev, infinityStones: [], lastSaveTime: Date.now() };
            saveGame(next);
            return next;
          });
          handleNotify('GAUNTLET CLEARED', 'Removed all 6 Infinity Stones.');
        }}
        onTestSnapPreview={() => handleSandboxTestAction('preview_snap_dust')}
        onTestSnapReal={() => handleSandboxTestAction('test_snap_self')}
        onTestThanosReset={() => setShowThanosReset(true)}
        onSpawnFallingChest={() => setForceSpawnChestCounter((c) => c + 1)}
        onOpenTestChest={(forceStone = false) => handleCatchFallingChest(forceStone)}
        onOpenCrateTest={(ct) => handleOpenCrate(ct)}
        onGrantShopToken={() => {
          setState((prev) => {
            const next: GameState = {
              ...prev,
              hasMatthewShopToken: true,
              matthewShopTokens: Math.max(1, prev.matthewShopTokens || 0),
              lastSaveTime: Date.now(),
            };
            saveGame(next);
            return next;
          });
          setShowTokenCutscene(true);
        }}
        onUnlockAllMarvelSkins={() => {
          setState((prev) => {
            const next: GameState = {
              ...prev,
              unlockedSkins: Array.from(
                new Set([...prev.unlockedSkins, ...ALL_MARVEL_SKINS.map((s) => s.id)])
              ),
              lastSaveTime: Date.now(),
            };
            saveGame(next);
            return next;
          });
          handleNotify('ALL MARVEL SKINS UNLOCKED!', 'Check Owned Skins!');
        }}
        onToggleStormEvent={() => handleSandboxTestAction('toggle_sandbox_friday_storm')}
        onSpawnGoldenSwarm={() => handleDevSpawnGoldenSwarm(14)}
        onReplayMarvelIntro={() => handleSandboxTestAction('replay_s3_intro')}
        onPreviewDowntime={() => handleSandboxTestAction('toggle_preview_midnight_downtime')}
        onOpenFullDevTools={() => setShowDevToolsModal(true)}
      />

      {/* MARSHALLB78 EXCLUSIVE PASSWORD-PROTECTED DEV TOOLS MODAL */}
      <DevToolsModal
        isOpen={showDevToolsModal}
        onClose={() => setShowDevToolsModal(false)}
        state={state}
        probationAlerts={probationAlerts}
        onProbationAlertsChanged={setProbationAlerts}
        playerReports={playerReports}
        onPlayerReportsChanged={setPlayerReports}
        onTriggerRain={() => {
          particleEngine.emitMatthewRain(
            45,
            stateRef.current.unlockedSkins.map((id) => getSkinById(id).image)
          );
          soundManager.playSkinUnlock();
        }}
        onNotify={handleNotify}
        onRefreshMiniLeaderboard={refreshMiniLeaderboard}
        isSandboxActive={isSandbox}
        isSandboxStormActive={sandboxStormStartMs !== null}
        onToggleSandboxS2={handleToggleSandboxS2}
        onTriggerInfinitySnap={handleTriggerInfinitySnap}
        onPreviewGlobalEvent={handlePreviewGlobalEvent}
        onClearPreviewEvent={() => {
          setActiveGlobalEvent(null);
          setPendingEventCutscene(null);
        }}
        onSpawnGlobalEventForAll={handleDevSpawnGlobalEvent}
        onStopGlobalEventForAll={handleDevStopGlobalEvent}
        onSpawnGoldenSwarmForAll={handleDevSpawnGoldenSwarm}
        onSandboxTestAction={handleSandboxTestAction}
      />

      {/* SEASON DOWNTIME OVERLAY (Only shown after user signs in so Sign-In comes first!) */}
      <SeasonDowntimeModal
        isOpen={!activeBanRecord && Boolean(state.cloudAccount) && (seasonInfo.isDowntime || previewDowntimeOverride)}
        state={state}
        seasonNumber={seasonInfo.seasonNumber}
        downtimeRemainingSeconds={
          previewDowntimeOverride ? 48 * 60 * 60 : seasonInfo.downtimeRemainingSeconds
        }
        onOpenLeaderboard={() => setShowLeaderboardModal(true)}
        onOpenSkins={() => setShowSkinQualityModal(true)}
        onOpenEscMenu={() => setShowEscMenu(true)}
        onOpenAccount={() => setShowAccountModal(true)}
        onEnterSandboxS2={handleToggleSandboxS2}
        onOpenDevTools={() => setShowDevToolsModal(true)}
      />

      {/* FULL-SCREEN ESC GAME MENU (Hub + Account + Settings) */}
      <EscMenuModal
        isOpen={showEscMenu}
        onClose={() => setShowEscMenu(false)}
        state={state}
        setState={setState}
        onOpenLeaderboard={() => setShowLeaderboardModal(true)}
        onOpenSkins={() => setShowSkinQualityModal(true)}
        onOpenStormShop={() => setShowStormShop(true)}
        isStormActive={isStormActive}
        isDowntime={seasonInfo.isDowntime}
        seasonLabel={seasonLabel}
        onNotify={handleNotify}
      />

      {/* VIEW ALL SKINS MODAL (Only active season's skins — no spoilers!) */}
      <SkinQualityModal
        isOpen={showSkinQualityModal}
        onClose={() => setShowSkinQualityModal(false)}
        equippedSkinId={state.equippedSkin}
        unlockedSkinIds={state.unlockedSkins}
        onEquipSkin={handleEquipSkin}
        currentSeasonId={seasonInfo.seasonId}
      />

      {/* UNIFIED SIGN IN / CREATE ACCOUNT MODAL (Required BEFORE Loading Screen & Cutscenes) */}
      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        state={state}
        setState={setState}
        onNotify={handleNotify}
        allowCloseWhenSignedOut={false}
      />

      {/* WORLDWIDE SEASONAL LEADERBOARD MODAL */}
      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        state={state}
        seasonId={seasonInfo.seasonId}
        seasonLabel={seasonLabel}
        seasonRemainingSec={seasonRemainingSec}
        isSandbox={isSandbox}
        onOpenAccount={() => setShowAccountModal(true)}
      />

      {/* SEASON 2: FROZEN APOCALYPSE ANIMATED INTRO CUTSCENE */}
      {showFrozenIntro && (
        <FrozenIntroCutsceneModal onComplete={handleCompleteFrozenIntro} />
      )}

      {/* SEASON 3: MARVEL 50-SKIN MULTIVERSE INTRO CUTSCENE */}
      {showMarvelIntro && (
        <MarvelIntroCutsceneModal onComplete={handleCompleteMarvelIntro} />
      )}

      {/* SEASON 3: THANOS PERIODIC COIN-RESET EVENT (KEEPS UPGRADES & CPS) */}
      <ThanosResetCutsceneModal
        isOpen={showThanosReset}
        onResetCoinsNow={() => {
          setState((prev) => {
            const next: GameState = {
              ...prev,
              coins: 0,
              krillionCoins: 0,
              lastSaveTime: Date.now(),
            };
            saveGame(next);
            return next;
          });
        }}
        onComplete={() => {
          setShowThanosReset(false);
          handleNotify(
            'THANOS STOLE YOUR COINS!',
            'Coins were reset to 0 — your Upgrades & CPS are intact!'
          );
        }}
      />

      {/* SEASON 3: INFINITY GAUNTLET SNAP DISINTEGRATION TO DUST CUTSCENE */}
      {pendingSnapCutscene && (() => {
        const equippedSkinObj = getSkinById(state.equippedSkin);
        const targetSnap = pendingSnapCutscene.snap;
        const isPreviewSnap = Boolean(pendingSnapCutscene.isPreview);
        return (
          <SnapDustCutsceneModal
            skinImage={equippedSkinObj.image}
            skinName={equippedSkinObj.name}
            snappedByUsername={targetSnap.snappedByUsername}
            isPreview={isPreviewSnap}
            onComplete={() => {
              setPendingSnapCutscene(null);
              if (isPreviewSnap) return;
              setState((prev) => {
                const next: GameState = {
                  ...prev,
                  coins: 0,
                  krillionCoins: 0,
                  lifetimeCoins: 0,
                  krillionLifetime: 0,
                  seasonalScore: 0,
                  krillionSeasonalScore: 0,
                  upgrades: {},
                  combo: 0,
                  comboTimer: 0,
                  frenzyTimer: 0,
                  lastProcessedSnapId: targetSnap.snapId,
                  lastSaveTime: Date.now(),
                };
                saveGame(next);
                if (next.cloudAccount) {
                  saveStateToCloud(
                    next.cloudAccount.uid,
                    next.cloudAccount.displayUsername,
                    next,
                    true
                  ).catch(() => {});
                }
                return next;
              });
              refreshMiniLeaderboard();
              handleNotify(
                'SNAPPED TO ASH!',
                `${targetSnap.snappedByUsername} wiped your Coins, Upgrades & Leaderboard Total! (Gems & Skins are safe)`
              );
            }}
          />
        );
      })()}

      {/* SEASON 2: LIVE EVENT / MATTHEW STORM 3D CINEMATIC CUTSCENE */}
      {pendingEventCutscene && (
        <EventCutsceneModal
          eventType={pendingEventCutscene.kind}
          summonedBy={pendingEventCutscene.summonedBy}
          onComplete={() => {
            const doneId = pendingEventCutscene?.id;
            setPendingEventCutscene(null);
            if (doneId) {
              const nowDone = Date.now();
              setActiveGlobalEvent((curr) =>
                curr && curr.id === doneId && curr.id.startsWith('preview_')
                  ? {
                      ...curr,
                      startedAtMs: nowDone,
                      endsAtMs: nowDone + curr.durationSeconds * 1000,
                    }
                  : curr
              );
            }
          }}
        />
      )}

      {/* SEASON 2: CHEST OPENING 2.5D CINEMATIC CUTSCENE */}
      {chestCutsceneLoot && (
        <ChestOpenCutsceneModal
          loot={chestCutsceneLoot}
          onComplete={() => {
            const wonToken = chestCutsceneLoot.foundMatthewShopToken;
            setChestCutsceneLoot(null);
            if (wonToken) {
              setShowTokenCutscene(true);
            }
          }}
        />
      )}

      {/* SEASON 2: NORMAL & FROST CRATE 3D CINEMATIC CUTSCENE */}
      {crateCutsceneResult && (
        <CrateOpenCutsceneModal
          result={crateCutsceneResult}
          onComplete={(equipReward) => {
            const reward = crateCutsceneResult;
            setCrateCutsceneResult(null);
            if (equipReward && reward) {
              if (reward.rewardKind === 'cursor' && reward.cursor) {
                handleEquipCursor(reward.cursor.id);
              } else if (reward.skin) {
                handleEquipSkin(reward.skin.id);
              }
            }
          }}
        />
      )}

      {/* IN-GAME CUSTOM CURSOR FOLLOWER (HIDES NATIVE OS CURSOR WHILE PLAYING) */}
      <EquippedCursorFollower cursor={!activeBanRecord && !sessionLockedByOtherDevice ? equippedCursor : null} />

      {/* SEASON 2: MATTHEW SHOP TOKEN CINEMATIC UNLOCK CUTSCENE */}
      {showTokenCutscene && (
        <TokenUnlockCutsceneModal onComplete={() => setShowTokenCutscene(false)} />
      )}

      {/* DAILY GEM ITEM SHOP MODAL */}
      {showItemShopModal && (
        <GemItemShopModal
          state={state}
          onClose={() => setShowItemShopModal(false)}
          onBuySkinWithGems={handleBuySkinWithGems}
          onClaimVaultSkinWithToken={handleClaimVaultSkinWithToken}
          onEquipSkin={handleEquipSkin}
          onOpenMysteryChest={handleOpenMysteryChest}
          onBuyOrEquipCosmetic={handleBuyOrEquipCosmetic}
        />
      )}

      {/* PLAYER-SUMMONED LIVE EVENTS HUB */}
      {showLiveEventsModal && (
        <LiveEventsHubModal
          state={state}
          isSandbox={isSandbox}
          onUpdateState={(updater) => {
            setState((prev) => {
              const next = updater(prev);
              saveGame(next);
              return next;
            });
          }}
          onNotify={(title, sub) => handleNotify(title, sub || '')}
          onClose={() => setShowLiveEventsModal(false)}
        />
      )}

      {/* MATTHEW STORM COUNTDOWN, SECRET EVENT SHOP & CLOSING ANIMATION/RECAP MODAL */}
      <MatthewStormModal
        state={state}
        setState={setState}
        stormState={stormState}
        isOpenShop={showStormShop}
        onCloseShop={() => setShowStormShop(false)}
        isOpenRecap={showStormRecap}
        onCloseRecap={() => setShowStormRecap(false)}
        onNotify={handleNotify}
      />

      {/* UPGRADED LOADING SCREEN ANIMATION (Appears AFTER Sign-In, BEFORE One-Time Cutscene) */}
      <IntroCutsceneModal
        isOpen={
          showIntroCutscene &&
          Boolean(state.cloudAccount) &&
          !seasonInfo.isDowntime &&
          !activeBanRecord
        }
        onComplete={handleCompleteIntro}
        isCloudLoading={isInitialCloudHydrating}
        isFrozenTheme={isS2Active && !isS3Active}
        isMarvelTheme={isS3Active}
        willPlayCutsceneAfter={
          (isS3Active && !state.season3IntroSeen) ||
          (isS2Active && !isS3Active && !state.season2IntroSeen)
        }
      />

      {/* OFFLINE EARNINGS POPUP */}
      {offlineData && !activeBanRecord && (
        <OfflineProgressModal
          elapsedSeconds={offlineData.elapsed}
          coinsEarned={offlineData.coins}
          onClaim={handleClaimOffline}
        />
      )}
    </div>
  );
}

export default App;
