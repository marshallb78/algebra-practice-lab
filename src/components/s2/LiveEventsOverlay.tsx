import React, { useEffect, useRef, useState } from 'react';
import { Snowflake, Flame, Zap, X, ShieldAlert, Lock, Minimize2, Maximize2, Sparkles } from 'lucide-react';
import { GameState } from '../../types/game';
import {
  ActiveGlobalLiveEvent,
  PLAYER_TRIGGERABLE_EVENTS,
  PlayerEventCostSpec,
  fetchMarathonLeaderboard,
  submitMarathonScore,
  summonGlobalLiveEvent,
} from '../../firebase/liveEvents';
import { SEASON_2_LIVE_EVENT_SKINS } from '../../data/season2Skins';
import { formatCoins, formatNumber } from '../../utils/formatters';

interface LiveEventsModalProps {
  state: GameState;
  isSandbox: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNotify: (title: string, subtitle?: string) => void;
  onClose: () => void;
}

export const LiveEventsHubModal: React.FC<LiveEventsModalProps> = ({
  state,
  isSandbox,
  onUpdateState,
  onNotify,
  onClose,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const uid = state.cloudAccount?.uid || 'local_tester';
  const username = state.cloudAccount?.displayUsername || state.cloudAccount?.username || 'Player';

  const handleSummon = async (spec: PlayerEventCostSpec & { id: string }) => {
    if (state.gems < spec.gemCost) return;
    setBusyId(spec.id);
    const res = await summonGlobalLiveEvent({
      spec,
      uid,
      username,
      isSandbox,
    });
    setBusyId(null);
    if (res.ok) {
      onUpdateState((prev) => ({
        ...prev,
        gems: Math.max(0, prev.gems - spec.gemCost),
      }));
      onNotify('EVENT SUMMONED!', `${username} summoned ${spec.label}!`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/96 backdrop-blur-xl flex flex-col p-4 sm:p-6 overflow-hidden select-none">
      <div className="flex items-center justify-between pb-4 border-b border-amber-400/25">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-300" />
            <span>SEASON 2 LIVE EVENTS &amp; PLAYER SUMMONS</span>
          </h2>
          <p className="text-xs font-bold text-slate-300">
            Spend Gems to summon server-wide mini-events or browse Next-Friday Live Event Exclusives!
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLAYER_TRIGGERABLE_EVENTS.map((spec) => (
            <div
              key={spec.id}
              className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="text-sm font-black text-white">{spec.label}</div>
                <p className="text-xs font-bold text-slate-400 mt-1">{spec.description}</p>
              </div>
              <button
                onClick={() => handleSummon(spec)}
                disabled={state.gems < spec.gemCost || busyId === spec.id}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-xs uppercase cursor-pointer transition"
              >
                {busyId === spec.id ? 'Summoning...' : `Summon (${spec.gemCost} Gems)`}
              </button>
            </div>
          ))}
        </div>

        {/* Preview of Next-Friday Live Event Exclusives (No Spoilers Until Unlocked!) */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-400/35">
          <h3 className="text-sm font-black uppercase text-purple-300 mb-3">
            Friday Live Event Exclusives (No Spoilers Until Unlocked)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SEASON_2_LIVE_EVENT_SKINS.map((s) => {
              const isUnlocked = (state.unlockedSkins || []).includes(s.id);
              return (
                <div
                  key={s.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3"
                >
                  {isUnlocked ? (
                    <img src={s.image} alt={s.name} className="w-12 h-12 object-contain" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-purple-400/30 flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5 text-purple-300/80" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-black text-white">
                      {isUnlocked ? s.name : '??? Mystery Event Skin'}
                    </div>
                    <div className="text-[11px] font-bold text-purple-300">
                      {isUnlocked
                        ? s.description
                        : 'Join All-Day Friday Blizzard Events to uncover this secret skin.'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ActiveGlobalEventOverlayProps {
  event: ActiveGlobalLiveEvent;
  currentUid: string;
  currentUsername: string;
  currentCoins: number;
  isSandbox: boolean;
  hasFireCursor?: boolean;
  onAwardCoins: (amount: number, reason: string) => void;
  onAwardGems: (amount: number) => void;
}

interface FallingTargetItem {
  id: number;
  left: number;
  top: number;
  vx: number;
  speed: number;
  isGolden: boolean;
}

/**
 * Renders live global server events:
 * - Click Events (Click Marathon, Falling Matthews, 100 Golden Rain) open an interactive Pop-Up Event Arena!
 * - Screen Freeze freezes non-summoners unless they wield the Fire Cursor (which melts through ice!).
 * - Zombie Boss Raid summons Cryo Titan Bosses & highlights the active raid!
 */
export const ActiveGlobalEventOverlay: React.FC<ActiveGlobalEventOverlayProps> = ({
  event,
  currentUid,
  currentUsername,
  currentCoins,
  isSandbox,
  hasFireCursor = false,
  onAwardCoins,
  onAwardGems,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.ceil((event.endsAtMs - Date.now()) / 1000))
  );
  const [marathonClicks, setMarathonClicks] = useState(0);
  const [marathonStartMs, setMarathonStartMs] = useState(Date.now());
  const [leaders, setLeaders] = useState<{ uid: string; username: string; clicks: number }[]>([]);
  const [fallingItems, setFallingItems] = useState<FallingTargetItem[]>([]);
  const [caughtCount, setCaughtCount] = useState(0);
  const [earnedEventCoins, setEarnedEventCoins] = useState(0);
  const [earnedEventGems, setEarnedEventGems] = useState(0);
  const [clickBurstText, setClickBurstText] = useState<string | null>(null);
  const [isPopupMinimized, setIsPopupMinimized] = useState(false);
  const [freezeCracks, setFreezeCracks] = useState(0);

  const settledRef = useRef<string | null>(null);
  const marathonClicksRef = useRef(0);
  marathonClicksRef.current = marathonClicks;
  const currentCoinsRef = useRef(currentCoins);
  currentCoinsRef.current = currentCoins;

  const isAffected =
    !event.excludeSummoner || (event.summonedByUid && event.summonedByUid !== currentUid);

  const isClickEvent =
    event.type === 'click_marathon' ||
    event.type === 'falling_matthews' ||
    event.type === 'golden_rain';

  useEffect(() => {
    setMarathonClicks(0);
    setMarathonStartMs(Date.now());
    setCaughtCount(0);
    setEarnedEventCoins(0);
    setEarnedEventGems(0);
    setClickBurstText(null);
    setIsPopupMinimized(false);
    setFreezeCracks(0);
    settledRef.current = null;
  }, [event.id]);

  // Countdown + Marathon end settlement
  useEffect(() => {
    const t = setInterval(() => {
      const rem = Math.max(0, Math.ceil((event.endsAtMs - Date.now()) / 1000));
      setSecondsLeft(rem);

      if (rem <= 0 && settledRef.current !== event.id && event.type === 'click_marathon') {
        settledRef.current = event.id;
        const taps = marathonClicksRef.current;
        if (event.id.startsWith('preview_')) {
          if (taps > 0) {
            const reward = Math.max(5000, Math.floor(currentCoinsRef.current * 9));
            onAwardCoins(reward, 'Click Fast Marathon Preview Champion (~10× Coins!)');
          }
          return;
        }
        fetchMarathonLeaderboard(event.id, isSandbox).then((board) => {
          setLeaders(board);
          if (board[0] && board[0].uid === currentUid && taps > 0) {
            const reward = Math.max(5000, Math.floor(currentCoinsRef.current * 9));
            onAwardCoins(reward, 'Click Fast Marathon Champion (~10× Coins!)');
          }
        });
      }
    }, 250);
    return () => clearInterval(t);
  }, [event.id, event.endsAtMs, event.type, isSandbox, currentUid, onAwardCoins]);

  // Smoothly animate Falling Matthews & 100 Golden Rain sprites inside the Click Event Pop-up Arena
  useEffect(() => {
    if (event.type !== 'falling_matthews' && event.type !== 'golden_rain') {
      setFallingItems([]);
      return;
    }
    const isGolden = event.type === 'golden_rain';
    setFallingItems(
      Array.from({ length: isGolden ? 14 : 9 }).map((_, i) => ({
        id: Date.now() + i + Math.random(),
        left: 8 + Math.random() * 84,
        top: 4 + (i % 5) * 12,
        vx: (Math.random() - 0.5) * 0.9,
        speed: isGolden ? 1.15 + Math.random() * 0.8 : 0.85 + Math.random() * 0.65,
        isGolden,
      }))
    );

    const t = setInterval(() => {
      if (Date.now() > event.endsAtMs) return;
      setFallingItems((prev) => {
        const moved = prev
          .map((item) => {
            let nextLeft = item.left + item.vx;
            let nextVx = item.vx;
            if (nextLeft < 6 || nextLeft > 94) {
              nextVx = -nextVx;
              nextLeft = Math.max(6, Math.min(94, nextLeft));
            }
            return {
              ...item,
              left: nextLeft,
              vx: nextVx,
              top: item.top + item.speed,
            };
          })
          .filter((item) => item.top < 94);

        const targetDensity = isGolden ? 24 : 13;
        while (moved.length < targetDensity) {
          moved.push({
            id: Math.random(),
            left: 8 + Math.random() * 84,
            top: 2 + Math.random() * 6,
            vx: (Math.random() - 0.5) * 0.95,
            speed: isGolden ? 1.1 + Math.random() * 0.85 : 0.85 + Math.random() * 0.65,
            isGolden,
          });
        }
        return moved;
      });
    }, 65);
    return () => clearInterval(t);
  }, [event.id, event.type, event.endsAtMs]);

  const handleMarathonTap = () => {
    if (secondsLeft <= 0) return;
    const next = marathonClicks + 1;
    setMarathonClicks(next);
    const bonusCoin = Math.max(25, Math.floor(currentCoins * 0.002));
    setEarnedEventCoins((c) => c + bonusCoin);
    onAwardCoins(bonusCoin, 'Marathon Tap');

    if (event.id.startsWith('preview_')) {
      setLeaders([{ uid: currentUid, username: currentUsername, clicks: next }]);
      return;
    }
    if (next % 5 === 0) {
      submitMarathonScore({
        eventId: event.id,
        uid: currentUid,
        username: currentUsername,
        clicks: next,
        isSandbox,
      });
      fetchMarathonLeaderboard(event.id, isSandbox).then(setLeaders);
    }
  };

  const handleCatchFallingTarget = (item: FallingTargetItem) => {
    setFallingItems((prev) => prev.filter((x) => x.id !== item.id));
    setCaughtCount((c) => c + 1);

    const coinGain = item.isGolden
      ? Math.max(500, Math.floor(currentCoins * 0.08))
      : Math.max(150, Math.floor(currentCoins * 0.03));
    setEarnedEventCoins((c) => c + coinGain);
    onAwardCoins(coinGain, item.isGolden ? 'Golden Rain Catch' : 'Falling Matthew Catch');

    if (item.isGolden && Math.random() < 0.3) {
      setEarnedEventGems((g) => g + 1);
      onAwardGems(1);
      setClickBurstText(`+${formatNumber(coinGain)} MC & +1 Gem!`);
    } else {
      setClickBurstText(`+${formatNumber(coinGain)} MC!`);
    }
  };

  if (Date.now() > event.endsAtMs + 2000) return null;

  const elapsedSec = Math.max(1, (Date.now() - marathonStartMs) / 1000);
  const marathonCps = (marathonClicks / elapsedSec).toFixed(1);

  return (
    <>
      {/* TOP GLOBAL SUMMON BANNER */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[85] px-5 py-2 rounded-2xl bg-gradient-to-r from-amber-500/95 via-orange-500/95 to-rose-500/95 border border-yellow-200/70 shadow-[0_0_30px_rgba(245,158,11,0.55)] text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2.5 max-w-[94vw]">
        <Flame className="w-4 h-4 shrink-0" />
        <span className="truncate">{event.bannerText}</span>
        <span className="px-2 py-0.5 rounded-full bg-slate-950/25 text-white shrink-0">
          {secondsLeft}s
        </span>
        {isClickEvent && isPopupMinimized && secondsLeft > 0 && (
          <button
            type="button"
            onClick={() => setIsPopupMinimized(false)}
            className="ml-1 px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-black cursor-pointer flex items-center gap-1"
          >
            <Maximize2 className="w-3 h-3" />
            Open Arena
          </button>
        )}
      </div>

      {/* NEW POP-UP INTERACTIVE CLICK EVENT ARENA (Click Marathon, Falling Matthews, Golden Rain) */}
      {isClickEvent && secondsLeft > 0 && !isPopupMinimized && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md select-none"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="relative w-full max-w-4xl h-[78vh] rounded-3xl border-2 border-amber-400/70 bg-gradient-to-b from-slate-900 via-indigo-950/90 to-slate-950 shadow-[0_0_65px_rgba(251,191,36,0.45)] overflow-hidden flex flex-col">
            {/* Pop-Up Arena Header */}
            <div className="px-5 py-3.5 border-b border-white/10 bg-slate-950/75 flex items-center justify-between gap-3 z-20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/60 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-lg font-black uppercase text-white tracking-wide">
                    {event.type === 'click_marathon'
                      ? 'Click Fast Marathon Arena'
                      : event.type === 'golden_rain'
                      ? '100 Golden Matthew Sky Catch'
                      : 'Falling Matthews Click Arena'}
                  </h3>
                  <div className="text-[11px] font-bold text-amber-200/90 flex items-center gap-3">
                    <span>{secondsLeft}s Left</span>
                    <span>•</span>
                    <span>Earned: +{formatNumber(earnedEventCoins)} MC</span>
                    {earnedEventGems > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-300">+{earnedEventGems} Gems</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPopupMinimized(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Minimize
              </button>
            </div>

            {/* Arena Interactive Body */}
            {event.type === 'click_marathon' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5 relative overflow-hidden">
                <div className="text-center">
                  <div className="text-xs font-black uppercase tracking-widest text-amber-300">
                    MASH MATTHEW AS FAST AS YOU CAN!
                  </div>
                  <div className="text-xs font-bold text-slate-300 mt-1">
                    Winner Prize: ~10× Coins ({formatCoins(Math.floor(currentCoins * 9))})
                  </div>
                </div>

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleMarathonTap();
                  }}
                  className="group relative w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-gradient-to-br from-amber-400/25 via-orange-500/20 to-fuchsia-500/25 border-4 border-amber-300/80 shadow-[0_0_50px_rgba(251,191,36,0.65)] flex items-center justify-center cursor-pointer active:scale-90 hover:scale-105 transition-transform"
                >
                  <img
                    src="./images/skins/golden_matthew.png"
                    alt="Marathon Matthew"
                    draggable={false}
                    className="w-36 h-36 sm:w-44 sm:h-44 object-contain pointer-events-none"
                  />
                </button>

                <div className="grid grid-cols-3 gap-3 w-full max-w-lg text-center">
                  <div className="p-3 rounded-2xl bg-slate-900/90 border border-white/10">
                    <div className="text-[10px] font-black uppercase text-slate-400">Your Taps</div>
                    <div className="text-xl font-black text-amber-300">{marathonClicks}</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900/90 border border-white/10">
                    <div className="text-[10px] font-black uppercase text-slate-400">Tap Speed</div>
                    <div className="text-xl font-black text-cyan-300">{marathonCps}/s</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900/90 border border-white/10">
                    <div className="text-[10px] font-black uppercase text-slate-400">Leader</div>
                    <div className="text-sm font-black text-emerald-300 truncate">
                      {leaders[0] ? `${leaders[0].username} (${leaders[0].clicks})` : `${marathonClicks}`}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_65%)]">
                <div className="absolute top-3 left-4 z-10 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-white/15 text-xs font-black text-white">
                  Caught: <span className="text-amber-300">{caughtCount}</span>
                </div>
                {clickBurstText && (
                  <div className="absolute top-3 right-4 z-10 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-xs font-black text-emerald-300 animate-pulse">
                    {clickBurstText}
                  </div>
                )}

                {fallingItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleCatchFallingTarget(item);
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125 active:scale-75 p-1.5 rounded-full ${
                      item.isGolden
                        ? 'bg-amber-400/20 border-2 border-yellow-300 shadow-[0_0_24px_rgba(250,204,21,0.85)]'
                        : 'bg-cyan-400/20 border-2 border-cyan-200 shadow-[0_0_20px_rgba(56,189,248,0.75)]'
                    }`}
                    style={{ left: `${item.left}%`, top: `${item.top}%` }}
                  >
                    <img
                      src={
                        item.isGolden
                          ? './images/skins/golden_matthew.png'
                          : './images/skins/season2/snowy_matthew.png'
                      }
                      alt="Falling Matthew"
                      draggable={false}
                      className="w-14 h-14 sm:w-16 sm:h-16 object-contain pointer-events-none"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCREEN FREEZE OVERLAY — MELTED AUTOMATICALLY BY FIRE CURSOR! */}
      {event.type === 'screen_freeze' && isAffected && secondsLeft > 0 && hasFireCursor && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[72] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-600/95 via-amber-500/95 to-rose-600/95 border-2 border-yellow-200 text-slate-950 font-black text-xs sm:text-sm uppercase shadow-[0_0_32px_rgba(249,115,22,0.85)] flex items-center gap-2 pointer-events-none">
          <Flame className="w-5 h-5 text-yellow-100 animate-pulse" />
          <span>Fire Cursor Melted the Screen Freeze ({secondsLeft}s immunity active!)</span>
        </div>
      )}

      {event.type === 'screen_freeze' &&
        isAffected &&
        secondsLeft > 0 &&
        !hasFireCursor &&
        (() => {
          const requiredCracks = Math.max(45, Math.round(event.durationSeconds * 1.25));
          if (freezeCracks >= requiredCracks) return null;
          const pct = Math.min(100, Math.round((freezeCracks / requiredCracks) * 100));
          return (
            <div
              onClick={() => setFreezeCracks((c) => c + 1)}
              className="fixed inset-0 z-[70] bg-gradient-to-b from-cyan-400/45 via-sky-300/35 to-blue-900/55 backdrop-blur-lg border-[10px] border-cyan-100/90 shadow-[inset_0_0_95px_rgba(165,243,252,0.85)] flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
            >
              {/* Shattered Ice Lattice Overlay */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none opacity-60"
              >
                <path
                  d="M0 0 L35 28 L18 55 L0 70 M100 0 L68 30 L85 60 L100 78 M50 0 L48 25 L62 48 L45 78 L52 100 M0 42 L28 45 L50 52 L76 46 L100 40"
                  stroke="#e0f2fe"
                  strokeWidth={0.45 + (pct / 100) * 0.65}
                  fill="none"
                />
              </svg>

              <Snowflake
                className="w-20 h-20 text-white animate-spin mb-4 drop-shadow-[0_0_24px_rgba(165,243,252,0.9)]"
                style={{ animationDuration: '4.5s' }}
              />
              <div className="relative z-10 px-6 py-4 rounded-3xl bg-slate-950/90 border-2 border-cyan-300 text-white font-black text-center max-w-md w-[90vw] shadow-[0_0_45px_rgba(34,211,238,0.65)]">
                <div className="text-xl tracking-wide text-cyan-200">
                  FROZEN BY {event.summonedByUsername.toUpperCase()}!
                </div>
                <div className="text-sm font-black text-white mt-1.5">
                  Deep Freeze lasts <span className="text-cyan-300 font-mono">{secondsLeft}s</span>
                </div>
                <div className="mt-3 w-full h-2.5 rounded-full bg-slate-800 border border-cyan-500/40 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-white transition-all duration-150"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[11px] text-cyan-200 mt-1.5">
                  Hammer ice ({requiredCracks - freezeCracks} hits left) to shatter early!
                </div>
                <div className="text-[10px] text-orange-300 mt-1">
                  Tip: Equip the Fire Cursor from Normal Crates to melt ice instantly!
                </div>
              </div>
            </div>
          );
        })()}

      {/* ZOMBIE BOSS RAID BANNER FOR NON-SUMMONERS */}
      {event.type === 'zombie_boss_raid' && isAffected && secondsLeft > 0 && (
        <div className="fixed bottom-14 right-4 z-[72] px-4 py-2.5 rounded-xl bg-rose-600/95 border-2 border-rose-300 text-white text-xs font-black flex items-center gap-2 shadow-[0_0_25px_rgba(244,63,94,0.8)] animate-pulse">
          <ShieldAlert className="w-4 h-4" />
          <span>Cryo Titan Boss Raid Active ({secondsLeft}s)! Click Zombies or Let Pets Attack!</span>
        </div>
      )}
    </>
  );
};
