import React, { useState, useRef, useEffect } from 'react';
import { GameState, FloatingNumber } from '../types/game';
import {
  ALL_SKINS,
  getProgressionSkinsForSeason,
  getSkinMilestoneProgress,
  getSkinById,
  getSkinBackgroundTheme,
  isSeasonThreeOrLater,
  isSeasonTwoOrLater,
} from '../data/skins';
import { AntiAutoclickerGuard } from '../utils/antiAutoclicker';
import { FrozenBackground } from './s2/FrozenBackground';
import { MarvelBackground } from './s3/MarvelBackground';
import { getHeroSquadSummary } from '../data/heroSquad';
import {
  MarvelArenaHud,
  MARVEL_BOSSES,
  ActiveMarvelBoss,
} from './s3/MarvelArenaHud';
import { getAscensionMultiplier } from '../data/prestige';
import { formatCoins, formatExtendedCoins, formatKrillion, formatTime } from '../utils/formatters';
import {
  calculateClickPower,
  calculateCPS,
  calculateGiantMatthewClickReward,
  calculateKrillionProduction,
  LiveMultiplierOptions,
} from '../utils/calculations';
import { MatthewStormState } from '../utils/scheduleEngine';
import { MATTHEW_STORM_CONFIG, isAuthorizedDevUid } from '../config/gameConfig';
import { getCursorById } from '../data/cursors';
import { soundManager } from '../audio/soundManager';
import { particleEngine } from './ParticleCanvas';
import { EnvironmentBackground } from './EnvironmentBackground';
import { ServerBroadcast, isVerifiedLiveDevSession } from '../firebase/moderation';
import { LeaderboardEntry, isLeaderboardPlayerOnline } from '../firebase/leaderboard';
import {
  Volume2,
  VolumeX,
  Settings as SettingsIcon,
  Flame,
  Target,
  Trophy,
  User,
  Zap,
  Gem,
  ShoppingBag,
  Infinity as InfinityIcon,
  Wrench,
  Crown,
  Gauge,
  Megaphone,
  Lock,
  Check,
  HelpCircle,
  X,
  ShieldAlert,
} from 'lucide-react';

interface ClickerAreaProps {
  state: GameState;
  setState: React.Dispatch<React.SetStateAction<GameState>>;
  onEarnCoins: (amount: number, isClick: boolean, isCrit: boolean, krillionAmount?: number) => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  onOpenLeaderboard: () => void;
  onOpenStormShop: () => void;
  onOpenDevTools?: () => void;
  top3Players?: LeaderboardEntry[];
  onlinePlayersCount?: number;
  serverBroadcast?: ServerBroadcast | null;
  onNotify?: (title: string, subtitle: string) => void;
  fridayBonusActive: boolean;
  stormState: MatthewStormState;
  seasonLabel: string;
  seasonRemainingSec: number;
  onCheatProbationDetected?: (details: { reason: string; cps: number }) => void;
  onAutoBan50CpsDetected?: (cps: number) => void;
  probationAlertCount?: number;
  isProbationActive?: boolean;
  isSandbox?: boolean;
  onOpenDevTestMenu?: () => void;
}

export const ClickerArea: React.FC<ClickerAreaProps> = ({
  state,
  setState,
  onEarnCoins,
  onOpenSettings,
  onOpenAccount,
  onOpenLeaderboard,
  onOpenStormShop,
  onOpenDevTools,
  top3Players = [],
  onlinePlayersCount = 0,
  serverBroadcast = null,
  onNotify,
  fridayBonusActive,
  stormState,
  seasonLabel,
  seasonRemainingSec,
  onCheatProbationDetected,
  onAutoBan50CpsDetected,
  probationAlertCount = 0,
  isProbationActive = false,
  isSandbox = false,
  onOpenDevTestMenu,
}) => {
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [clickRipples, setClickRipples] = useState<
    { id: number; x: number; y: number; isCrit: boolean }[]
  >([]);
  const [cursorEffects, setCursorEffects] = useState<
    { id: number; x: number; y: number; cursorId: string; accentColor: string }[]
  >([]);
  const [imgSrcOverride, setImgSrcOverride] = useState<string | null>(null);
  const [showSkinLadderModal, setShowSkinLadderModal] = useState<boolean>(false);
  const [giantWaveClicks, setGiantWaveClicks] = useState<{ waveIndex: number; clicks: number }>({
    waveIndex: -1,
    clicks: 0,
  });

  // Season 3 Marvel Arena Systems: Strike Team + Arc Overdrive (250 clicks, 3x) + Boss Encounters (15s)
  const [arcCharge, setArcCharge] = useState<number>(0);
  const [arcActiveSec, setArcActiveSec] = useState<number>(0);
  const [bossCooldownSec, setBossCooldownSec] = useState<number>(0);
  const [activeBoss, setActiveBoss] = useState<ActiveMarvelBoss | null>(null);
  const bossIdxRef = useRef<number>(0);
  const bossFlashOverlayRef = useRef<HTMLDivElement | null>(null);

  // Live CPS Counter (rolling 1-second click window) + Statistical Anti-Autoclicker Guard
  const [liveCps, setLiveCps] = useState<number>(0);
  const clickTimestampsRef = useRef<number[]>([]);
  const clickGuardRef = useRef(new AntiAutoclickerGuard());
  const highestCpsRef = useRef<number>(state.highestCps || 0);
  highestCpsRef.current = Math.max(highestCpsRef.current, state.highestCps || 0);

  const updateLiveCps = (now: number, recordClick = false): number => {
    const timestamps = clickTimestampsRef.current;
    if (recordClick) {
      timestamps.push(now);
    }
    const cutoff = now - 1000;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
    const cps = timestamps.length;
    setLiveCps((prev) => (prev !== cps ? cps : prev));
    if (cps > highestCpsRef.current) {
      highestCpsRef.current = cps;
      setState((prev) => (cps > (prev.highestCps || 0) ? { ...prev, highestCps: cps } : prev));
    }
    return cps;
  };

  const characterRef = useRef<HTMLDivElement | null>(null);
  const spriteContainerRef = useRef<HTMLDivElement | null>(null);
  const clickAnimRef = useRef<Animation | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

  const equippedSkin = ALL_SKINS.find((s) => s.id === state.equippedSkin) || ALL_SKINS[0];
  const ascensionMultiplier = getAscensionMultiplier(state.prestigeShards);
  const isMarshallDev = isVerifiedLiveDevSession(state.cloudAccount?.uid);

  const isStormActive = stormState.status === 'active';
  const currentWave = stormState.currentWave;
  const stormWaveMultiplier = isStormActive
    ? currentWave
      ? currentWave.multiplier
      : MATTHEW_STORM_CONFIG.baseStormMultiplier
    : 1;

  const liveOpts: LiveMultiplierOptions = {
    fridayBonusActive,
    stormWaveMultiplier,
  };

  const { totalPower, critChance, critMultiplier } = calculateClickPower(state, liveOpts);
  const cps = calculateCPS(state, liveOpts);
  const isMarvelArena = isSeasonThreeOrLater(state.currentSeasonId);
  const heroSquad = getHeroSquadSummary(state.unlockedSkins, state.equippedSkin);

  const awardBossVictory = (boss: ActiveMarvelBoss) => {
    const prodPerSec = Math.max(25, cps + totalPower * 5);
    const bonusCoins = Math.floor(prodPerSec * boss.spec.coinSeconds);
    onEarnCoins(bonusCoins, false, true);
    setState((prev) => ({
      ...prev,
      gems: (prev.gems || 0) + boss.spec.gemReward,
      lifetimeGems: (prev.lifetimeGems || 0) + boss.spec.gemReward,
      frenzyMultiplier: Math.max(prev.frenzyMultiplier || 1, boss.spec.frenzyMult),
      frenzyTimer: Math.max(prev.frenzyTimer || 0, boss.spec.frenzySec),
    }));
    soundManager.playSkinUnlock();
    onNotify?.(
      `${boss.spec.name.toUpperCase()} DEFEATED!`,
      `+${boss.spec.gemReward} Gems, +${formatCoins(bonusCoins)} MC & ${boss.spec.frenzyMult}× Boost (${boss.spec.frenzySec}s)!`
    );
  };

  const applyBossPunishment = (boss: ActiveMarvelBoss) => {
    let coinsLost = 0;
    setState((prev) => {
      coinsLost = Math.floor((prev.coins || 0) * 0.15);
      return {
        ...prev,
        coins: Math.max(0, (prev.coins || 0) - coinsLost),
        frenzyMultiplier: 0.5,
        frenzyTimer: 10,
      };
    });
    soundManager.playThunder();
    onNotify?.(
      `${boss.spec.name.toUpperCase()} AMBUSH!`,
      coinsLost > 0
        ? `You failed in 15s! Lost ${formatCoins(coinsLost)} MC & 0.5× Production for 10s!`
        : `You failed in 15s! 0.5× Production Ambush for 10s!`
    );
  };

  const handleSummonBoss = () => {
    if (!isMarvelArena || activeBoss || bossCooldownSec > 0) return;
    const spec = MARVEL_BOSSES[bossIdxRef.current % MARVEL_BOSSES.length];
    bossIdxRef.current += 1;
    const baseDps = Math.max(30, totalPower * 10 + cps);
    const maxHp = Math.floor(baseDps * (spec.hpMultiplier / 10));
    setActiveBoss({ spec, hp: maxHp, maxHp, timeRemainingSec: 15 });
    setBossCooldownSec(60);
    soundManager.playStormWaveStart();
    onNotify?.(`${spec.name.toUpperCase()} INCOMING!`, `Beat ${spec.name} in 15s or suffer a 15% Coin Ambush!`);
  };

  const handleActivateArc = () => {
    if (!isMarvelArena || arcCharge < 250 || arcActiveSec > 0) return;
    setArcCharge(0);
    setArcActiveSec(10);
    soundManager.playThunder();
    onNotify?.('ARC REACTOR OVERDRIVE!', '3× Click Power + 10 Auto-Repulsors/s for 10s!');
  };

  const arenaRef = useRef({
    cps,
    totalPower,
    arcActiveSec,
    bossDamageMultiplier: heroSquad.bossDamageMultiplier,
    onEarnCoins,
    awardBossVictory,
    applyBossPunishment,
  });
  arenaRef.current = {
    cps,
    totalPower,
    arcActiveSec,
    bossDamageMultiplier: heroSquad.bossDamageMultiplier,
    onEarnCoins,
    awardBossVictory,
    applyBossPunishment,
  };

  // Smooth Chromebook-friendly 500ms tick (stable interval, zero teardown churn)
  useEffect(() => {
    if (!isMarvelArena) return;
    const timer = setInterval(() => {
      const dt = 0.5;
      const snap = arenaRef.current;

      setArcActiveSec((prev) => (prev > 0 ? Math.max(0, prev - dt) : 0));
      if (snap.arcActiveSec > 0) {
        snap.onEarnCoins(Math.max(1, Math.floor(snap.totalPower * 3 * 10 * dt)), false, false);
      }

      setBossCooldownSec((prev) => (prev > 0 ? Math.max(0, prev - dt) : 0));

      setActiveBoss((prev) => {
        if (!prev) return null;
        const passiveDmg =
          (snap.cps + (snap.arcActiveSec > 0 ? snap.totalPower * 30 : 0)) *
          dt *
          snap.bossDamageMultiplier;
        const nextHp = prev.hp - passiveDmg;
        const nextTime = prev.timeRemainingSec - dt;
        if (nextHp <= 0) {
          queueMicrotask(() => snap.awardBossVictory(prev));
          return null;
        }
        if (nextTime <= 0) {
          queueMicrotask(() => snap.applyBossPunishment(prev));
          return null;
        }
        return { ...prev, hp: nextHp, timeRemainingSec: nextTime };
      });
    }, 500);
    return () => clearInterval(timer);
  }, [isMarvelArena]);

  useEffect(() => {
    setImgSrcOverride(null);
    const img = new Image();
    img.src = equippedSkin.image;
  }, [equippedSkin]);

  useEffect(() => {
    if (currentWave && currentWave.waveIndex !== giantWaveClicks.waveIndex) {
      setGiantWaveClicks({ waveIndex: currentWave.waveIndex, clicks: 0 });
    }
  }, [currentWave, giantWaveClicks.waveIndex]);

  useEffect(() => {
    return () => {
      if (clickAnimRef.current) {
        clickAnimRef.current.cancel();
      }
    };
  }, []);

  // 200ms ticker to keep Live CPS Counter smoothly updated while idle-skipping when already at 0
  useEffect(() => {
    const ticker = setInterval(() => {
      if (clickTimestampsRef.current.length > 0) {
        updateLiveCps(performance.now());
      } else {
        setLiveCps((prev) => (prev !== 0 ? 0 : prev));
      }
    }, 200);
    return () => clearInterval(ticker);
  }, []);

  const triggerRestartableBounce = (isCrit = false) => {
    if (state.settings.reducedMotion) return;
    const el = spriteContainerRef.current;
    if (!el || typeof el.animate !== 'function') return;

    if (clickAnimRef.current) {
      clickAnimRef.current.cancel();
    }

    const tiltDeg = (Math.random() - 0.5) * (isCrit ? 14 : 8);
    clickAnimRef.current = el.animate(
      [
        {
          transform: `scale(${isCrit ? 0.78 : 0.85}, ${isCrit ? 1.22 : 1.15}) rotate(${tiltDeg.toFixed(
            1
          )}deg)`,
        },
        {
          transform: `scale(${isCrit ? 1.24 : 1.18}, ${isCrit ? 0.82 : 0.86}) rotate(${(
            -tiltDeg * 0.6
          ).toFixed(1)}deg)`,
        },
        { transform: 'scale(0.95, 1.05) rotate(0deg)' },
        { transform: 'scale(1, 1) rotate(0deg)' },
      ],
      {
        duration: isCrit ? 220 : 175,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }
    );
  };

  const performMatthewClick = (rawX?: number, rawY?: number, isTrusted: boolean = true) => {
    const nowPerf = performance.now();
    const rawCps = updateLiveCps(nowPerf, isTrusted);
    if (rawCps >= 50 && !isMarshallDev) {
      onAutoBan50CpsDetected?.(rawCps);
      return;
    }

    const check = clickGuardRef.current.evaluateClick({
      timestampMs: nowPerf,
      isTrusted,
    });
    if (!check.accepted) {
      if (check.shouldAutoBan && !isMarshallDev) {
        onAutoBan50CpsDetected?.(Math.max(rawCps, Math.round(check.cps)));
        return;
      }
      if (check.shouldFlagProbation) {
        onCheatProbationDetected?.({
          reason: check.reason || 'Autoclicker detected',
          cps: Math.max(rawCps, liveCps, Math.round(check.cps)),
        });
      } else if (check.reason === 'robotic_cadence' || check.reason === 'superhuman_rate') {
        onNotify?.('CLICK GUARD', 'Suspicious automated click pattern detected.');
      }
      return;
    }

    const rect = characterRef.current?.getBoundingClientRect();
    let clientX = rawX || 0;
    let clientY = rawY || 0;

    if ((!clientX || !clientY) && rect) {
      clientX = rect.left + rect.width / 2 + (Math.random() - 0.5) * 36;
      clientY = rect.top + rect.height / 2 + (Math.random() - 0.5) * 36;
    }

    const isCrit = Math.random() < critChance;
    const arcMult = isMarvelArena && arcActiveSec > 0 ? 3 : 1;
    const earned = isCrit
      ? Math.floor(totalPower * critMultiplier * arcMult)
      : Math.floor(totalPower * arcMult);
    const { krillionClickPower } = calculateKrillionProduction(state, liveOpts);
    const krillionEarned =
      krillionClickPower > 0
        ? (isCrit ? krillionClickPower * critMultiplier * arcMult : krillionClickPower * arcMult)
        : 0;

    let bossDmgDealt = 0;
    if (isMarvelArena) {
      if (arcActiveSec <= 0) {
        setArcCharge((prev) => Math.min(250, prev + 1));
      }
      if (activeBoss) {
        bossDmgDealt = Math.max(1, Math.floor(earned * heroSquad.bossDamageMultiplier));
        if (bossFlashOverlayRef.current) {
          bossFlashOverlayRef.current.animate(
            [{ opacity: 0.65 }, { opacity: 0 }],
            { duration: 140, easing: 'ease-out' }
          );
        }
        const nextHp = activeBoss.hp - bossDmgDealt;
        if (nextHp <= 0) {
          awardBossVictory(activeBoss);
          setActiveBoss(null);
        } else {
          setActiveBoss({ ...activeBoss, hp: nextHp });
        }
      }
    }

    if (isCrit) {
      soundManager.playCrit();
    } else {
      soundManager.playClick(state.combo);
    }

    particleEngine.emitClick(clientX, clientY, isCrit, isCrit ? 14 : 9);
    triggerRestartableBounce(isCrit);

    const floatId = Date.now() + Math.random();
    const floatX = clientX + (Math.random() - 0.5) * 60;
    const floatY = clientY - 42;
    const formattedEarned =
      krillionEarned > 0 ? formatKrillion(krillionEarned) : formatCoins(earned);
    const floatValue =
      bossDmgDealt > 0
        ? `💥 -${formatCoins(bossDmgDealt)} DMG!`
        : isCrit
        ? `⚡ CRIT! +${formattedEarned}`
        : `+${formattedEarned}`;

    setFloatingNumbers((prev) => [
      ...prev.slice(-9),
      { id: floatId, x: floatX, y: floatY, value: floatValue, isCrit },
    ]);

    setClickRipples((prev) => [
      ...prev.slice(-5),
      { id: floatId, x: clientX, y: clientY, isCrit },
    ]);

    const activeCursor = getCursorById(state.equippedCursorId);
    if (activeCursor) {
      setCursorEffects((prev) => [
        ...prev.slice(-7),
        {
          id: floatId,
          x: clientX,
          y: clientY,
          cursorId: activeCursor.id,
          accentColor: activeCursor.accentColor,
        },
      ]);
      setTimeout(() => {
        setCursorEffects((prev) => prev.filter((fx) => fx.id !== floatId));
      }, 650);
    }

    setTimeout(() => {
      setFloatingNumbers((prev) => prev.filter((f) => f.id !== floatId));
      setClickRipples((prev) => prev.filter((r) => r.id !== floatId));
    }, 850);

    onEarnCoins(earned, true, isCrit, krillionEarned);
  };

  const performClickRef = useRef(performMatthewClick);
  performClickRef.current = performMatthewClick;

  // Spacebar support: pressing Spacebar acts as a Matthew click!
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (e.repeat) return;
      performClickRef.current(undefined, undefined, e.isTrusted);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Unified Pointer Handler:
  // - Fixes mobile phone 2-4x multi-click bug by using PointerEvents with touch deduplication
  // - Allows both left-click and right-click on laptop trackpads without opening context menu
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const now = performance.now();

    if (e.pointerType === 'touch') {
      if (now - lastTouchTimeRef.current < 45) {
        return;
      }
      lastTouchTimeRef.current = now;
    } else if (e.pointerType === 'mouse') {
      if (now - lastTouchTimeRef.current < 500) {
        return;
      }
      if (e.button !== 0 && e.button !== 2) {
        return;
      }
    }

    performMatthewClick(e.clientX, e.clientY, e.nativeEvent?.isTrusted !== false);
  };

  // Clickable Giant Rare Matthew during Storm Waves
  const handleGiantMatthewClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!isStormActive || !currentWave || !currentWave.giantMatthewAvailable) return;

    const maxClicks = MATTHEW_STORM_CONFIG.giantMatthewMaxClicksPerWave;
    if (giantWaveClicks.clicks >= maxClicks) return;

    const reward = calculateGiantMatthewClickReward(state, liveOpts);
    soundManager.playGiantHit();
    particleEngine.emitClick(e.clientX, e.clientY, true, 16);

    setGiantWaveClicks((prev) => ({
      waveIndex: currentWave.waveIndex,
      clicks: prev.clicks + 1,
    }));

    const floatId = Date.now() + Math.random();
    setFloatingNumbers((prev) => [
      ...prev.slice(-10),
      {
        id: floatId,
        x: e.clientX,
        y: e.clientY - 30,
        value: `+${formatCoins(reward)}`,
        isCrit: true,
      },
    ]);
    setTimeout(() => {
      setFloatingNumbers((prev) => prev.filter((f) => f.id !== floatId));
    }, 850);

    setState((prev) => ({
      ...prev,
      coins: prev.coins + reward,
      lifetimeCoins: prev.lifetimeCoins + reward,
      seasonalScore: prev.seasonalScore + reward,
      giantMatthewsClicked: (prev.giantMatthewsClicked || 0) + 1,
      lastActiveInputTimestamp: Date.now(),
      eventStats: {
        ...prev.eventStats,
        giantMatthewsClicked: prev.eventStats.giantMatthewsClicked + 1,
        giantMatthewRewardsCoins: prev.eventStats.giantMatthewRewardsCoins + reward,
      },
    }));
  };

  const toggleMute = () => {
    const isMuted = soundManager.toggleMute();
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, isMuted },
    }));
  };

  // --- MILESTONE PROGRESS TRACKING (Season-Aware) ---
  const progressionSkins = getProgressionSkinsForSeason(state.currentSeasonId);
  const nextLockedSkin = progressionSkins.find((s) => !state.unlockedSkins.includes(s.id));

  let nextGoalTitle = 'All Main Skins Unlocked';
  let goalPercent = 100;

  if (nextLockedSkin) {
    const skinProgress = getSkinMilestoneProgress(nextLockedSkin, state, cps);
    nextGoalTitle = `${nextLockedSkin.name} (${formatCoins(skinProgress.target)} pts)`;
    goalPercent = skinProgress.percent;
  }

  const activeSpriteUrl = imgSrcOverride || equippedSkin.image;

  const giantClicksRemaining =
    currentWave && currentWave.giantMatthewAvailable
      ? Math.max(0, MATTHEW_STORM_CONFIG.giantMatthewMaxClicksPerWave - giantWaveClicks.clicks)
      : 0;

  const isSeason3 = isSeasonThreeOrLater(state.currentSeasonId);
  const isSeason2 = isSeasonTwoOrLater(state.currentSeasonId);
  const skinBgTheme = getSkinBackgroundTheme(equippedSkin);

  return (
    <div className="relative flex-1 flex flex-col items-center justify-between h-full p-2.5 sm:p-4 select-none overflow-hidden">
      {/* 1. ATMOSPHERIC, SKIN-MATCHED, SEASON 2 FROZEN OR SEASON 3 MARVEL BACKGROUND */}
      {!isSeason2 && (
        <EnvironmentBackground
          state={state}
          isStormActive={isStormActive}
          stormWaveActive={Boolean(currentWave)}
        />
      )}
      {isSeason3 ? (
        <MarvelBackground
          theme={skinBgTheme}
          isStormActive={isStormActive}
          stormWaveActive={Boolean(currentWave)}
          combo={state.combo || 0}
          unlockedSkinImages={(state.unlockedSkins?.length ? state.unlockedSkins : ['classic_matthew']).map(
            (id) => getSkinById(id).image
          )}
          reducedMotion={state.settings.reducedMotion}
        />
      ) : (
        <FrozenBackground
          theme={skinBgTheme}
          isFrozenApocalypse={isSeason2}
          isRaidActive={false}
          isStormActive={isStormActive}
          stormWaveActive={Boolean(currentWave)}
          combo={state.combo || 0}
          unlockedSkinImages={(state.unlockedSkins?.length ? state.unlockedSkins : ['classic_matthew']).map(
            (id) => getSkinById(id).image
          )}
          reducedMotion={state.settings.reducedMotion}
        />
      )}

      {/* 2. TOP BAR: NAVIGATION, ACCOUNT, LEADERBOARD, DEV TOOLS (MARSHALLB78), GEMS & LIVE BANNERS */}
      <div className="w-full flex flex-col gap-2 z-20">
        <div className="w-full flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={toggleMute}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 hover:border-amber-400/70 flex items-center justify-center text-slate-300 hover:text-white transition shadow-lg active:scale-90 cursor-pointer"
              title={state.settings.isMuted ? 'Unmute' : 'Mute'}
            >
              {state.settings.isMuted ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              )}
            </button>

            <button
              onClick={onOpenSettings}
              className="px-2.5 h-9 sm:h-10 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 hover:border-cyan-400/70 flex items-center gap-1.5 text-slate-300 hover:text-white transition shadow-lg active:scale-90 cursor-pointer"
              title="Game Menu, Settings & Account (Press ESC)"
            >
              <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              <span className="text-[11px] font-black text-cyan-200 hidden sm:inline">Menu (ESC)</span>
            </button>

            <button
              onClick={onOpenAccount}
              className="px-2.5 h-9 sm:h-10 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 hover:border-emerald-400/70 flex items-center gap-1.5 text-xs font-black text-slate-200 hover:text-white transition shadow-lg cursor-pointer"
              title="Sign In / Cloud Account"
            >
              <User className="w-4 h-4 text-emerald-400" />
              <span className="max-w-[110px] truncate">
                {state.cloudAccount?.displayUsername || state.cloudAccount?.username || 'Sign In'}
              </span>
            </button>

            <button
              onClick={onOpenLeaderboard}
              className="px-2.5 h-9 sm:h-10 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 hover:border-yellow-400/70 flex items-center gap-1.5 text-xs font-black text-yellow-300 hover:text-white transition shadow-lg cursor-pointer"
              title={`Worldwide Seasonal Leaderboard (${Math.max(
                state.cloudAccount ? 1 : 0,
                onlinePlayersCount
              )} Online)`}
            >
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="hidden sm:inline">Leaderboard</span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-black text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{Math.max(state.cloudAccount ? 1 : 0, onlinePlayersCount)}</span>
              </span>
            </button>

            {/* EXCLUSIVE AUTHORIZED DEV TOOLS BUTTON */}
            {isMarshallDev && onOpenDevTools && (
              <button
                onClick={onOpenDevTools}
                className="relative px-3 h-9 sm:h-10 rounded-lg bg-gradient-to-r from-amber-500/30 to-red-500/30 backdrop-blur-md border border-amber-400/70 text-amber-200 hover:text-white hover:border-yellow-300 flex items-center gap-1.5 text-xs font-black transition shadow-[0_0_20px_rgba(251,191,36,0.35)] cursor-pointer"
                title="Developer Controls (Password Required)"
              >
                <Wrench className="w-4 h-4 text-amber-300" />
                <span>Dev Tools</span>
                {probationAlertCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black leading-none animate-pulse shadow">
                    {probationAlertCount}
                  </span>
                )}
              </button>
            )}

            {/* SINGLE UNIFIED DEV TEST MENU BUTTON (Devs Only During Testing) */}
            {isSandbox && isAuthorizedDevUid(state.cloudAccount?.uid) && onOpenDevTestMenu && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDevTestMenu();
                }}
                className="px-3 h-9 sm:h-10 rounded-xl bg-gradient-to-r from-amber-500/35 to-rose-500/35 border border-amber-300/80 text-amber-100 hover:text-white hover:brightness-110 flex items-center gap-1.5 text-xs font-black uppercase shadow-lg cursor-pointer"
                title="Open Complete Season 3 Dev Test Menu"
              >
                <Wrench className="w-4 h-4 text-amber-300" />
                <span>Dev Menu</span>
              </button>
            )}

            {/* STORM SHOP BUTTON: ONLY SHOWN WHEN LIVE EVENT IS ACTIVE! */}
            {isStormActive && (
              <button
                onClick={onOpenStormShop}
                className="px-3 h-9 sm:h-10 rounded-2xl bg-purple-950/95 backdrop-blur-md border-2 border-fuchsia-400 text-fuchsia-200 hover:bg-purple-900 flex items-center gap-1.5 text-xs font-black transition shadow-[0_0_20px_rgba(217,70,239,0.5)] animate-pulse cursor-pointer"
                title="Secret Matthew Storm Event Shop (Only open during the live event!)"
              >
                <ShoppingBag className="w-4 h-4 text-fuchsia-300" />
                <span>Storm Shop</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/90 border-2 border-fuchsia-500/50 text-xs font-black text-fuchsia-300 shadow-md"
              title="Gems (Earn 3/10m normal active play, 10/10m during Matthew Storm, +5 Daily Login)"
            >
              <Gem className="w-4 h-4 text-fuchsia-400" />
              <span>{state.gems}</span>
              <span className="text-[10px] text-slate-400 uppercase hidden sm:inline">Gems</span>
            </div>

            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/90 border-2 border-purple-500/50 text-xs font-black text-purple-300 shadow-md"
              title="Ascension Multiplier (Multiplies all Click Power & CPS)"
            >
              <InfinityIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>Ascension:</span>
              <span className="text-yellow-300">{ascensionMultiplier.toFixed(2)}×</span>
            </div>

            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-900/85 border border-slate-700 text-[11px] font-bold text-slate-300"
              title="Weekly Competitive Season"
            >
              <span className="text-amber-400 font-black">{seasonLabel}</span>
              <span className="text-slate-400">• {formatTime(seasonRemainingSec)}</span>
            </div>
          </div>
        </div>

        {/* SECOND ROW: FRIDAY BONUS & MATTHEW STORM BANNER */}
        <div className="w-full flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {fridayBonusActive && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black text-xs shadow-lg border border-emerald-300/50">
                <Zap className="w-3.5 h-3.5" />
                <span>FRIDAY 2× POINTS ACTIVE!</span>
              </div>
            )}

            {state.frenzyTimer > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-red-500 to-amber-500 text-white font-extrabold text-xs shadow-lg shadow-amber-500/40 animate-pulse">
                <Flame className="w-4 h-4" />
                <span>
                  {state.frenzyMultiplier}X FRENZY ({Math.ceil(state.frenzyTimer)}s)
                </span>
              </div>
            )}

            {(stormState.status === 'pre_countdown' || stormState.status === 'inactive') && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/90 border border-purple-500/60 text-purple-200 text-xs font-black shadow-md">
                <span>⚡ Matthew Storm Live Event:</span>
                <span className="text-amber-300 font-mono">
                  {formatTime(stormState.secondsUntilStart)}
                </span>
              </div>
            )}

            {isStormActive && (
              <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-purple-700 via-fuchsia-600 to-indigo-700 border-2 border-yellow-300/80 text-white text-xs font-black shadow-[0_0_24px_rgba(217,70,239,0.65)] animate-pulse">
                <Zap className="w-4 h-4 text-yellow-300 animate-bounce" />
                <span>
                  ALL-DAY FRIDAY STORM •{' '}
                  {currentWave
                    ? `WAVE #${currentWave.waveIndex}: ${currentWave.multiplier}× SURGE (${formatTime(
                        currentWave.remainingWaveSeconds
                      )})`
                    : `${MATTHEW_STORM_CONFIG.baseStormMultiplier}× STORM MULTIPLIER`}
                </span>
                <span className="text-yellow-200 font-mono" title="Ends Friday Midnight -> Weekend Downtime">
                  [{formatTime(stormState.secondsUntilEnd)} → Midnight Downtime]
                </span>
              </div>
            )}

            {isProbationActive && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border-2 bg-amber-950/95 border-amber-400 text-amber-100 text-xs font-black shadow-lg animate-pulse">
                <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
                <span>⚠️ Your account is under probation — flagged for admin review.</span>
              </div>
            )}

            {serverBroadcast && serverBroadcast.active && (
              <div
                className={`flex items-center gap-2 px-3.5 py-1 rounded-full border-2 text-xs font-black shadow-lg animate-pulse ${
                  serverBroadcast.theme === 'red'
                    ? 'bg-red-950/95 border-red-400 text-red-100'
                    : serverBroadcast.theme === 'cyan'
                    ? 'bg-cyan-950/95 border-cyan-400 text-cyan-100'
                    : serverBroadcast.theme === 'purple'
                    ? 'bg-purple-950/95 border-fuchsia-400 text-fuchsia-100'
                    : 'bg-amber-950/95 border-yellow-400 text-yellow-100'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5 shrink-0" />
                <span>[ADMIN] {serverBroadcast.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. TOP HUD: [LEFT: TOP 3 MINI LEADERBOARD] — [CENTER: MATTHEW COINS] — [RIGHT: LIVE CPS] */}
      <div className="relative flex flex-col items-center z-20 my-auto sm:my-1 w-full">
        {/* TOP 3 MINI LEADERBOARD ON THE LEFT SIDE OF THE MONEY */}
        {top3Players.length > 0 && (
          <div
            onClick={onOpenLeaderboard}
            title="Click to open full Leaderboard & inspect player Playtime"
            className="hidden sm:flex flex-col gap-1 absolute left-1 sm:left-2 top-0 z-30 w-44 md:w-52 p-2.5 rounded-xl bg-black/50 backdrop-blur-md hover:bg-black/65 shadow-[0_8px_28px_rgba(0,0,0,0.45)] cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-0.5">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-yellow-300">
                  Top 3 Leaders
                </span>
              </div>
              <span className="flex items-center gap-1 text-[9px] font-black text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{Math.max(state.cloudAccount ? 1 : 0, onlinePlayersCount)} Online</span>
              </span>
            </div>

            {top3Players.slice(0, 3).map((entry, idx) => {
              const rank = idx + 1;
              const skin = getSkinById(entry.equippedSkin);
              const isMe = state.cloudAccount?.uid === entry.uid;
              const isOnline = isLeaderboardPlayerOnline(entry, state.cloudAccount?.uid);

              return (
                <div
                  key={entry.uid}
                  className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg ${
                    rank === 1
                      ? 'bg-yellow-500/15'
                      : isMe
                      ? 'bg-cyan-500/15'
                      : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-4 h-4 rounded-md text-[9px] font-black flex items-center justify-center shrink-0 ${
                        rank === 1
                          ? 'bg-yellow-400 text-slate-950'
                          : rank === 2
                          ? 'bg-slate-300 text-slate-950'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      #{rank}
                    </span>
                    <div className="relative shrink-0">
                      <img
                        src={skin.image}
                        alt={skin.name}
                        className="w-5 h-5 rounded object-contain"
                      />
                      {isOnline && (
                        <span
                          title="Online Now"
                          className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-slate-950 shadow-[0_0_5px_#34d399]"
                        />
                      )}
                    </div>
                    <span className="text-[11px] font-black text-white truncate">
                      {entry.username}
                    </span>
                    {rank === 1 && <Crown className="w-3 h-3 text-yellow-300 shrink-0" />}
                  </div>
                  <span className="text-[10px] font-black text-amber-300 shrink-0">
                    {formatExtendedCoins(entry.seasonalScore, entry.krillionScore || 0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* STARK COMMAND MONEY & GEMS HUD OVERHAUL (Chromebook-Responsive) */}
        <div className="mb-1.5 px-4 py-2 xl:px-5 xl:py-3 rounded-3xl bg-gradient-to-b from-slate-950/90 via-[#1a0b16]/85 to-slate-950/90 border-2 border-amber-400/45 shadow-[0_0_28px_rgba(220,38,38,0.25)] flex flex-col items-center">
          <div className="mb-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-fuchsia-950/60 border border-fuchsia-400/40">
            <Gem className="w-3.5 h-3.5 text-fuchsia-300" />
            <span className="text-xs font-black text-fuchsia-100">{state.gems}</span>
            <span className="text-[10px] font-bold text-fuchsia-300/90 uppercase">Gems</span>
          </div>

          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            {/* ARC REACTOR MATTHEW COINS COUNTER */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 xl:w-12 xl:h-12 rounded-2xl bg-gradient-to-br from-rose-600 via-amber-400 to-yellow-200 p-0.5 shadow-[0_0_18px_rgba(251,191,36,0.5)]">
                <div className="w-full h-full rounded-[13px] bg-slate-950 flex items-center justify-center font-marvel text-lg xl:text-2xl font-black text-amber-300">
                  M
                </div>
              </div>
              <span className="text-3xl sm:text-5xl xl:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-300 to-rose-400 tracking-wide font-marvel drop-shadow-[0_3px_0_#450a0a]">
                {formatExtendedCoins(state.coins, state.krillionCoins || 0)}
              </span>
            </div>

            {/* LIVE CPS COUNTER */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 xl:px-3 xl:py-1.5 rounded-2xl border transition-all shadow-lg ${
                liveCps >= 12
                  ? 'bg-rose-950/80 border-rose-400/60 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.45)] scale-105'
                  : liveCps > 0
                  ? 'bg-amber-950/60 border-amber-400/50 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.28)]'
                  : 'bg-slate-950/75 border-white/10 text-slate-300'
              }`}
              title="Your live real-time Clicks Per Second (CPS)"
            >
              <Gauge
                className={`w-4 h-4 ${
                  liveCps >= 12
                    ? 'text-rose-400 animate-pulse'
                    : liveCps > 0
                    ? 'text-amber-300'
                    : 'text-slate-400'
                }`}
              />
              <div className="flex flex-col leading-none">
                <span className="text-xs sm:text-base xl:text-lg font-black font-mono">
                  {liveCps} <span className="text-[10px] uppercase">CPS</span>
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">Live Speed</span>
              </div>
            </div>
          </div>

          {/* CLICK POWER + PASSIVE CPS HUD */}
          {(() => {
            const krProd = calculateKrillionProduction(state, liveOpts);
            return (
              <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
                <div className="flex items-center gap-1 px-2.5 py-0.5 xl:py-1 rounded-xl bg-slate-900/80 border border-amber-400/30 text-xs font-black text-amber-200 shadow-md">
                  <Zap className="w-3 h-3 text-yellow-300 fill-yellow-300" />
                  <span className="text-yellow-300">
                    +{krProd.krillionClickPower > 0 ? formatKrillion(krProd.krillionClickPower) : formatCoins(totalPower)}
                  </span>
                  <span className="text-amber-100/80">per click</span>
                </div>

                <div className="flex items-center gap-1 px-2.5 py-0.5 xl:py-1 rounded-xl bg-slate-900/80 border border-rose-400/30 text-xs font-bold text-slate-200 shadow-md">
                  <span className="text-rose-300 font-black">
                    {krProd.krillionCps > 0 ? formatKrillion(krProd.krillionCps) : formatCoins(cps)}
                  </span>
                  <span className="text-slate-400">/ sec</span>
                </div>

                {(fridayBonusActive || stormWaveMultiplier > 1) && (
                  <span className="px-2 py-0.5 rounded-lg bg-fuchsia-600/35 text-[10px] text-fuchsia-200 font-black">
                    {(fridayBonusActive ? 2 : 1) * stormWaveMultiplier}× LIVE BOOST!
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* CRIT STAT BADGE */}
        <div className="mt-2 flex items-center justify-center bg-black/45 backdrop-blur-md px-3.5 py-1 rounded-xl shadow-lg text-[11px] font-black text-amber-300 font-mono">
          {Math.round(critChance * 100)}% Crit ({critMultiplier}×)
        </div>

        {/* NEXT SKIN GOAL MILESTONE PROGRESS BAR (CLICK TO VIEW MYSTERY SKIN NAMES LADDER) */}
        <button
          type="button"
          onClick={() => setShowSkinLadderModal(true)}
          title="Click to see the names of all unlockable progression skins"
          className="mt-1.5 flex flex-col items-center gap-1 bg-black/45 hover:bg-black/65 border border-white/10 hover:border-amber-400/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-md max-w-xs w-full cursor-pointer transition text-left"
        >
          <div className="flex items-center justify-between w-full text-[11px] font-black">
            <span className="flex items-center gap-1 text-slate-200 truncate pr-2">
              <Target className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">Next Skin: {nextGoalTitle}</span>
            </span>
            <span className="text-amber-300 font-mono shrink-0">{goalPercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300 shadow-sm shadow-yellow-400/50"
              style={{ width: `${goalPercent}%` }}
            />
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300/90">
            Tap to view unlockable skin names ({progressionSkins.length - 1} total)
          </span>
        </button>
      </div>

      {/* 4. CENTRAL HERO MATTHEW CHARACTER (Sized cleanly for Chromebooks + Desktop) */}
      <div
        className={`relative flex-1 min-h-0 flex flex-col items-center justify-center w-full py-1 ${
          isSeason2 ? 'z-[12] pb-2 xl:pb-4' : 'z-10'
        }`}
      >

        <style>{`
          @keyframes clickerBreathPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.045); }
          }
          @keyframes clickerRingPulse {
            0% { transform: translate(-50%, -50%) scale(0.82); opacity: 0.75; }
            70% { transform: translate(-50%, -50%) scale(1.22); opacity: 0.15; }
            100% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
          }
          @keyframes clickRippleBurst {
            0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.95; }
            100% { transform: translate(-50%, -50%) scale(2.1); opacity: 0; }
          }
        `}</style>

        <div
          ref={characterRef}
          onPointerDown={handlePointerDown}
          onContextMenu={(e) => e.preventDefault()}
          className="group relative flex items-center justify-center cursor-pointer select-none transition-transform duration-100 ease-out"
          style={{
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          {/* SPINNING SUNBURST LINES BEHIND MATTHEW */}
          {!state.settings.reducedMotion && (
            <>
              <svg
                viewBox="0 0 200 200"
                className="absolute w-72 h-72 sm:w-96 sm:h-96 md:w-[27rem] md:h-[27rem] pointer-events-none animate-spin opacity-65 group-hover:opacity-90 transition-opacity will-change-transform"
                style={{
                  animationDuration: state.combo > 5 ? '6s' : '12s',
                }}
              >
                <defs>
                  <radialGradient id="sunburstGrad" cx="50%" cy="50%" r="50%">
                    <stop
                      offset="0%"
                      stopColor={isStormActive ? '#e879f9' : '#facc15'}
                      stopOpacity="0.55"
                    />
                    <stop
                      offset="60%"
                      stopColor={isStormActive ? '#22d3ee' : '#f59e0b'}
                      stopOpacity="0.22"
                    />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {Array.from({ length: 12 }).map((_, idx) => {
                  const angle = idx * 30;
                  return (
                    <polygon
                      key={idx}
                      points="100,100 90,4 110,4"
                      fill="url(#sunburstGrad)"
                      transform={`rotate(${angle} 100 100)`}
                    />
                  );
                })}
              </svg>

              {/* OUTER SPINNING DASHED ENERGY RING */}
              <div
                className={`absolute w-60 h-60 sm:w-80 sm:h-80 md:w-92 md:h-92 rounded-full border-[3px] border-dashed pointer-events-none animate-spin will-change-transform ${
                  isStormActive
                    ? 'border-fuchsia-400/70'
                    : 'border-amber-400/65 group-hover:border-yellow-300'
                }`}
                style={{ animationDuration: '9s' }}
              />

              {/* INNER COUNTER-SPINNING CYAN RING */}
              <div
                className="absolute w-52 h-52 sm:w-68 sm:h-68 md:w-80 md:h-80 rounded-full border-2 border-dotted border-cyan-400/60 pointer-events-none animate-spin will-change-transform"
                style={{
                  animationDuration: '7s',
                  animationDirection: 'reverse',
                }}
              />

              {/* PULSING SHOCKWAVE RINGS */}
              <div
                className={`absolute top-1/2 left-1/2 w-56 h-56 sm:w-72 sm:h-72 rounded-full border-2 pointer-events-none ${
                  isStormActive ? 'border-fuchsia-400' : 'border-amber-400'
                }`}
                style={{ animation: 'clickerRingPulse 1.8s ease-out infinite' }}
              />
              <div
                className="absolute top-1/2 left-1/2 w-56 h-56 sm:w-72 sm:h-72 rounded-full border-2 border-cyan-400 pointer-events-none"
                style={{ animation: 'clickerRingPulse 1.8s ease-out 0.9s infinite' }}
              />
            </>
          )}

          {/* PULSING PRESSABLE HERO CHARACTER */}
          <div
            style={{
              animation: state.settings.reducedMotion
                ? undefined
                : 'clickerBreathPulse 1.5s ease-in-out infinite',
            }}
          >
            <div
              ref={spriteContainerRef}
              className={`relative w-44 h-44 sm:w-56 sm:h-56 md:w-60 md:h-60 xl:w-72 xl:h-72 max-w-[74vw] ${
                isMarvelArena
                  ? 'max-h-[32vh] xl:max-h-[38vh]'
                  : isSeason2
                  ? 'max-h-[36vh] xl:max-h-[44vh]'
                  : 'max-h-[42vh] xl:max-h-[48vh]'
              } flex items-center justify-center group-hover:scale-105 transition-transform duration-150 will-change-transform ${
                activeBoss ? 'rounded-full border-2 border-rose-500/80 bg-rose-950/25' : ''
              }`}
              style={{ transformOrigin: '49.3% 50.1%' }}
            >
              {activeBoss && (
                <>
                  <div className="absolute -top-3 z-20 px-3 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest border border-rose-200 shadow">
                    ⚔️ HIT {activeBoss.spec.name}!
                  </div>
                  <div
                    ref={bossFlashOverlayRef}
                    className="absolute inset-0 rounded-full bg-rose-500 opacity-0 pointer-events-none z-10"
                  />
                </>
              )}
              <img
                src={activeBoss ? activeBoss.spec.image : activeSpriteUrl}
                alt={activeBoss ? activeBoss.spec.name : equippedSkin.name}
                draggable={false}
                onError={() => {
                  const fallback =
                    equippedSkin.fallbackImage || './images/skins/classic_matthew.png';
                  if (!activeBoss && activeSpriteUrl !== fallback) {
                    setImgSrcOverride(fallback);
                  }
                }}
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* SEASON 3 MARVEL ARENA HUD (STRIKE TEAM + BOSS ENCOUNTERS + ARC REACTOR) */}
        {isMarvelArena && (
          <div className="mt-5 sm:mt-7 w-full">
            <MarvelArenaHud
              squad={heroSquad}
              arcCharge={arcCharge}
              arcMaxCharge={250}
              arcActiveSec={arcActiveSec}
              activeBoss={activeBoss}
              bossCooldownSec={bossCooldownSec}
              onActivateArc={handleActivateArc}
              onSummonBoss={handleSummonBoss}
            />
          </div>
        )}

        {/* FRIDAY MATTHEW STORM AMBIENT ATMOSPHERE & ELECTRIC VIGNETTE */}
        {isStormActive && (
          <div className="fixed inset-0 pointer-events-none z-[18] border-[4px] border-fuchsia-400/50 shadow-[inset_0_0_110px_rgba(192,38,211,0.38)] animate-pulse" />
        )}

        {/* FULL-SCREEN CLICKABLE GIANT RARE MATTHEW BOSS TARGET (100× POINTS!) */}
        {isStormActive && currentWave && currentWave.giantMatthewAvailable && giantClicksRemaining > 0 && (
          <div
            onClick={handleGiantMatthewClick}
            className="fixed inset-0 z-[58] bg-gradient-to-b from-fuchsia-950/60 via-purple-950/50 to-slate-950/65 backdrop-blur-[2px] flex flex-col items-center justify-center cursor-pointer select-none group overflow-hidden"
            title="MASSIVE 100× GIANT MATTHEW! Click anywhere on Giant Matthew!"
          >
            {!state.settings.reducedMotion && (
              <>
                <div
                  className="absolute w-[95vmin] h-[95vmin] rounded-full border-[6px] border-dashed border-yellow-300/75 animate-spin pointer-events-none will-change-transform"
                  style={{ animationDuration: '5s' }}
                />
                <div
                  className="absolute w-[82vmin] h-[82vmin] rounded-full border-4 border-fuchsia-400/80 animate-ping pointer-events-none"
                  style={{ animationDuration: '1.1s' }}
                />
              </>
            )}
            <div className="relative z-20 mb-2 px-5 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-fuchsia-400 text-slate-950 font-black text-xs sm:text-base uppercase tracking-wider shadow-[0_0_30px_rgba(250,204,21,0.9)] animate-bounce pointer-events-none">
              ⚡ GIANT MATTHEW • 100× POINTS PER CLICK! ({giantClicksRemaining} Left) ⚡
            </div>
            <img
              src="./images/skins/classic_matthew.png"
              alt="Giant Matthew"
              draggable={false}
              className="relative z-10 w-[78vmin] h-[78vmin] sm:w-[82vmin] sm:h-[82vmin] max-w-[94vw] max-h-[82vh] object-contain drop-shadow-[0_0_55px_rgba(250,204,21,0.85)] group-hover:scale-105 group-active:scale-95 transition-transform will-change-transform"
            />
          </div>
        )}
      </div>

      {/* 5. CLICK SHOCKWAVE RIPPLES + PER-CURSOR CLICK EFFECTS */}
      {cursorEffects.map((fx) => (
        <div
          key={`cursor-fx-${fx.id}`}
          className="fixed pointer-events-none z-40"
          style={{
            left: fx.x,
            top: fx.y,
            animation: 'cursorFxBurst 0.65s ease-out forwards',
          }}
        >
          {fx.cursorId === 'web_shooter_cursor' ? (
            <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_8px_rgba(255,255,255,0.85)]">
              <g stroke="#ffffff" strokeWidth="2.2" fill="none" opacity="0.92">
                <line x1="50" y1="50" x2="50" y2="4" />
                <line x1="50" y1="50" x2="82" y2="18" />
                <line x1="50" y1="50" x2="96" y2="50" />
                <line x1="50" y1="50" x2="82" y2="82" />
                <line x1="50" y1="50" x2="50" y2="96" />
                <line x1="50" y1="50" x2="18" y2="82" />
                <line x1="50" y1="50" x2="4" y2="50" />
                <line x1="50" y1="50" x2="18" y2="18" />
                <circle cx="50" cy="50" r="14" />
                <circle cx="50" cy="50" r="28" />
                <circle cx="50" cy="50" r="42" />
              </g>
            </svg>
          ) : fx.cursorId === 'mjolnir_cursor' || fx.cursorId === 'stormbreaker_cursor' ? (
            <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-[0_0_12px_#38bdf8]">
              <path
                d="M55 6 L30 48 L48 48 L38 94 L74 44 L54 44 Z"
                fill="#7dd3fc"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
            </svg>
          ) : fx.cursorId === 'vibranium_shield_cursor' ? (
            <div className="w-20 h-20 rounded-full border-4 border-rose-500 flex items-center justify-center shadow-[0_0_18px_rgba(239,68,68,0.8)]">
              <div className="w-12 h-12 rounded-full border-4 border-white flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-blue-600" />
              </div>
            </div>
          ) : fx.cursorId === 'infinity_gauntlet_cursor' ? (
            <div className="w-24 h-24 rounded-full border-4 border-amber-300 shadow-[0_0_24px_#facc15,inset_0_0_16px_#a855f7]" />
          ) : (
            <div
              className="w-20 h-20 rounded-full border-4"
              style={{
                borderColor: fx.accentColor,
                boxShadow: `0 0 22px ${fx.accentColor}`,
              }}
            />
          )}
        </div>
      ))}

      {clickRipples.map((r) => (
        <div
          key={`ripple-${r.id}`}
          className={`fixed pointer-events-none z-40 rounded-full border-2 ${
            isSeason2
              ? r.isCrit
                ? 'w-24 h-24 border-cyan-200 bg-cyan-300/20 shadow-[0_0_24px_rgba(103,232,249,0.8)]'
                : 'w-20 h-20 border-sky-300 bg-sky-400/10'
              : r.isCrit
              ? 'w-20 h-20 border-cyan-300'
              : 'w-20 h-20 border-amber-300'
          }`}
          style={{
            left: r.x,
            top: r.y,
            animation: 'clickRippleBurst 0.55s ease-out forwards',
          }}
        />
      ))}

      {/* 6. FLOATING COIN DAMAGE POPUPS */}
      {floatingNumbers.map((f) => (
        <div
          key={f.id}
          className={`fixed pointer-events-none font-black z-50 select-none font-chunky ${
            f.isCrit
              ? 'animate-float-crit text-cyan-200 text-3xl sm:text-4xl drop-shadow-[0_4px_12px_rgba(34,211,238,0.85)]'
              : 'animate-float-coin text-amber-300 text-2xl sm:text-3xl drop-shadow-[0_2px_0_#78350f]'
          }`}
          style={{
            left: f.x,
            top: f.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {f.value}
        </div>
      ))}

      {/* MYSTERY PROGRESSION SKINS LADDER MODAL (Names & Requirements Only — No Artwork Spoilers) */}
      {showSkinLadderModal && (
        <div
          className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowSkinLadderModal(false)}
        >
          <div
            className="w-full max-w-lg max-h-[82vh] flex flex-col rounded-3xl bg-[#0e1529] border-2 border-amber-400/60 shadow-[0_0_50px_rgba(251,191,36,0.28)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-950/90 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/60 flex items-center justify-center text-amber-300">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black uppercase text-white">
                    Unlockable Skin Names
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    Artwork stays hidden until you unlock each milestone!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSkinLadderModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {progressionSkins
                .filter((s) => s.milestone.type !== 'free')
                .map((skin, idx) => {
                  const unlocked = state.unlockedSkins.includes(skin.id);
                  const isNext = nextLockedSkin?.id === skin.id;
                  const prog = getSkinMilestoneProgress(skin, state, cps);
                  return (
                    <div
                      key={skin.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                        unlocked
                          ? 'bg-emerald-950/35 border-emerald-400/50'
                          : isNext
                          ? 'bg-amber-950/35 border-amber-400/75 ring-1 ring-amber-400/40'
                          : 'bg-slate-950/85 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                            unlocked
                              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                              : isNext
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          {unlocked ? (
                            <Check className="w-5 h-5 stroke-[3]" />
                          ) : (
                            <HelpCircle className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-black text-slate-500">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-black text-white truncate">
                              {skin.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[9px] font-black uppercase text-cyan-300">
                              {skin.rarity}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                            {skin.milestone.description}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {unlocked ? (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-[10px] uppercase">
                            Unlocked
                          </span>
                        ) : isNext ? (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-200 font-black text-[10px] uppercase">
                            Up Next • {prog.percent}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 text-slate-400 font-black text-[10px] uppercase">
                            <Lock className="w-3 h-3" />
                            <span>Locked</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
