import React, { useEffect, useRef, useState } from 'react';
import {
  Snowflake,
  Flame,
  Zap,
  X,
  ShieldAlert,
  Minimize2,
  Maximize2,
  Sparkles,
  Lock,
  Trophy,
  Crown,
} from 'lucide-react';
import { GameState } from '../../types/game';
import {
  ActiveGlobalLiveEvent,
  GlobalEventScoreEntry,
  PLAYER_TRIGGERABLE_EVENTS,
  PlayerEventCostSpec,
  extractScoresFromStore,
  fetchGlobalEventLeaderboard,
  submitGlobalEventScore,
  summonGlobalLiveEvent,
} from '../../firebase/liveEvents';
import { getStormSkinsForSeason, isSeasonThreeOrLater } from '../../data/skins';
import { getServerNowMs } from '../../firebase/config';
import { formatCoins, formatNumber } from '../../utils/formatters';
import {
  NewInteractiveEventView,
  isNewGoodCompetitiveEventType,
  isNewInteractiveEventType,
} from './NewInteractiveEvents';

interface LiveEventsModalProps {
  state: GameState;
  isSandbox: boolean;
  onUpdateState: (updater: (prev: GameState) => GameState) => void;
  onNotify: (title: string, subtitle?: string) => void;
  onEventSummoned?: (event: ActiveGlobalLiveEvent) => void;
  onClose: () => void;
}

export const LiveEventsHubModal: React.FC<LiveEventsModalProps> = ({
  state,
  isSandbox,
  onUpdateState,
  onNotify,
  onEventSummoned,
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
    if (res.ok && res.event) {
      if (state.cloudAccount?.uid && res.cloudSynced === false) {
        onNotify(
          'CONNECTION ISSUE',
          'Could not reach server to broadcast event — Gems were NOT spent. Try again!'
        );
        return;
      }
      onUpdateState((prev) => ({
        ...prev,
        gems: Math.max(0, prev.gems - spec.gemCost),
      }));
      onEventSummoned?.(res.event);
      onNotify('EVENT SUMMONED!', `${username} summoned ${spec.label} across all screens!`);
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

        {/* Live Event Exclusives (No Spoilers Until Unlocked!) */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-400/35">
          <h3 className="text-sm font-black uppercase text-purple-300 mb-3">
            {isSeasonThreeOrLater(state.currentSeasonId)
              ? 'Marvel Live Event Exclusives (No Spoilers Until Unlocked)'
              : 'Friday Live Event Exclusives (No Spoilers Until Unlocked)'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {getStormSkinsForSeason(state.currentSeasonId).map((s) => {
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
  currentCps: number;
  currentClickPower: number;
  isSandbox: boolean;
  hasFireCursor?: boolean;
  evStoreSnapshot?: Record<string, any>;
  onAwardCoins: (amount: number, reason: string) => void;
  onAwardGems: (amount: number) => void;
  onDrainCoinsPercent?: (pct: number) => void;
  onNotify?: (title: string, subtitle: string) => void;
}

interface FallingTargetItem {
  id: number;
  left: number;
  top: number;
  vx: number;
  speed: number;
  isGolden: boolean;
}

interface EventWinnerSummary {
  board: GlobalEventScoreEntry[];
  winner: GlobalEventScoreEntry | null;
  didWin: boolean;
  myRank: number;
}

/**
 * Renders live global server events:
 * - Click Events (Click Marathon, Falling Matthews, 100 Golden Rain) open an interactive Pop-Up Event Arena
 *   with real-time multiplayer standings & crown a server Winner!
 * - Screen Freeze completely locks non-summoners out of playing until the timer hits 0s.
 * - Zombie Boss Raid highlights the active Cryo Titan raid for non-summoners.
 */
export const ActiveGlobalEventOverlay: React.FC<ActiveGlobalEventOverlayProps> = ({
  event,
  currentUid,
  currentUsername,
  currentCps,
  currentClickPower,
  isSandbox,
  hasFireCursor = false,
  evStoreSnapshot,
  onAwardCoins,
  onAwardGems,
  onDrainCoinsPercent,
  onNotify,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((event.endsAtMs - getServerNowMs()) / 1000))
  );
  const [marathonClicks, setMarathonClicks] = useState(0);
  const [marathonStartMs, setMarathonStartMs] = useState(() => Date.now());
  const [leaders, setLeaders] = useState<GlobalEventScoreEntry[]>([]);
  const [fallingItems, setFallingItems] = useState<FallingTargetItem[]>([]);
  const [caughtCount, setCaughtCount] = useState(0);
  const [earnedEventCoins, setEarnedEventCoins] = useState(0);
  const [earnedEventGems, setEarnedEventGems] = useState(0);
  const [clickBurstText, setClickBurstText] = useState<string | null>(null);
  const [isPopupMinimized, setIsPopupMinimized] = useState(false);
  const [winnerSummary, setWinnerSummary] = useState<EventWinnerSummary | null>(null);
  const [dismissedWinnerId, setDismissedWinnerId] = useState<string | null>(null);

  // Refs prevent inline callbacks from parent re-renders from clearing the 250ms countdown timer!
  const onAwardCoinsRef = useRef(onAwardCoins);
  onAwardCoinsRef.current = onAwardCoins;
  const onAwardGemsRef = useRef(onAwardGems);
  onAwardGemsRef.current = onAwardGems;
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const settledRef = useRef<string | null>(null);
  const myScoreRef = useRef(0);
  const lastScoreSubmitMsRef = useRef(0);
  const earnedEventGemsRef = useRef(0);

  const isClickEvent = event.type === 'golden_rain';
  const isNewInteractive = isNewInteractiveEventType(event.type);
  const isCompetitiveEvent = isClickEvent || isNewGoodCompetitiveEventType(event.type);

  const [newEventScore, setNewEventScore] = useState(0);
  const myScore = isNewInteractive ? newEventScore : caughtCount;
  myScoreRef.current = myScore;

  const baseProd = Math.max(50, (currentCps || 0) + (currentClickPower || 1) * 4);
  const baseProdRef = useRef(baseProd);
  baseProdRef.current = baseProd;

  // In sandbox / dev test mode, events affect you too so devs can test how every attack feels!
  const isAffected = isSandbox
    ? true
    : event.targetUid
    ? event.targetUid === currentUid
    : !event.excludeSummoner || (event.summonedByUid && event.summonedByUid !== currentUid);

  const isCurrentlyFrozen =
    event.type === 'screen_freeze' && isAffected && secondsLeft > 0 && !hasFireCursor;

  // Reset per-event local counters when a new event ID starts
  useEffect(() => {
    setSecondsLeft(Math.max(0, Math.ceil((event.endsAtMs - getServerNowMs()) / 1000)));
    setMarathonClicks(0);
    setNewEventScore(0);
    setMarathonStartMs(Date.now());
    setCaughtCount(0);
    setEarnedEventCoins(0);
    setEarnedEventGems(0);
    earnedEventGemsRef.current = 0;
    myScoreRef.current = 0;
    lastScoreSubmitMsRef.current = 0;
    setClickBurstText(null);
    setIsPopupMinimized(false);
    setLeaders([]);
    setWinnerSummary(null);
    settledRef.current = null;
  }, [event.id, event.endsAtMs]);

  // Keep live standings instantly updated whenever the SSE/poll evStore updates
  useEffect(() => {
    if (!isCompetitiveEvent || !evStoreSnapshot) return;
    const nextBoard = extractScoresFromStore(evStoreSnapshot, event.id, isSandbox);
    if (nextBoard.length > 0) {
      setLeaders(nextBoard);
    }
  }, [evStoreSnapshot, event.id, isCompetitiveEvent, isSandbox]);

  // Lock keyboard (Spacebar / Enter / Tab) when frozen by Screen Freeze so frozen players truly cannot do anything
  useEffect(() => {
    if (!isCurrentlyFrozen) return;
    const blockKeys = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
    };
    window.addEventListener('keydown', blockKeys, true);
    window.addEventListener('keyup', blockKeys, true);
    return () => {
      window.removeEventListener('keydown', blockKeys, true);
      window.removeEventListener('keyup', blockKeys, true);
    };
  }, [isCurrentlyFrozen]);

  // Countdown + Winner settlement (depends ONLY on primitive event identity/timing, never parent callbacks!)
  useEffect(() => {
    let settleTimeout: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      const rem = Math.max(0, Math.ceil((event.endsAtMs - getServerNowMs()) / 1000));
      setSecondsLeft(rem);

      if (rem <= 0 && settledRef.current !== event.id && isCompetitiveEvent) {
        settledRef.current = event.id;
        const finalScore = myScoreRef.current;

        const finalizeLeaderboard = async () => {
          if (event.id.startsWith('preview_')) {
            const previewBoard: GlobalEventScoreEntry[] =
              finalScore > 0
                ? [{ uid: currentUid, username: currentUsername, clicks: finalScore }]
                : [];
            const winner = previewBoard[0] || null;
            setLeaders(previewBoard);
            setWinnerSummary({
              board: previewBoard,
              winner,
              didWin: Boolean(winner),
              myRank: winner ? 1 : 0,
            });
            if (finalScore > 0) {
              const reward = Math.max(5000, Math.floor(baseProdRef.current * 120));
              onAwardCoinsRef.current(reward, 'Event Preview Champion (+20 Gems!)');
              onAwardGemsRef.current(20);
            }
            return;
          }

          if (finalScore > 0) {
            await submitGlobalEventScore({
              eventId: event.id,
              uid: currentUid,
              username: currentUsername,
              score: finalScore,
              isSandbox,
            }).catch(() => {});
          }

          // Give other clients ~550ms to flush their final scores before declaring server winner
          settleTimeout = setTimeout(async () => {
            const board = await fetchGlobalEventLeaderboard(event.id, isSandbox).catch(() => []);
            const winner = board[0] || null;
            const myIdx = board.findIndex((entry) => entry.uid === currentUid);
            const myRank = myIdx >= 0 ? myIdx + 1 : 0;
            const didWin = Boolean(winner && winner.uid === currentUid && finalScore > 0);
            const scoreLabel = 'catches';

            setLeaders(board);
            setWinnerSummary({
              board,
              winner,
              didWin,
              myRank,
            });

            if (winner) {
              onNotifyRef.current?.(
                '🏆 EVENT WINNER!',
                `${winner.username} won with ${formatNumber(winner.clicks)} ${scoreLabel}!`
              );
            }

            const winnerGems = 15;
            const winnerCoinMult = 85;
            if (didWin) {
              const reward = Math.max(5000, Math.floor(baseProdRef.current * winnerCoinMult));
              onAwardCoinsRef.current(
                reward,
                `#1 Event Champion (+${winnerGems} Gems!)`
              );
              onAwardGemsRef.current(winnerGems);
            } else if (finalScore >= 10) {
              const reward = Math.max(1500, Math.floor(baseProdRef.current * 30));
              onAwardCoinsRef.current(reward, 'Event Participant Bonus (+5 Gems!)');
              onAwardGemsRef.current(5);
            }
          }, 550);
        };

        finalizeLeaderboard();
      }
    };

    tick();
    const t = setInterval(tick, 250);
    return () => {
      clearInterval(t);
      if (settleTimeout) clearTimeout(settleTimeout);
    };
  }, [event.id, event.endsAtMs, event.type, isCompetitiveEvent, isSandbox, currentUid, currentUsername]);

  // Smoothly animate 100 Golden Rain sprites inside the Click Event Pop-up Arena
  useEffect(() => {
    if (event.type !== 'golden_rain') {
      setFallingItems([]);
      return;
    }
    const isGolden = true;
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
      if (getServerNowMs() > event.endsAtMs) return;
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

  const flushCompetitiveScore = (scoreValue: number) => {
    if (event.id.startsWith('preview_')) {
      setLeaders([{ uid: currentUid, username: currentUsername, clicks: scoreValue }]);
      return;
    }
    const now = Date.now();
    if (now - lastScoreSubmitMsRef.current >= 320 || scoreValue <= 2) {
      lastScoreSubmitMsRef.current = now;
      submitGlobalEventScore({
        eventId: event.id,
        uid: currentUid,
        username: currentUsername,
        score: scoreValue,
        isSandbox,
      }).catch(() => {});
    }
  };

  const handleMarathonTap = () => {
    if (secondsLeft <= 0) return;
    const next = marathonClicks + 1;
    setMarathonClicks(next);
    const bonusCoin = Math.max(25, Math.floor((currentClickPower || 1) * 2 + (currentCps || 0) * 0.4));
    setEarnedEventCoins((c) => c + bonusCoin);
    onAwardCoinsRef.current(bonusCoin, 'Marathon Tap');
    flushCompetitiveScore(next);
  };

  const handleCatchFallingTarget = (item: FallingTargetItem) => {
    if (secondsLeft <= 0) return;
    setFallingItems((prev) => prev.filter((x) => x.id !== item.id));
    const nextCaught = caughtCount + 1;
    setCaughtCount(nextCaught);

    const coinGain = item.isGolden
      ? Math.max(300, Math.floor(baseProd * 6))
      : Math.max(120, Math.floor(baseProd * 3));
    setEarnedEventCoins((c) => c + coinGain);
    onAwardCoinsRef.current(coinGain, item.isGolden ? 'Golden Rain Catch' : 'Falling Matthew Catch');

    const maxGemsPerEvent = item.isGolden ? 12 : 8;
    const gemChance = item.isGolden ? 0.1 : 0.06;
    if (earnedEventGemsRef.current < maxGemsPerEvent && Math.random() < gemChance) {
      earnedEventGemsRef.current += 1;
      setEarnedEventGems((g) => g + 1);
      onAwardGemsRef.current(1);
      setClickBurstText(`+${formatCoins(coinGain)} MC & +1 Gem!`);
    } else {
      setClickBurstText(`+${formatCoins(coinGain)} MC!`);
    }
    flushCompetitiveScore(nextCaught);
  };

  const serverNow = getServerNowMs();
  if (serverNow > event.endsAtMs + 10_000) return null;

  const topLeader = leaders[0];
  const scoreUnitLabel = isNewInteractive ? 'pts' : 'catches';
  const showWinnerPodium =
    isCompetitiveEvent &&
    secondsLeft <= 0 &&
    winnerSummary &&
    dismissedWinnerId !== event.id;

  return (
    <>
      {/* TOP GLOBAL SUMMON BANNER */}
      {secondsLeft > 0 && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[98] px-5 py-2 rounded-2xl bg-gradient-to-r from-amber-500/95 via-orange-500/95 to-rose-500/95 border border-yellow-200/70 shadow-[0_0_30px_rgba(245,158,11,0.55)] text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2.5 max-w-[94vw]">
          <Flame className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {event.targetUsername
              ? `${event.bannerText} • Targeted on ${event.targetUsername}`
              : event.bannerText}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-950/25 text-white shrink-0 font-mono">
            {secondsLeft}s
          </span>
          {(isClickEvent || isNewGoodCompetitiveEventType(event.type)) && isPopupMinimized && (
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
      )}

      {/* INTERACTIVE BOOSTS & VILLAIN ATTACKS */}
      {isNewInteractive && (
        <NewInteractiveEventView
          event={event}
          secondsLeft={secondsLeft}
          isAffected={Boolean(isAffected)}
          isMinimized={isPopupMinimized}
          onMinimize={() => setIsPopupMinimized(true)}
          baseProd={baseProd}
          leaders={leaders}
          onSubmitScore={(val) => {
            setNewEventScore(val);
            myScoreRef.current = val;
            flushCompetitiveScore(val);
          }}
          onAwardCoins={(amt, reason) => onAwardCoinsRef.current(amt, reason)}
          onAwardGems={(amt) => onAwardGemsRef.current(amt)}
          onDrainCoinsPercent={onDrainCoinsPercent}
        />
      )}

      {/* SUMMONER SAFEZONE STATUS BANNER DURING TIME FREEZE */}
      {event.type === 'screen_freeze' && !isAffected && secondsLeft > 0 && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[72] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500/95 to-emerald-500/95 border-2 border-white/80 text-slate-950 font-black text-xs sm:text-sm uppercase shadow-[0_0_32px_rgba(34,211,238,0.8)] flex items-center gap-2 pointer-events-none">
          <Snowflake className="w-5 h-5 text-slate-950" />
          <span>
            {event.targetUsername
              ? `${event.targetUsername} Is Frozen (${secondsLeft}s) — You Keep Clicking!`
              : `Everyone Else Is Frozen (${secondsLeft}s) — Only You Can Play!`}
          </span>
        </div>
      )}

      {/* POP-UP INTERACTIVE CLICK EVENT ARENA (Click Marathon, Falling Matthews, Golden Rain) */}
      {isClickEvent && secondsLeft > 0 && !isPopupMinimized && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md select-none"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="relative w-full max-w-4xl h-[78vh] rounded-3xl border-2 border-amber-400/70 bg-gradient-to-b from-slate-900 via-indigo-950/90 to-slate-950 shadow-[0_0_65px_rgba(251,191,36,0.45)] overflow-hidden flex flex-col">
            {/* Pop-Up Arena Header */}
            <div className="px-5 py-3.5 border-b border-white/10 bg-slate-950/75 flex items-center justify-between gap-3 z-20 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/60 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-lg font-black uppercase text-white tracking-wide">
                    {event.type === 'golden_rain'
                      ? '100 Golden Matthew Sky Catch'
                      : 'Falling Matthews Click Arena'}
                  </h3>
                  <div className="text-[11px] font-bold text-amber-200/90 flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-white">{secondsLeft}s Left</span>
                    <span>•</span>
                    <span>Earned: +{formatNumber(earnedEventCoins)} MC</span>
                    {earnedEventGems > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-300">+{earnedEventGems} Gems</span>
                      </>
                    )}
                    {topLeader && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-300 flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 text-yellow-300" />
                          #1 {topLeader.username} ({formatNumber(topLeader.clicks)} {scoreUnitLabel})
                        </span>
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
            {(
              <div className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_65%)]">
                <div className="absolute top-3 left-4 z-10 flex items-center gap-2 flex-wrap">
                  <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 border border-white/15 text-xs font-black text-white">
                    Caught: <span className="text-amber-300">{caughtCount}</span>
                  </div>
                  {leaders.slice(0, 3).map((entry, idx) => (
                    <div
                      key={entry.uid}
                      className="px-2.5 py-1 rounded-xl bg-slate-950/85 border border-amber-400/35 text-[11px] font-black text-slate-200 flex items-center gap-1"
                    >
                      <span className="text-amber-300">#{idx + 1}</span>
                      <span className="truncate max-w-[90px]">{entry.username}</span>
                      <span className="text-emerald-300">{entry.clicks}</span>
                    </div>
                  ))}
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

      {/* EVENT WINNER PODIUM ANNOUNCEMENT (SHOWN ACROSS ALL SCREENS FOR ~9s WHEN EVENT ENDS) */}
      {showWinnerPodium && winnerSummary && (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md select-none"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md rounded-3xl border-2 border-yellow-300/80 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 p-6 shadow-[0_0_60px_rgba(250,204,21,0.45)] text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-yellow-400/20 border-2 border-yellow-300 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-yellow-300" />
            </div>

            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-amber-300">
                Event Complete!
              </div>
              {winnerSummary.winner ? (
                <>
                  <h3 className="text-2xl font-black text-white mt-1">
                    {winnerSummary.didWin ? 'YOU WON!' : `${winnerSummary.winner.username} WON!`}
                  </h3>
                  <p className="text-xs font-bold text-emerald-300 mt-1">
                    #1 Champion with {formatNumber(winnerSummary.winner.clicks)} {scoreUnitLabel}
                  </p>
                </>
              ) : (
                <h3 className="text-xl font-black text-white mt-1">Time&apos;s Up!</h3>
              )}
            </div>

            {winnerSummary.board.length > 0 && (
              <div className="space-y-1.5 text-left">
                {winnerSummary.board.slice(0, 5).map((entry, idx) => {
                  const isMe = entry.uid === currentUid;
                  return (
                    <div
                      key={entry.uid}
                      className={`px-3.5 py-2 rounded-xl border flex items-center justify-between text-xs font-black ${
                        idx === 0
                          ? 'bg-yellow-400/20 border-yellow-300/70 text-yellow-100'
                          : isMe
                          ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-100'
                          : 'bg-slate-900/90 border-slate-800 text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="text-amber-300 w-5">#{idx + 1}</span>
                        <span className="truncate">
                          {entry.username}
                          {isMe ? ' (You)' : ''}
                        </span>
                      </span>
                      <span className="text-emerald-300 shrink-0">
                        {formatNumber(entry.clicks)} {scoreUnitLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setDismissedWinnerId(event.id)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase cursor-pointer"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* DR. STRANGE DARK ICE OVERLAY — BREACHED BY CHAOS / GAUNTLET CURSOR */}
      {event.type === 'screen_freeze' && isAffected && secondsLeft > 0 && hasFireCursor && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[72] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-700/95 via-amber-500/95 to-emerald-600/95 border-2 border-amber-200 text-white font-black text-xs sm:text-sm uppercase shadow-[0_0_24px_rgba(168,85,247,0.75)] flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
          <span>Equipped Relic Pierced Dark Ice ({secondsLeft}s immunity active!)</span>
        </div>
      )}

      {/* FULL-SCREEN DR. STRANGE DARK ICE PRISON — BLOCKS ACTIONS UNTIL TIMER HITS 0 */}
      {isCurrentlyFrozen && (
        <div
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="fixed inset-0 z-[95] bg-gradient-to-b from-[#0b031a]/88 via-[#1f0738]/82 to-[#041d19]/90 border-[10px] border-purple-500/80 shadow-[inset_0_0_95px_rgba(168,85,247,0.75)] flex flex-col items-center justify-center cursor-not-allowed select-none overflow-hidden pointer-events-auto"
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none opacity-70"
          >
            <path
              d="M0 0 L35 28 L18 55 L0 70 M100 0 L68 30 L85 60 L100 78 M50 0 L48 25 L62 48 L45 78 L52 100 M0 42 L28 45 L50 52 L76 46 L100 40"
              stroke="#c084fc"
              strokeWidth={0.9}
              fill="none"
            />
            <circle cx="50" cy="50" r="28" stroke="#34d399" strokeWidth={0.55} strokeDasharray="3 2" fill="none" />
          </svg>

          <img
            src="./images/s3/events/attack_time_freeze.png"
            alt="Dr. Strange Dark Ice"
            className="w-24 h-24 object-contain mb-3 drop-shadow-[0_0_24px_rgba(168,85,247,0.9)]"
          />
          <div className="relative z-10 px-6 py-5 rounded-3xl bg-slate-950/94 border-2 border-purple-400 text-white font-black text-center max-w-md w-[90vw] shadow-[0_0_40px_rgba(168,85,247,0.65)]">
            <div className="text-xl tracking-wide text-purple-300 font-marvel uppercase">
              TRAPPED IN DARK ICE BY {event.summonedByUsername.toUpperCase()}!
            </div>
            <div className="text-base font-black text-white mt-2">
              Mirror Dimension Shards Shatter in <span className="text-emerald-300 font-mono text-2xl">{secondsLeft}s</span>
            </div>
            <div className="mt-3 w-full h-2.5 rounded-full bg-slate-800 border border-purple-500/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-emerald-400 to-amber-300 transition-all duration-200"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, Math.round((secondsLeft / Math.max(1, event.durationSeconds)) * 100))
                  )}%`,
                }}
              />
            </div>
            <div className="text-xs text-purple-100 mt-2.5">
              Dark Ice locked your controls — wait for the eldritch seal to break!
            </div>
          </div>
        </div>
      )}

    </>
  );
};
