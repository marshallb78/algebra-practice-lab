import React, { useState, useEffect, useRef } from 'react';
import { EggRarity, CosmeticSlot, GameState } from './types/game';
import {
  loadGame,
  loadSandboxGame,
  saveGame,
  performBetaWipeIfDue,
  performSeasonalRollover,
} from './utils/storage';
import { equipSkin, getSkinById, checkAndApplyMilestoneUnlocks } from './data/skins';
import { ALL_CURSORS, getCursorById } from './data/cursors';
import { CRATE_DEFINITIONS, CrateOpenResult, CrateType, rollCrateReward } from './data/crates';
import { MATTHEW_VAULT_SKINS } from './data/season2Skins';
import { checkAndAutoClaimQuests } from './data/quests';
import { calculateClickPower, calculateOfflineEarnings, calculateCPS } from './utils/calculations';
import { formatNumber } from './utils/formatters';
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
  TEST_ISOLATION_CONFIG,
  isSandboxSeason2Context,
} from './config/gameConfig';
import { getFirebaseServices } from './firebase/config';
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
} from './firebase/leaderboard';
import {
  BanRecord,
  PlayerSuspicionReport,
  ProbationReport,
  ServerBroadcast,
  checkAccountBanStatus,
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
  PlayerEventCostSpec,
  fetchActiveGlobalLiveEvent,
} from './firebase/liveEvents';
import {
  ChestLootResult,
  createStarterFrostPup,
  getEggDefinition,
  getPetUpgradeGemCost,
  pickWeightedEgg,
  rollChestLoot,
  rollHatchedPetSpecies,
} from './data/petsAndEggs';
import { COSMETIC_ITEMS, getCosmeticById } from './data/cosmetics';
import { SnowLootDrop } from './components/s2/PetCombatStage';
import { FrozenIntroCutsceneModal } from './components/s2/FrozenIntroCutsceneModal';
import { EggHatchCutsceneModal } from './components/s2/EggHatchCutsceneModal';
import { RaidIntroCutsceneModal } from './components/s2/RaidIntroCutsceneModal';
import { ChestOpenCutsceneModal } from './components/s2/ChestOpenCutsceneModal';
import { CrateOpenCutsceneModal } from './components/s2/CrateOpenCutsceneModal';
import { EquippedCursorFollower } from './components/s2/CursorVisual';
import { TokenUnlockCutsceneModal } from './components/s2/TokenUnlockCutsceneModal';
import { EventCutsceneModal, LiveEventCutsceneKind } from './components/s2/EventCutsceneModal';
import { PetsAndInventoryModal } from './components/s2/PetsAndInventoryModal';
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
import { X, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';

interface Toast {
  id: number;
  title: string;
  subtitle: string;
}

function getBootInitialState(): GameState {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const s2Raw = window.localStorage.getItem(TEST_ISOLATION_CONFIG.sandboxStorageKey);
      if (s2Raw) {
        const parsedS2 = JSON.parse(s2Raw);
        const s2Uid = parsedS2?.cloudAccount?.uid;
        if (isSandboxSeason2Context(s2Uid, Boolean(parsedS2?.sandboxS2Enabled), Date.now())) {
          return loadSandboxGame();
        }
      }
    }
  } catch {
    // ignore boot storage inspection error
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
  const [showIntroCutscene, setShowIntroCutscene] = useState<boolean>(true);

  // Season 2: Frozen Apocalypse states
  const [sandboxS2Enabled, setSandboxS2Enabled] = useState<boolean>(() =>
    Boolean(state.sandboxS2Enabled)
  );
  const sandboxS2EnabledRef = useRef<boolean>(Boolean(state.sandboxS2Enabled));
  sandboxS2EnabledRef.current = sandboxS2Enabled;
  const isGameplayPausedRef = useRef<boolean>(false);
  const [showFrozenIntro, setShowFrozenIntro] = useState(false);
  const [showPetsModal, setShowPetsModal] = useState(false);
  const [showItemShopModal, setShowItemShopModal] = useState(false);
  const [showLiveEventsModal, setShowLiveEventsModal] = useState(false);
  const [pendingRaidCutscene, setPendingRaidCutscene] = useState(false);
  const [pendingEventCutscene, setPendingEventCutscene] = useState<{
    id: string;
    kind: LiveEventCutsceneKind;
    summonedBy?: string;
  } | null>(null);
  const [chestCutsceneLoot, setChestCutsceneLoot] = useState<ChestLootResult | null>(null);
  const [crateCutsceneResult, setCrateCutsceneResult] = useState<CrateOpenResult | null>(null);
  const [showTokenCutscene, setShowTokenCutscene] = useState(false);
  const [eggHatchCutscene, setEggHatchCutscene] = useState<{
    rarity: EggRarity;
    speciesId: string;
    petName: string;
  } | null>(null);
  const [sessionLockedByOtherDevice, setSessionLockedByOtherDevice] = useState(false);
  const [activeGlobalEvent, setActiveGlobalEvent] = useState<ActiveGlobalLiveEvent | null>(null);
  const activeGlobalEventRef = useRef<ActiveGlobalLiveEvent | null>(null);
  activeGlobalEventRef.current = activeGlobalEvent;
  const [zombieRaidEndsAt, setZombieRaidEndsAt] = useState<number>(0);
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
  const [top3Players, setTop3Players] = useState<LeaderboardEntry[]>([]);
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
  const frozenIntroSessionTriggeredRef = useRef<boolean>(false);
  const lastCutsceneEventIdRef = useRef<string | null>(null);
  const mondayRolloverTriggeredRef = useRef<boolean>(false);

  const prevStormStatusRef = useRef<string>('pre_countdown');
  const prevWaveIndexRef = useRef<number>(-1);

  const activeUid = state.cloudAccount?.uid || null;
  const activeUsername =
    state.cloudAccount?.displayUsername || state.cloudAccount?.username || null;
  const verifiedDevSandbox = isVerifiedLiveDevSession(activeUid) && sandboxS2Enabled;
  const seasonInfo = getEffectiveSeasonInfo(activeUid, verifiedDevSandbox, nowMs);
  const isSandbox = seasonInfo.isSandbox;
  const isS2Active = seasonInfo.isFrozenApocalypseActive;
  const seasonLabel = isS2Active
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

  const isRaidActive = isS2Active && zombieRaidEndsAt > nowMs;
  const raidSecondsRemaining = isRaidActive ? Math.max(0, Math.ceil((zombieRaidEndsAt - nowMs) / 1000)) : 0;
  const isBossRaidActive = Boolean(
    isS2Active &&
      activeGlobalEvent &&
      activeGlobalEvent.type === 'zombie_boss_raid' &&
      activeGlobalEvent.endsAtMs > nowMs &&
      (!activeGlobalEvent.excludeSummoner ||
        activeGlobalEvent.summonedByUid !== state.cloudAccount?.uid)
  );
  const equippedCursor = getCursorById(state.equippedCursorId);
  const isScreenFrozen = Boolean(
    isS2Active &&
      !equippedCursor?.freezeImmune &&
      activeGlobalEvent &&
      activeGlobalEvent.type === 'screen_freeze' &&
      activeGlobalEvent.endsAtMs > nowMs &&
      (!activeGlobalEvent.excludeSummoner ||
        activeGlobalEvent.summonedByUid !== state.cloudAccount?.uid)
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
      Date.now()
    );

    setIsProbationActive(true);
    handleNotify(
      'ACCOUNT UNDER PROBATION',
      'Your account has been placed under probation and reported for admin review.'
    );
    await reportAccountProbation(uid, username, cps, reason, eff.seasonId, eff.isSandbox);
    if (isVerifiedLiveDevSession(curr.cloudAccount?.uid)) {
      const latest = await fetchProbationAlerts(eff.seasonId, eff.isSandbox).catch(() => []);
      setProbationAlerts(latest);
    }
  };

  const refreshMiniLeaderboard = async () => {
    try {
      const currUid = stateRef.current.cloudAccount?.uid || null;
      const eff = getEffectiveSeasonInfo(
        currUid,
        sandboxS2Enabled && isVerifiedLiveDevSession(currUid),
        Date.now()
      );
      const entries = await fetchWorldwideLeaderboard(eff.seasonId, 5, eff.isSandbox);
      setTop3Players(entries.slice(0, 3));
      setServerBroadcast(getCachedServerBroadcast());
    } catch {
      // ignore transient error
    }
  };

  // Poll cloud bans, probation alerts, single-device session lock & Top 3 Mini Leaderboard every 12s
  useEffect(() => {
    const checkBanAndLeaderboard = async () => {
      const curr = stateRef.current;
      const uid = curr.cloudAccount?.uid || null;
      const username =
        curr.cloudAccount?.displayUsername || curr.cloudAccount?.username || null;
      const eff = getEffectiveSeasonInfo(
        uid,
        sandboxS2Enabled && isVerifiedLiveDevSession(uid),
        Date.now()
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
    const interval = setInterval(checkBanAndLeaderboard, 12000);
    return () => clearInterval(interval);
  }, [state.cloudAccount?.uid, state.cloudAccount?.displayUsername, sandboxS2Enabled]);

  // At Monday midnight Season 2 launch, exit any active dev sandbox preview and reset to fresh Season 2
  useEffect(() => {
    if (nowMs < SEASON_2_CONFIG.launchTimeMs) return;
    if (mondayRolloverTriggeredRef.current) return;
    if (!sandboxS2Enabled && state.currentSeasonId === 'season_2') return;
    mondayRolloverTriggeredRef.current = true;

    sandboxS2EnabledRef.current = false;
    setSandboxS2Enabled(false);
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
      if (showPetsModal) {
        setShowPetsModal(false);
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
    showPetsModal,
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

  // Always play season-appropriate music: Frozen Winter / Live Event Synth in S2, Chill / Techno in S1
  useEffect(() => {
    if (
      showIntroCutscene ||
      showFrozenIntro ||
      pendingRaidCutscene ||
      pendingEventCutscene ||
      showTokenCutscene ||
      chestCutsceneLoot ||
      crateCutsceneResult ||
      eggHatchCutscene
    ) {
      return;
    }
    const isStormMusic =
      stormState.status === 'active' || stormState.status === 'fullscreen_10s_countdown';
    const isGlobalLiveEventActive = Boolean(
      activeGlobalEvent && activeGlobalEvent.endsAtMs > Date.now()
    );
    if (isS2Active) {
      soundManager.setMusicTrack(
        isStormMusic || isGlobalLiveEventActive || isRaidActive ? 's2_event' : 's2_winter'
      );
    } else {
      soundManager.setMusicTrack(isStormMusic ? 'storm' : 'chill');
    }
  }, [
    isS2Active,
    stormState.status,
    activeGlobalEvent,
    isRaidActive,
    showIntroCutscene,
    showFrozenIntro,
    pendingRaidCutscene,
    pendingEventCutscene,
    showTokenCutscene,
    chestCutsceneLoot,
    crateCutsceneResult,
    eggHatchCutscene,
  ]);

  // Mandatory Sign-In: Only show the Sign In popup after cloud hydration completes if not signed in & not in Downtime
  useEffect(() => {
    if (
      !isInitialCloudHydrating &&
      !seasonInfo.isDowntime &&
      !showIntroCutscene &&
      !activeBanRecord &&
      !state.cloudAccount &&
      !showAccountModal &&
      !showEscMenu
    ) {
      setShowAccountModal(true);
    }
  }, [
    isInitialCloudHydrating,
    seasonInfo.isDowntime,
    showIntroCutscene,
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
          Date.now()
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

        const liveInSandbox =
          targetSandbox &&
          (stateRef.current.sandboxS2Enabled || stateRef.current.currentSeasonId === 'season_2');
        const baseLocalState = targetSandbox
          ? {
              ...(liveInSandbox ? stateRef.current : loadSandboxGame()),
              sandboxS2Enabled: Boolean(sandboxS2EnabledRef.current || stateRef.current.sandboxS2Enabled),
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
            targetSandbox && (prev.sandboxS2Enabled || prev.currentSeasonId === 'season_2');
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
          const baseSkins = (
            sameOwner
              ? Array.from(new Set([...checkedPrev.unlockedSkins, ...merged.unlockedSkins]))
              : merged.unlockedSkins
          ).filter((id) => id !== 'champion_matthew' || canKeepChampion);
          if (sameOwner && checkedPrev.unlockedSkins.includes('champion_matthew') && !canKeepChampion) {
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

          const next: GameState = {
            ...merged,
            equippedSkin:
              !canKeepChampion && merged.equippedSkin === 'champion_matthew'
                ? 'classic_matthew'
                : merged.equippedSkin,
            currentSeasonId: eff.seasonId,
            sandboxS2Enabled: resolvedSandboxFlag,
            season2IntroSeen: Boolean(
              checkedPrev.season2IntroSeen ||
                merged.season2IntroSeen ||
                frozenIntroSessionTriggeredRef.current
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
        now
      );
      const foreignNewer = await hasForeignDeviceSavedMoreRecently(
        curr.cloudAccount.uid,
        eff.isSandbox
      );
      if (foreignNewer) {
        await hydrateProfileFromCloud(
          curr.cloudAccount.uid,
          curr.cloudAccount.displayUsername,
          true
        );
      }
    };

    registerForeignCloudUpdateHandler((uid) => {
      if (stateRef.current.cloudAccount?.uid === uid) {
        pullIfAnotherDeviceUpdated(true).catch(() => {});
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

  // Fast 10-second Realtime Database Profile + Leaderboard sync while playing, plus keepalive flush on close/background
  useEffect(() => {
    const syncProfileAndLeaderboard = () => {
      if (
        isHydratingCloudRef.current ||
        isReconcilingCloudRef.current ||
        activeBanRecord ||
        sessionLockedByOtherDevice
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

    const syncInterval = setInterval(syncProfileAndLeaderboard, 10000);

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
    sessionLockedByOtherDevice ||
    showIntroCutscene ||
    showFrozenIntro ||
    pendingRaidCutscene ||
    Boolean(pendingEventCutscene) ||
    Boolean(chestCutsceneLoot) ||
    Boolean(crateCutsceneResult) ||
    showTokenCutscene ||
    Boolean(eggHatchCutscene) ||
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
    enabled: !isGameplayPaused,
  });

  // Season 2: Trigger 3D widescreen cutscene once per active global live event ID
  useEffect(() => {
    if (
      !isS2Active ||
      showIntroCutscene ||
      showFrozenIntro ||
      activeBanRecord ||
      !activeGlobalEvent ||
      activeGlobalEvent.endsAtMs <= nowMs
    ) {
      return;
    }
    if (lastCutsceneEventIdRef.current !== activeGlobalEvent.id) {
      lastCutsceneEventIdRef.current = activeGlobalEvent.id;
      setPendingEventCutscene({
        id: activeGlobalEvent.id,
        kind: activeGlobalEvent.type,
        summonedBy: activeGlobalEvent.summonedByUsername,
      });
    }
  }, [
    isS2Active,
    activeGlobalEvent,
    nowMs,
    showIntroCutscene,
    showFrozenIntro,
    activeBanRecord,
  ]);

  // Season 2: Guarantee starter Frost Pup exists & is equipped so pets never disappear
  const petCount = state.pets?.length || 0;
  const equippedPetCount = state.equippedPetIds?.length || 0;

  useEffect(() => {
    if (!isS2Active || isGameplayPaused || (petCount > 0 && equippedPetCount > 0)) return;
    setState((prev) => {
      const pets = prev.pets || [];
      if (pets.length === 0) {
        const starterPet = createStarterFrostPup();
        const next: GameState = {
          ...prev,
          pets: [starterPet],
          equippedPetIds: [starterPet.instanceId],
        };
        saveGame(next);
        return next;
      }
      if ((prev.equippedPetIds || []).length === 0) {
        const next: GameState = {
          ...prev,
          equippedPetIds: [pets[0].instanceId],
        };
        saveGame(next);
        return next;
      }
      return prev;
    });
  }, [isS2Active, isGameplayPaused, petCount, equippedPetCount]);

  // Season 2: Poll global summoned live events every 5s (Click Fast Marathon, Falling Matthews, Boss Raid, Screen Freeze)
  useEffect(() => {
    if (!isS2Active || isInitialCloudHydrating || activeBanRecord) {
      setActiveGlobalEvent(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      const current = activeGlobalEventRef.current;
      if (current && current.id.startsWith('preview_') && current.endsAtMs > Date.now()) {
        return;
      }
      const ev = await fetchActiveGlobalLiveEvent(isSandbox);
      if (!cancelled) {
        const latest = activeGlobalEventRef.current;
        if (latest && latest.id.startsWith('preview_') && latest.endsAtMs > Date.now()) {
          return;
        }
        setActiveGlobalEvent(ev);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isS2Active, isSandbox, isInitialCloudHydrating, activeBanRecord]);

  // Season 2: Random 10-15 minute ZOMBIE RAID! waves
  useEffect(() => {
    if (
      !isS2Active ||
      seasonInfo.isDowntime ||
      showIntroCutscene ||
      showFrozenIntro ||
      activeBanRecord ||
      sessionLockedByOtherDevice
    ) {
      return;
    }
    const minMs = SEASON_2_CONFIG.raidIntervalMinSeconds * 1000;
    const maxMs = SEASON_2_CONFIG.raidIntervalMaxSeconds * 1000;
    const delayMs = minMs + Math.random() * Math.max(1000, maxMs - minMs);
    const t = setTimeout(() => {
      setPendingRaidCutscene(true);
    }, delayMs);
    return () => clearTimeout(t);
  }, [
    isS2Active,
    seasonInfo.isDowntime,
    showIntroCutscene,
    showFrozenIntro,
    activeBanRecord,
    sessionLockedByOtherDevice,
    zombieRaidEndsAt,
  ]);

  // Season 2: Trigger animated Frozen Apocalypse launch cutscene ONCE on first entry
  useEffect(() => {
    if (
      !frozenIntroSessionTriggeredRef.current &&
      isS2Active &&
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
    isInitialCloudHydrating,
    showIntroCutscene,
    activeBanRecord,
    state.season2IntroSeen,
  ]);

  const handleEarnCoins = (amount: number, isClick: boolean, isCrit: boolean) => {
    if (seasonInfo.isDowntime || activeBanRecord) return;

    let unlockedSkinsNow: { id: string; name: string }[] = [];
    let autoClaimedQuestsNow: { title: string; rewardGems: number; rewardCoins: number }[] = [];

    setState((prev) => {
      const nextCombo = 0;
      const baseNext: GameState = {
        ...prev,
        coins: prev.coins + amount,
        lifetimeCoins: prev.lifetimeCoins + amount,
        seasonalScore: prev.seasonalScore + amount,
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
      const hasPets = (prev.pets || []).length > 0;
      const starterPet = createStarterFrostPup();
      const nextPets = hasPets ? prev.pets : [starterPet];
      const nextEquipped =
        (prev.equippedPetIds || []).length > 0
          ? prev.equippedPetIds
          : [nextPets[0].instanceId];
      const next: GameState = {
        ...prev,
        season2IntroSeen: true,
        pets: nextPets,
        equippedPetIds: nextEquipped,
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
    handleNotify('FROST PUP JOINED!', 'Starter Uncommon Pet equipped to defend against Zombies!');
  };

  const handleToggleSandboxS2 = async () => {
    const currUid = stateRef.current.cloudAccount?.uid;
    if (!isVerifiedLiveDevSession(currUid)) return;
    if (Date.now() >= SEASON_2_CONFIG.launchTimeMs) {
      sandboxS2EnabledRef.current = false;
      setSandboxS2Enabled(false);
      setPreviewDowntimeOverride(false);
      return;
    }
    if (previewDowntimeOverride) {
      setPreviewDowntimeOverride(false);
      if (sandboxS2Enabled) return;
    }
    const turningOn = !sandboxS2Enabled;
    saveGame(stateRef.current);
    sandboxS2EnabledRef.current = turningOn;
    setSandboxS2Enabled(turningOn);
    if (turningOn) {
      const s2Local = loadSandboxGame();
      if (!s2Local.introCutsceneSeen && !s2Local.season2IntroSeen) {
        setShowIntroCutscene(true);
      }
      setState((prev) => {
        const allowChamp =
          (prev.cloudAccount?.displayUsername || '').trim().toLowerCase() === 'liamkd3' ||
          (prev.winnerBadges || []).some((b) => b.seasonNumber >= 2);
        const mergedSkins = Array.from(
          new Set([
            ...(s2Local.unlockedSkins || ['classic_matthew']),
            ...(prev.unlockedSkins || ['classic_matthew']),
          ])
        ).filter((id) => id !== 'champion_matthew' || allowChamp);
        const next: GameState = {
          ...s2Local,
          unlockedSkins: mergedSkins,
          equippedSkin: mergedSkins.includes(s2Local.equippedSkin)
            ? s2Local.equippedSkin
            : mergedSkins.includes(prev.equippedSkin)
            ? prev.equippedSkin
            : 'classic_matthew',
          winnerBadges:
            Array.isArray(prev.winnerBadges) && prev.winnerBadges.length > 0
              ? prev.winnerBadges
              : s2Local.winnerBadges,
          currentSeasonId: 'season_2',
          sandboxS2Enabled: true,
          lastSaveTime: Date.now(),
          cloudAccount: prev.cloudAccount,
        };
        saveGame(next);
        return next;
      });
      handleNotify('SEASON 2 PREVIEW ON', 'Entered isolated Season 2 preview.');
    } else {
      const s1Local = loadGame();
      setState((prev) => {
        const allowChamp =
          (prev.cloudAccount?.displayUsername || '').trim().toLowerCase() === 'liamkd3' ||
          (prev.winnerBadges || []).some((b) => b.seasonNumber >= 2);
        const mergedS1Skins = Array.from(
          new Set([
            ...(s1Local.unlockedSkins || ['classic_matthew']),
            ...(prev.unlockedSkins || []),
          ])
        ).filter((id) => id !== 'champion_matthew' || allowChamp);
        const next: GameState = {
          ...s1Local,
          unlockedSkins: mergedS1Skins,
          equippedSkin: mergedS1Skins.includes(s1Local.equippedSkin)
            ? s1Local.equippedSkin
            : 'classic_matthew',
          sandboxS2Enabled: false,
          lastSaveTime: Date.now(),
          cloudAccount: prev.cloudAccount,
        };
        saveGame(next);
        return next;
      });
      handleNotify('SEASON 2 PREVIEW OFF', 'Returned to Season Downtime.');
    }
  };

  const handleTriggerZombieRaidNow = () => {
    if (!isVerifiedLiveDevSession(stateRef.current.cloudAccount?.uid)) return;
    setPendingRaidCutscene(true);
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

    if (action === 'replay_s2_intro') {
      setShowDevToolsModal(false);
      setShowFrozenIntro(true);
      handleNotify('REPLAYING S2 INTRO', 'Playing Season 2 launch cutscene.');
    }
  };

  const handleZombieDefeated = (coinReward: number, gemReward = 0) => {
    setState((prev) => {
      const next: GameState = {
        ...prev,
        coins: prev.coins + coinReward,
        lifetimeCoins: prev.lifetimeCoins + coinReward,
        seasonalScore: prev.seasonalScore + coinReward,
        gems: prev.gems + gemReward,
        lifetimeGems: prev.lifetimeGems + gemReward,
        zombiesDefeated: (prev.zombiesDefeated || 0) + 1,
      };
      saveGame(next);
      return next;
    });
  };

  const handleZombieStealCoins = (stolenAmount: number) => {
    setState((prev) => {
      const next: GameState = {
        ...prev,
        coins: Math.max(0, prev.coins - Math.max(0, stolenAmount)),
        zombiesStolenCoins: (prev.zombiesStolenCoins || 0) + Math.max(0, stolenAmount),
        zombieHitsTaken: (prev.zombieHitsTaken || 0) + 1,
      };
      saveGame(next);
      return next;
    });
  };

  const handleClaimSnowDrop = (drop: SnowLootDrop) => {
    const curr = stateRef.current;
    if (drop.kind === 'egg') {
      const rarity = drop.eggRarity || 'Common Egg';
      setState((prev) => {
        const next: GameState = {
          ...prev,
          sealedEggs: {
            ...(prev.sealedEggs || {}),
            [rarity]: (prev.sealedEggs?.[rarity] || 0) + 1,
          } as Record<EggRarity, number>,
        };
        saveGame(next);
        return next;
      });
      soundManager.playSkinUnlock();
      handleNotify('EGG FOUND IN SNOW!', `Picked up a ${rarity} — open Pets to hatch it!`);
      return;
    }

    if (drop.kind === 'chest') {
      const cps = calculateCPS(curr, { fridayBonusActive: fridayBonus, stormWaveMultiplier });
      const cp = calculateClickPower(curr, { fridayBonusActive: fridayBonus, stormWaveMultiplier });
      const allVaultOwned = MATTHEW_VAULT_SKINS.every((s) => curr.unlockedSkins.includes(s.id));
      const loot = rollChestLoot(cps, cp.totalPower, curr.unlockedSkins, allVaultOwned);
      setState((prev) => {
        const nextSkins =
          loot.foundSkinId && !prev.unlockedSkins.includes(loot.foundSkinId)
            ? [...prev.unlockedSkins, loot.foundSkinId]
            : prev.unlockedSkins;
        const nextSealedEggs = { ...(prev.sealedEggs || {}) } as Record<EggRarity, number>;
        if (loot.eggRarity) {
          nextSealedEggs[loot.eggRarity] = (nextSealedEggs[loot.eggRarity] || 0) + 1;
        }
        const gotToken = Boolean(prev.hasMatthewShopToken || loot.foundMatthewShopToken);
        const next: GameState = {
          ...prev,
          gems: prev.gems + loot.gems,
          lifetimeGems: prev.lifetimeGems + loot.gems,
          coins: prev.coins + loot.coins,
          lifetimeCoins: prev.lifetimeCoins + loot.coins,
          seasonalScore: prev.seasonalScore + loot.coins,
          chestsOpened: (prev.chestsOpened || 0) + 1,
          matthewShopTokens: (prev.matthewShopTokens || 0) + (loot.foundMatthewShopToken ? 1 : 0),
          hasMatthewShopToken: gotToken,
          unlockedCursors: gotToken
            ? Array.from(
                new Set([...(prev.unlockedCursors || []), ...ALL_CURSORS.map((c) => c.id)])
              )
            : prev.unlockedCursors,
          unlockedSkins: nextSkins,
          sealedEggs: nextSealedEggs,
        };
        saveGame(next);
        return next;
      });
      soundManager.setMusicTrack('s2_event', true);
      setChestCutsceneLoot(loot);
      return;
    }

    if (drop.kind === 'gems') {
      const gemGain = Math.max(1, drop.gemAmount || 2);
      setState((prev) => {
        const next: GameState = {
          ...prev,
          gems: prev.gems + gemGain,
          lifetimeGems: prev.lifetimeGems + gemGain,
          lastSaveTime: Date.now(),
        };
        saveGame(next);
        return next;
      });
      soundManager.playBuy();
      handleNotify('GEMS COLLECTED!', `Found +${gemGain} Frost Gems buried in the snow!`);
      return;
    }

    const coinGain = Math.max(15, drop.coinAmount || 40);
    setState((prev) => {
      const next: GameState = {
        ...prev,
        coins: prev.coins + coinGain,
        lifetimeCoins: prev.lifetimeCoins + coinGain,
        seasonalScore: prev.seasonalScore + coinGain,
        lastSaveTime: Date.now(),
      };
      saveGame(next);
      return next;
    });
    soundManager.playBuy();
  };

  const handleHatchEgg = (rarity: EggRarity) => {
    const def = getEggDefinition(rarity);
    const snap = stateRef.current;
    const avail = snap.sealedEggs?.[rarity] || 0;
    if (avail <= 0 || snap.gems < def.hatchGemCost) return;

    const rolledSpec = rollHatchedPetSpecies(rarity);
    setState((prev) => {
      const count = prev.sealedEggs?.[rarity] || 0;
      if (count <= 0 || prev.gems < def.hatchGemCost) return prev;
      const newPetId = `pet_${rolledSpec.speciesId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newPet = {
        instanceId: newPetId,
        speciesId: rolledSpec.speciesId,
        name: rolledSpec.name,
        rarity,
        level: 1,
        hunger: 100,
        hatchedAt: Date.now(),
      };
      const nextEquipped =
        (prev.equippedPetIds || []).length < SEASON_2_CONFIG.maxEquippedPets
          ? [...(prev.equippedPetIds || []), newPetId]
          : prev.equippedPetIds;
      const next: GameState = {
        ...prev,
        gems: prev.gems - def.hatchGemCost,
        sealedEggs: {
          ...(prev.sealedEggs || {}),
          [rarity]: count - 1,
        } as Record<EggRarity, number>,
        pets: [...(prev.pets || []), newPet],
        equippedPetIds: nextEquipped,
        lastSaveTime: Date.now(),
      };
      saveGame(next);
      return next;
    });
    setShowPetsModal(false);
    setEggHatchCutscene({ rarity, speciesId: rolledSpec.speciesId, petName: rolledSpec.name });
  };

  const handleToggleEquipPet = (instanceId: string) => {
    setState((prev) => {
      const curr = prev.equippedPetIds || [];
      let nextEq: string[];
      if (curr.includes(instanceId)) {
        nextEq = curr.filter((id) => id !== instanceId);
      } else {
        if (curr.length >= SEASON_2_CONFIG.maxEquippedPets) {
          nextEq = [...curr.slice(1), instanceId];
        } else {
          nextEq = [...curr, instanceId];
        }
      }
      const next = { ...prev, equippedPetIds: nextEq, lastSaveTime: Date.now() };
      saveGame(next);
      return next;
    });
  };

  const handleUpgradePet = (instanceId: string) => {
    setState((prev) => {
      const target = (prev.pets || []).find((p) => p.instanceId === instanceId);
      if (!target) return prev;
      const cost = getPetUpgradeGemCost(target);
      if (prev.gems < cost) return prev;
      const nextPets = prev.pets.map((p) =>
        p.instanceId === instanceId ? { ...p, level: p.level + 1 } : p
      );
      const next = {
        ...prev,
        gems: prev.gems - cost,
        pets: nextPets,
        lastSaveTime: Date.now(),
      };
      saveGame(next);
      return next;
    });
    soundManager.playBuy();
  };

  const handleClaimVaultSkinWithToken = (skinId: string) => {
    if (!MATTHEW_VAULT_SKINS.some((s) => s.id === skinId)) return;
    const curr = stateRef.current;
    if (curr.unlockedSkins.includes(skinId)) return;
    const currTokens = Math.max(0, curr.matthewShopTokens ?? 0);
    if (currTokens <= 0) return;

    const nextTokens = Math.max(0, currTokens - 1);
    const updatedAt = Date.now();
    let pushedState: GameState | null = null;
    setState((prev) => {
      if (prev.unlockedSkins.includes(skinId)) return prev;
      const availTokens = Math.max(0, prev.matthewShopTokens ?? 0);
      if (availTokens <= 0) return prev;
      const resolvedNextTokens = Math.max(0, availTokens - 1);
      const next: GameState = {
        ...prev,
        matthewShopTokens: resolvedNextTokens,
        hasMatthewShopToken: resolvedNextTokens > 0,
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
      matthewShopTokens: nextTokens,
      hasMatthewShopToken: nextTokens > 0,
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
    if (curr.gems < SEASON_2_CONFIG.gemChestCostGems) return null;
    const cps = calculateCPS(curr, { fridayBonusActive: fridayBonus, stormWaveMultiplier });
    const cp = calculateClickPower(curr, { fridayBonusActive: fridayBonus, stormWaveMultiplier });
    const loot = rollChestLoot(
      cps,
      cp.totalPower,
      curr.unlockedSkins,
      Boolean(curr.hasMatthewShopToken)
    );

    setState((prev) => {
      if (prev.gems < SEASON_2_CONFIG.gemChestCostGems) return prev;
      const nextSkins =
        loot.foundSkinId && !prev.unlockedSkins.includes(loot.foundSkinId)
          ? [...prev.unlockedSkins, loot.foundSkinId]
          : prev.unlockedSkins;
      const nextSealedEggs = { ...(prev.sealedEggs || {}) } as Record<EggRarity, number>;
      if (loot.eggRarity) {
        nextSealedEggs[loot.eggRarity] = (nextSealedEggs[loot.eggRarity] || 0) + 1;
      }
      const gotToken = Boolean(prev.hasMatthewShopToken || loot.foundMatthewShopToken);
      const next: GameState = {
        ...prev,
        gems: prev.gems - SEASON_2_CONFIG.gemChestCostGems + loot.gems,
        coins: prev.coins + loot.coins,
        lifetimeCoins: prev.lifetimeCoins + loot.coins,
        seasonalScore: prev.seasonalScore + loot.coins,
        chestsOpened: (prev.chestsOpened || 0) + 1,
        matthewShopTokens: (prev.matthewShopTokens || 0) + (loot.foundMatthewShopToken ? 1 : 0),
        hasMatthewShopToken: gotToken,
        unlockedCursors: gotToken
          ? Array.from(
              new Set([...(prev.unlockedCursors || []), ...ALL_CURSORS.map((c) => c.id)])
            )
          : prev.unlockedCursors,
        unlockedSkins: nextSkins,
        sealedEggs: nextSealedEggs,
      };
      saveGame(next);
      return next;
    });

    setChestCutsceneLoot(loot);
    return loot;
  };

  const handleOpenCrate = (crateType: CrateType) => {
    const def = CRATE_DEFINITIONS[crateType];
    const curr = stateRef.current;
    if (curr.gems < def.gemCost) {
      handleNotify('NOT ENOUGH GEMS', `${def.name} costs ${def.gemCost} Gems!`);
      return;
    }

    const reward = rollCrateReward(
      crateType,
      curr.unlockedSkins,
      curr.unlockedCursors || []
    );

    setState((prev) => {
      if (prev.gems < def.gemCost) return prev;
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
      const duplicateRefund = reward.isDuplicate ? reward.refundGems : 0;

      const next: GameState = {
        ...prev,
        gems: prev.gems - def.gemCost + duplicateRefund,
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
      if (!owned && prev.gems < gemCost) return prev;
      const prevEq = prev.equippedCosmetics || { hat: null, glasses: null };
      const isAlreadyEquipped = prevEq[slot] === cosmeticId;
      const next: GameState = {
        ...prev,
        gems: owned ? prev.gems : prev.gems - gemCost,
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
    if (!uid) {
      setSessionLockedByOtherDevice(false);
      return;
    }
    const claimed = await claimSingleDeviceSession(uid, isSandbox).catch(() => '');
    if (claimed) sessionTokenRef.current = claimed;
    setSessionLockedByOtherDevice(false);
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

      {/* FLYING GOLDEN MATTHEW EVENT */}
      <GoldenMatthewEvent
        state={state}
        setState={setState}
        onSpawnBonus={(text) => handleNotify('BONUS EVENT!', text)}
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

      {/* SEASON 2 ACTIVE SUMMONED LIVE EVENT OVERLAY (Falling Matthews, Golden Rain, Marathon, Screen Freeze) */}
      {isS2Active && activeGlobalEvent && !pendingEventCutscene && (
        <ActiveGlobalEventOverlay
          event={activeGlobalEvent}
          currentUid={state.cloudAccount?.uid || 'local_tester'}
          currentUsername={activeUsername || 'Player'}
          currentCoins={state.coins}
          isSandbox={isSandbox}
          hasFireCursor={Boolean(equippedCursor?.freezeImmune)}
          onAwardCoins={(amount, reason) => {
            handleEarnCoins(amount, false, false);
            handleNotify('LIVE EVENT REWARD!', `${reason} (+${formatNumber(amount)} MC)`);
          }}
          onAwardGems={(amount) => {
            setState((prev) => {
              const next = { ...prev, gems: prev.gems + amount };
              saveGame(next);
              return next;
            });
            handleNotify('GEM REWARD!', `Live Event Reward (+${amount} Gems)`);
          }}
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
          probationAlertCount={probationAlerts.length}
          isProbationActive={isProbationActive}
          top3Players={top3Players}
          serverBroadcast={serverBroadcast}
          onNotify={handleNotify}
          fridayBonusActive={fridayBonus}
          stormState={stormState}
          seasonLabel={seasonLabel}
          seasonRemainingSec={seasonRemainingSec}
          isRaidActive={isRaidActive}
          isBossRaidActive={isBossRaidActive}
          raidSecondsRemaining={raidSecondsRemaining}
          onZombieDefeated={handleZombieDefeated}
          onZombieStealCoins={handleZombieStealCoins}
          onClaimSnowDrop={handleClaimSnowDrop}
          onOpenPetsModal={() => setShowPetsModal(true)}
          isCombatPaused={isGameplayPaused}
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
          <span>Skins, Upgrades &amp; Pets ({state.unlockedSkins.length} Matthews)</span>
          {mobilePanelOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </div>

        <div className="h-[calc(100%-52px)] lg:h-full w-full">
          <RightPanel
            state={state}
            setState={setState}
            isSandbox={isSandbox}
            onOpenSkinQualityModal={() => setShowSkinQualityModal(true)}
            onNotify={handleNotify}
            onHatchEgg={handleHatchEgg}
            onToggleEquipPet={handleToggleEquipPet}
            onUpgradePet={handleUpgradePet}
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
        onTriggerZombieRaid={handleTriggerZombieRaidNow}
        onPreviewGlobalEvent={handlePreviewGlobalEvent}
        onClearPreviewEvent={() => {
          setActiveGlobalEvent(null);
          setPendingEventCutscene(null);
        }}
        onSandboxTestAction={handleSandboxTestAction}
      />

      {/* WEEKEND SEASON DOWNTIME OVERLAY (Appears immediately on entry during pre-launch/weekend Downtime until Monday) */}
      <SeasonDowntimeModal
        isOpen={!activeBanRecord && (seasonInfo.isDowntime || previewDowntimeOverride)}
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

      {/* UNIFIED SIGN IN / CREATE ACCOUNT MODAL */}
      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        state={state}
        setState={setState}
        onNotify={handleNotify}
        allowCloseWhenSignedOut={seasonInfo.isDowntime}
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

      {/* SEASON 2: FROZEN APOCALYPSE ANIMATED INTRO CUTSCENE (UNSKIPPABLE FIRST LOGIN) */}
      {showFrozenIntro && (
        <FrozenIntroCutsceneModal onComplete={handleCompleteFrozenIntro} />
      )}

      {/* SEASON 2: ZOMBIE RAID CINEMATIC INTRO CUTSCENE */}
      {pendingRaidCutscene && (
        <RaidIntroCutsceneModal
          onComplete={() => {
            setPendingRaidCutscene(false);
            setZombieRaidEndsAt(Date.now() + SEASON_2_CONFIG.raidDurationSeconds * 1000);
            handleNotify('ZOMBIE RAID!', '3x Zombies swarming! Pets engaging horde!');
          }}
        />
      )}

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

      {/* SEASON 2: 3D EGG HATCHING CINEMATIC CUTSCENE */}
      {eggHatchCutscene && (
        <EggHatchCutsceneModal
          rarity={eggHatchCutscene.rarity}
          speciesId={eggHatchCutscene.speciesId}
          onComplete={() => {
            const info = eggHatchCutscene;
            setEggHatchCutscene(null);
            soundManager.playSkinUnlock();
            handleNotify('EGG HATCHED!', `Hatched ${info.petName} (${info.rarity})!`);
          }}
        />
      )}

      {/* SEASON 2: PET SQUAD & EGGS MODAL (Opened from Pasture button) */}
      {showPetsModal && (
        <PetsAndInventoryModal
          state={state}
          onClose={() => setShowPetsModal(false)}
          onHatchEgg={handleHatchEgg}
          onToggleEquipPet={handleToggleEquipPet}
          onUpgradePet={handleUpgradePet}
        />
      )}

      {/* SEASON 2: DAILY GEM ITEM SHOP MODAL (Legacy trigger if invoked directly) */}
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

      {/* SEASON 2: PLAYER-SUMMONED LIVE EVENTS HUB */}
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

      {/* UPGRADED LOADING SCREEN ANIMATION (Click PLAY to Start — suppressed during Downtime so Downtime shows immediately!) */}
      <IntroCutsceneModal
        isOpen={showIntroCutscene && !seasonInfo.isDowntime && !activeBanRecord}
        onComplete={handleCompleteIntro}
        isCloudLoading={isInitialCloudHydrating}
        isFrozenTheme={isS2Active}
        willPlayCutsceneAfter={isS2Active && !state.season2IntroSeen}
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
