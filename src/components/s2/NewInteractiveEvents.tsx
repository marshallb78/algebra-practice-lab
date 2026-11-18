import React, { useEffect, useRef, useState } from 'react';
import {
  Crown,
  Flame,
  Minimize2,
  ShieldAlert,
  Sparkles,
  Zap,
  X,
  RotateCcw,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { ActiveGlobalLiveEvent, GlobalEventScoreEntry, GlobalEventType } from '../../firebase/liveEvents';
import { formatCoins, formatNumber } from '../../utils/formatters';

export const NEW_GOOD_EVENT_TYPES = new Set<GlobalEventType>([
  'lucky_pinata',
  'memory_simon',
  'reaction_duel',
  'meteor_shield',
  'coin_jackpot_wheel',
]);

export const NEW_BAD_EVENT_TYPES = new Set<GlobalEventType>([
  'tax_collector',
  'upside_down_chaos',
  'blackout_flashlight',
  'earthquake_buttons',
  'fake_crash_prank',
]);

export function isNewInteractiveEventType(type: GlobalEventType): boolean {
  return NEW_GOOD_EVENT_TYPES.has(type) || NEW_BAD_EVENT_TYPES.has(type);
}

export function isNewGoodCompetitiveEventType(type: GlobalEventType): boolean {
  return NEW_GOOD_EVENT_TYPES.has(type);
}

interface NewInteractiveEventViewProps {
  event: ActiveGlobalLiveEvent;
  secondsLeft: number;
  isAffected: boolean;
  isMinimized: boolean;
  onMinimize: () => void;
  baseProd: number;
  leaders: GlobalEventScoreEntry[];
  onSubmitScore: (score: number) => void;
  onAwardCoins: (amount: number, reason: string) => void;
  onAwardGems: (amount: number) => void;
  onDrainCoinsPercent?: (pct: number) => void;
}

const SIMON_TILES = [
  { id: 0, label: 'ICE', bg: 'from-cyan-400 to-sky-600', activeBg: 'bg-cyan-200 ring-4 ring-white', border: 'border-cyan-300' },
  { id: 1, label: 'FIRE', bg: 'from-orange-400 to-rose-600', activeBg: 'bg-amber-200 ring-4 ring-white', border: 'border-orange-300' },
  { id: 2, label: 'GOLD', bg: 'from-yellow-300 to-amber-500', activeBg: 'bg-yellow-100 ring-4 ring-white', border: 'border-yellow-200' },
  { id: 3, label: 'VOID', bg: 'from-purple-500 to-fuchsia-700', activeBg: 'bg-fuchsia-200 ring-4 ring-white', border: 'border-purple-300' },
];

const WHEEL_WEDGES = [
  { label: '25x CPS', mult: 25, gems: 0, points: 25, color: '#0ea5e9' },
  { label: '+5 Gems', mult: 10, gems: 5, points: 45, color: '#a855f7' },
  { label: '75x CPS', mult: 75, gems: 0, points: 65, color: '#f59e0b' },
  { label: '+12 Gems', mult: 15, gems: 12, points: 90, color: '#ec4899' },
  { label: '150x CPS', mult: 150, gems: 3, points: 125, color: '#10b981' },
  { label: 'JACKPOT!', mult: 300, gems: 20, points: 250, color: '#eab308' },
];

export const NewInteractiveEventView: React.FC<NewInteractiveEventViewProps> = ({
  event,
  secondsLeft,
  isAffected,
  isMinimized,
  onMinimize,
  baseProd,
  leaders,
  onSubmitScore,
  onAwardCoins,
  onAwardGems,
  onDrainCoinsPercent,
}) => {
  const isGood = NEW_GOOD_EVENT_TYPES.has(event.type);
  const topLeader = leaders[0];

  // Shared refs
  const onAwardCoinsRef = useRef(onAwardCoins);
  onAwardCoinsRef.current = onAwardCoins;
  const onAwardGemsRef = useRef(onAwardGems);
  onAwardGemsRef.current = onAwardGems;
  const onSubmitScoreRef = useRef(onSubmitScore);
  onSubmitScoreRef.current = onSubmitScore;
  const onDrainRef = useRef(onDrainCoinsPercent);
  onDrainRef.current = onDrainCoinsPercent;

  // 1. Piñata state
  const [pinataHits, setPinataHits] = useState(0);
  const [pinataCracks, setPinataCracks] = useState(0);
  const [pinataWobble, setPinataWobble] = useState(false);
  const [pinataFlash, setPinataFlash] = useState<string | null>(null);

  // 2. Simon Pattern state
  const [simonSeq, setSimonSeq] = useState<number[]>([]);
  const [simonUserIdx, setSimonUserIdx] = useState(0);
  const [simonLitTile, setSimonLitTile] = useState<number | null>(null);
  const [simonShowing, setSimonShowing] = useState(false);
  const [simonScore, setSimonScore] = useState(0);
  const [simonStatus, setSimonStatus] = useState('Watch the pattern!');

  // 3. Reaction Duel state
  const [reactPhase, setReactPhase] = useState<'wait' | 'go' | 'result'>('wait');
  const [reactGreenAt, setReactGreenAt] = useState(0);
  const [reactLastMs, setReactLastMs] = useState<number | null>(null);
  const [reactScore, setReactScore] = useState(0);
  const [reactMsg, setReactMsg] = useState('Wait for GREEN...');

  // 4. Meteor Coin Forge (Timing Ring) state
  const [ringSize, setRingSize] = useState(100);
  const [forgeScore, setForgeScore] = useState(0);
  const [forgeCombo, setForgeCombo] = useState(0);
  const [forgeFeedback, setForgeFeedback] = useState('Tap when the ring hits the gold target!');

  // 5. Jackpot Wheel state
  const [wheelSpinsLeft, setWheelSpinsLeft] = useState(3);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelScore, setWheelScore] = useState(0);
  const [wheelResult, setWheelResult] = useState<string | null>(null);

  // 6. Tax Collector state
  const [taxPos, setTaxPos] = useState({ left: 50, top: 55 });
  const [taxWhacks, setTaxWhacks] = useState(0);
  const [taxStolenMsg, setTaxStolenMsg] = useState<string | null>(null);

  // 7. Upside-Down Stabilizer state
  const [stabilizedUntilMs, setStabilizedUntilMs] = useState(0);
  const [boltPos, setBoltPos] = useState({ left: 22, top: 28 });

  // 8. Blackout Flashlight state
  const [lightPos, setLightPos] = useState({ x: 50, y: 50 });
  const [flaresCaught, setFlaresCaught] = useState(0);
  const [flarePos, setFlarePos] = useState({ left: 30, top: 45 });

  // 9. Earthquake Chaos Target state
  const [quakeTargetsCaught, setQuakeTargetsCaught] = useState(0);
  const [quakePos, setQuakePos] = useState({ left: 50, top: 50 });

  // 10. Fake Crash Pop-up Storm state
  const [popups, setPopups] = useState<{ id: number; left: number; top: number; title: string; body: string }[]>([]);

  // Reset all mini-game state on new event ID
  useEffect(() => {
    setPinataHits(0);
    setPinataCracks(0);
    setPinataFlash(null);
    setSimonScore(0);
    setSimonSeq([]);
    setSimonUserIdx(0);
    setSimonStatus('Watch the pattern!');
    setReactPhase('wait');
    setReactLastMs(null);
    setReactScore(0);
    setReactMsg('Wait for GREEN...');
    setRingSize(100);
    setForgeScore(0);
    setForgeCombo(0);
    setForgeFeedback('Tap when the ring hits the gold target!');
    setWheelSpinsLeft(3);
    setWheelRotation(0);
    setWheelSpinning(false);
    setWheelScore(0);
    setWheelResult(null);
    setTaxWhacks(0);
    setTaxStolenMsg(null);
    setStabilizedUntilMs(0);
    setFlaresCaught(0);
    setQuakeTargetsCaught(0);
    setPopups(
      event.type === 'fake_crash_prank'
        ? Array.from({ length: 8 }, (_, i) => ({
            id: i + 1,
            left: 10 + ((i * 23) % 62),
            top: 12 + ((i * 19) % 58),
            title: ['MATTHEW.EXE ERROR', 'FREEZE WARNING', 'SYSTEM GLITCH', 'ALERT!'][i % 4],
            body: [
              'Too much aura detected in RAM!',
              'Matthew ate your cursor!',
              'Click [X] to unfreeze this window!',
              'Error 404: Chill not found.',
            ][i % 4],
          }))
        : []
    );
  }, [event.id, event.type]);

  // SIMON SAYS: Start / advance sequence playback
  useEffect(() => {
    if (event.type !== 'memory_simon' || secondsLeft <= 0) return;
    if (simonSeq.length === 0) {
      setSimonSeq([Math.floor(Math.random() * 4), Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)]);
      return;
    }
    setSimonShowing(true);
    setSimonUserIdx(0);
    setSimonStatus(`Watch Round ${simonSeq.length - 2}...`);
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    simonSeq.forEach((tileId, idx) => {
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setSimonLitTile(tileId);
        }, idx * 520 + 250)
      );
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setSimonLitTile(null);
          if (idx === simonSeq.length - 1) {
            setSimonShowing(false);
            setSimonStatus('Your turn! Repeat the pattern!');
          }
        }, idx * 520 + 550)
      );
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [event.type, event.id, simonSeq, secondsLeft]);

  // REACTION DUEL: Random wait -> GREEN flash
  useEffect(() => {
    if (event.type !== 'reaction_duel' || secondsLeft <= 0 || reactPhase !== 'wait') return;
    const delay = 1400 + Math.random() * 2400;
    const t = setTimeout(() => {
      setReactPhase('go');
      setReactGreenAt(performance.now());
      setReactMsg('CLICK NOW!!');
    }, delay);
    return () => clearTimeout(t);
  }, [event.type, event.id, reactPhase, secondsLeft]);

  // METEOR FORGE: Smooth shrinking timing ring
  useEffect(() => {
    if (event.type !== 'meteor_shield' || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setRingSize((r) => (r <= 18 ? 100 : r - 3.2));
    }, 40);
    return () => clearInterval(t);
  }, [event.type, event.id, secondsLeft]);

  // TAX COLLECTOR: Moves & taxes every 3s if not whacked
  useEffect(() => {
    if (event.type !== 'tax_collector' || !isAffected || secondsLeft <= 0) return;
    const moveTimer = setInterval(() => {
      setTaxPos({ left: 15 + Math.random() * 70, top: 22 + Math.random() * 58 });
      onDrainRef.current?.(0.03);
      setTaxStolenMsg('Tax Collector took 3%! Whack him!');
    }, 3200);
    return () => clearInterval(moveTimer);
  }, [event.type, isAffected, secondsLeft]);

  // UPSIDE DOWN CHAOS: Apply / remove root CSS class
  useEffect(() => {
    if (event.type !== 'upside_down_chaos' || !isAffected || secondsLeft <= 0) {
      document.documentElement.classList.remove('mc-upside-down');
      return;
    }
    const isStabilized = Date.now() < stabilizedUntilMs;
    if (isStabilized) {
      document.documentElement.classList.remove('mc-upside-down');
      const t = setTimeout(() => {
        setStabilizedUntilMs(0);
      }, Math.max(50, stabilizedUntilMs - Date.now()));
      return () => clearTimeout(t);
    }
    document.documentElement.classList.add('mc-upside-down');
    return () => document.documentElement.classList.remove('mc-upside-down');
  }, [event.type, isAffected, secondsLeft, stabilizedUntilMs]);

  // EARTHQUAKE: Apply / remove root CSS class
  useEffect(() => {
    if (event.type !== 'earthquake_buttons' || !isAffected || secondsLeft <= 0) {
      document.documentElement.classList.remove('mc-earthquake');
      return;
    }
    document.documentElement.classList.add('mc-earthquake');
    return () => document.documentElement.classList.remove('mc-earthquake');
  }, [event.type, isAffected, secondsLeft]);

  // BLACKOUT FLASHLIGHT: Track cursor/touch
  useEffect(() => {
    if (event.type !== 'blackout_flashlight' || !isAffected || secondsLeft <= 0) return;
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / Math.max(1, window.innerWidth)) * 100;
      const y = (e.clientY / Math.max(1, window.innerHeight)) * 100;
      setLightPos({ x, y });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [event.type, isAffected, secondsLeft]);

  // FAKE CRASH POP-UPS: Periodically respawn popups if below 6
  useEffect(() => {
    if (event.type !== 'fake_crash_prank' || !isAffected || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setPopups((prev) => {
        if (prev.length >= 9) return prev;
        return [
          ...prev,
          {
            id: Date.now() + Math.random(),
            left: 8 + Math.random() * 64,
            top: 12 + Math.random() * 60,
            title: 'MATTHEW GLITCH DETECTED',
            body: 'Click [X] to clear this pop-up!',
          },
        ];
      });
    }, 3200);
    return () => clearInterval(t);
  }, [event.type, isAffected, secondsLeft]);

  if (secondsLeft <= 0) return null;

  // SAFEZONE BANNER FOR SUMMONER ON BAD SABOTAGE EVENTS
  if (!isGood && !isAffected) {
    return (
      <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[72] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/95 to-cyan-500/95 border-2 border-white/80 text-slate-950 font-black text-xs sm:text-sm uppercase shadow-lg flex items-center gap-2 pointer-events-none">
        <ShieldAlert className="w-5 h-5" />
        <span>Sabotage Active on Everyone Else ({secondsLeft}s) — You Are Immune!</span>
      </div>
    );
  }

  // ==================== 5 BAD SABOTAGE OVERLAYS ====================
  if (!isGood) {
    if (event.type === 'tax_collector') {
      return (
        <div className="fixed inset-0 z-[72] pointer-events-none select-none">
          {taxStolenMsg && (
            <div className="fixed bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-rose-600/95 border border-rose-200 text-white font-black text-xs uppercase shadow-lg">
              {taxStolenMsg} • Whacked: {taxWhacks}
            </div>
          )}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = taxWhacks + 1;
              setTaxWhacks(next);
              setTaxPos({ left: 15 + Math.random() * 70, top: 22 + Math.random() * 58 });
              const refund = Math.max(250, Math.floor(baseProd * 4));
              onAwardCoinsRef.current(refund, 'Tax Refund!');
              setTaxStolenMsg(`Whacked Tax Collector! +${formatCoins(refund)} MC Refund!`);
            }}
            className="pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 p-2.5 rounded-2xl bg-rose-950/90 border-2 border-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.85)] hover:scale-110 active:scale-75 transition-all cursor-pointer flex flex-col items-center gap-1"
            style={{ left: `${taxPos.left}%`, top: `${taxPos.top}%` }}
          >
            <img src="./images/skins/classic_matthew.png" alt="Tax Collector" className="w-16 h-16 object-contain" />
            <span className="px-2 py-0.5 rounded bg-rose-500 text-white text-[10px] font-black uppercase">
              WHACK TAXER!
            </span>
          </button>
        </div>
      );
    }

    if (event.type === 'upside_down_chaos') {
      const stabilized = Date.now() < stabilizedUntilMs;
      return (
        <div className="fixed inset-0 z-[72] pointer-events-none select-none">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              setStabilizedUntilMs(Date.now() + 5500);
              setBoltPos({ left: 15 + Math.random() * 70, top: 22 + Math.random() * 58 });
            }}
            className="pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 px-3.5 py-2 rounded-2xl bg-purple-600/95 border-2 border-purple-200 text-white font-black text-xs uppercase shadow-[0_0_24px_rgba(192,132,252,0.8)] flex items-center gap-1.5 cursor-pointer hover:scale-110"
            style={{ left: `${boltPos.left}%`, top: `${boltPos.top}%` }}
          >
            <RotateCcw className="w-4 h-4" />
            <span>{stabilized ? 'Stabilized (5s)!' : 'Tap to Flip Right-Side Up!'}</span>
          </button>
        </div>
      );
    }

    if (event.type === 'blackout_flashlight') {
      if (flaresCaught >= 5) {
        return (
          <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[72] px-4 py-2 rounded-xl bg-emerald-500/90 text-slate-950 font-black text-xs uppercase">
            5 Flares Lit — Darkness Cleared!
          </div>
        );
      }
      return (
        <div className="fixed inset-0 z-[88] pointer-events-none select-none">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle 135px at ${lightPos.x}% ${lightPos.y}%, transparent 0%, rgba(2,6,23,0.97) 95%)`,
            }}
          />
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              setFlaresCaught((c) => c + 1);
              setFlarePos({ left: 15 + Math.random() * 70, top: 22 + Math.random() * 58 });
              onAwardCoinsRef.current(Math.max(300, Math.floor(baseProd * 5)), 'Flare Orb!');
            }}
            className="pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 px-3 py-2 rounded-full bg-amber-400/95 border-2 border-white text-slate-950 font-black text-xs shadow-[0_0_25px_rgba(251,191,36,0.95)] cursor-pointer animate-pulse flex items-center gap-1"
            style={{ left: `${flarePos.left}%`, top: `${flarePos.top}%` }}
          >
            <Eye className="w-4 h-4" />
            <span>Flare ({flaresCaught}/5)</span>
          </button>
        </div>
      );
    }

    if (event.type === 'earthquake_buttons') {
      return (
        <div className="fixed inset-0 z-[72] pointer-events-none select-none">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              setQuakeTargetsCaught((c) => c + 1);
              setQuakePos({ left: 16 + Math.random() * 68, top: 24 + Math.random() * 56 });
              onAwardCoinsRef.current(Math.max(250, Math.floor(baseProd * 4)), 'Quake Anchor!');
            }}
            className="pointer-events-auto fixed -translate-x-1/2 -translate-y-1/2 px-3.5 py-2 rounded-2xl bg-amber-500/95 border-2 border-yellow-100 text-slate-950 font-black text-xs uppercase shadow-xl cursor-pointer transition-all duration-150"
            style={{ left: `${quakePos.left}%`, top: `${quakePos.top}%` }}
          >
            Catch Quake Core ({quakeTargetsCaught})
          </button>
        </div>
      );
    }

    if (event.type === 'fake_crash_prank') {
      return (
        <div className="fixed inset-0 z-[88] pointer-events-none select-none">
          {popups.map((pop) => (
            <div
              key={pop.id}
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto fixed w-64 rounded-2xl bg-slate-900 border-2 border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.65)] overflow-hidden"
              style={{ left: `${pop.left}%`, top: `${pop.top}%` }}
            >
              <div className="px-3 py-1.5 bg-sky-500 text-slate-950 font-black text-[11px] flex items-center justify-between">
                <span className="flex items-center gap-1 truncate">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {pop.title}
                </span>
                <button
                  type="button"
                  onClick={() => setPopups((prev) => prev.filter((p) => p.id !== pop.id))}
                  className="w-5 h-5 rounded bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3 text-xs font-bold text-slate-200">{pop.body}</div>
            </div>
          ))}
        </div>
      );
    }
  }

  // ==================== 5 GOOD COMPETITIVE ARENA EVENTS ====================
  if (isMinimized) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md select-none"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-3xl rounded-3xl border-2 border-amber-400/70 bg-gradient-to-b from-slate-900 via-indigo-950/90 to-slate-950 shadow-[0_0_65px_rgba(251,191,36,0.4)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 bg-slate-950/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/60 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-black uppercase text-white">
                {event.type === 'lucky_pinata'
                  ? 'Matthew Piñata Party'
                  : event.type === 'memory_simon'
                  ? 'Cryo Pattern Match (Simon Says)'
                  : event.type === 'reaction_duel'
                  ? 'Quick-Draw Reflex Duel'
                  : event.type === 'meteor_shield'
                  ? 'Meteor Coin Forge'
                  : 'Server Jackpot Prize Wheel'}
              </h3>
              <div className="text-[11px] font-bold text-amber-200 flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-white">{secondsLeft}s Left</span>
                {topLeader && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-300 flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-yellow-300" />
                      #1 {topLeader.username} ({formatNumber(topLeader.clicks)})
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onMinimize}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Minimize
          </button>
        </div>

        {/* 1. LUCKY PINATA */}
        {event.type === 'lucky_pinata' && (
          <div className="p-6 flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-xs font-black uppercase text-pink-300">
              SMASH THE CRYSTAL PIÑATA! (Cracks every 20 hits for Gem &amp; Coin Bursts!)
            </div>
            <div className="w-full max-w-sm h-3 rounded-full bg-slate-800 border border-pink-400/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-400 to-yellow-300 transition-all duration-100"
                style={{ width: `${((pinataHits % 20) / 20) * 100}%` }}
              />
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                const next = pinataHits + 1;
                setPinataHits(next);
                setPinataWobble((w) => !w);
                onSubmitScoreRef.current(next);
                const tapCoins = Math.max(120, Math.floor(baseProd * 2.5));
                onAwardCoinsRef.current(tapCoins, 'Piñata Hit');
                if (next % 20 === 0) {
                  setPinataCracks((c) => c + 1);
                  const burst = Math.max(1200, Math.floor(baseProd * 28));
                  onAwardCoinsRef.current(burst, 'PIÑATA BURST!');
                  onAwardGemsRef.current(2);
                  setPinataFlash(`💥 PIÑATA CRACKED! +${formatCoins(burst)} MC & +2 Gems!`);
                }
              }}
              className={`w-44 h-44 rounded-3xl bg-gradient-to-br from-pink-500/30 via-fuchsia-500/20 to-amber-400/30 border-4 border-pink-300 shadow-[0_0_45px_rgba(244,114,182,0.65)] flex items-center justify-center cursor-pointer active:scale-90 transition-transform ${
                pinataWobble ? 'rotate-6' : '-rotate-6'
              }`}
            >
              <img
                src="./images/skins/crystal_matthew.png"
                alt="Piñata"
                draggable={false}
                className="w-32 h-32 object-contain pointer-events-none"
              />
            </button>
            <div className="text-sm font-black text-white">
              Hits: <span className="text-pink-300">{pinataHits}</span> • Bursts:{' '}
              <span className="text-amber-300">{pinataCracks}</span>
            </div>
            {pinataFlash && <div className="text-xs font-black text-emerald-300">{pinataFlash}</div>}
          </div>
        )}

        {/* 2. MEMORY SIMON */}
        {event.type === 'memory_simon' && (
          <div className="p-6 flex flex-col items-center gap-4">
            <div className="text-sm font-black text-emerald-300">{simonStatus}</div>
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              {SIMON_TILES.map((tile) => {
                const isLit = simonLitTile === tile.id;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    disabled={simonShowing}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (simonShowing) return;
                      setSimonLitTile(tile.id);
                      setTimeout(() => setSimonLitTile(null), 180);
                      if (tile.id === simonSeq[simonUserIdx]) {
                        const nextIdx = simonUserIdx + 1;
                        if (nextIdx >= simonSeq.length) {
                          const nextScore = simonScore + simonSeq.length * 10;
                          setSimonScore(nextScore);
                          onSubmitScoreRef.current(nextScore);
                          const reward = Math.max(500, Math.floor(baseProd * simonSeq.length * 6));
                          onAwardCoinsRef.current(reward, `Pattern Round ${simonSeq.length - 2}!`);
                          if (simonSeq.length >= 4) onAwardGemsRef.current(2);
                          setSimonSeq((prev) => [...prev, Math.floor(Math.random() * 4)]);
                        } else {
                          setSimonUserIdx(nextIdx);
                        }
                      } else {
                        setSimonStatus('Oops! Restarting 3-step pattern!');
                        setSimonSeq([
                          Math.floor(Math.random() * 4),
                          Math.floor(Math.random() * 4),
                          Math.floor(Math.random() * 4),
                        ]);
                      }
                    }}
                    className={`h-24 rounded-2xl border-2 ${tile.border} font-black text-lg text-white cursor-pointer transition-all ${
                      isLit ? tile.activeBg : `bg-gradient-to-br ${tile.bg} opacity-85 hover:opacity-100`
                    }`}
                  >
                    {tile.label}
                  </button>
                );
              })}
            </div>
            <div className="text-xs font-black text-slate-300">
              Pattern Score: <span className="text-amber-300">{simonScore}</span>
            </div>
          </div>
        )}

        {/* 3. REACTION DUEL */}
        {event.type === 'reaction_duel' && (
          <div className="p-6 flex flex-col items-center gap-4">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (reactPhase === 'wait') {
                  setReactMsg('TOO SOON! Wait for GREEN!');
                  setReactPhase('result');
                  setTimeout(() => setReactPhase('wait'), 900);
                } else if (reactPhase === 'go') {
                  const ms = Math.max(60, Math.round(performance.now() - reactGreenAt));
                  setReactLastMs(ms);
                  const pts = Math.max(50, 1200 - ms);
                  const nextScore = reactScore + pts;
                  setReactScore(nextScore);
                  onSubmitScoreRef.current(nextScore);
                  const reward = Math.max(400, Math.floor(baseProd * (pts / 45)));
                  onAwardCoinsRef.current(reward, `Reflex ${ms}ms!`);
                  if (ms < 320) onAwardGemsRef.current(2);
                  setReactMsg(`${ms} ms! (+${pts} pts)`);
                  setReactPhase('result');
                  setTimeout(() => {
                    setReactMsg('Wait for GREEN...');
                    setReactPhase('wait');
                  }, 1100);
                }
              }}
              className={`w-full max-w-md h-48 rounded-3xl border-4 font-black text-2xl uppercase cursor-pointer transition-colors ${
                reactPhase === 'go'
                  ? 'bg-emerald-500 border-emerald-200 text-slate-950 shadow-[0_0_50px_rgba(16,185,129,0.85)]'
                  : reactPhase === 'wait'
                  ? 'bg-rose-900/90 border-rose-400 text-rose-100'
                  : 'bg-slate-800 border-amber-400 text-amber-200'
              }`}
            >
              {reactMsg}
            </button>
            <div className="text-xs font-black text-slate-300">
              Total Score: <span className="text-emerald-300">{reactScore}</span>
              {reactLastMs !== null && ` • Last Reflex: ${reactLastMs} ms`}
            </div>
          </div>
        )}

        {/* 4. METEOR COIN FORGE */}
        {event.type === 'meteor_shield' && (
          <div className="p-6 flex flex-col items-center gap-4">
            <div className="text-xs font-black uppercase text-orange-300">{forgeFeedback}</div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                const diff = Math.abs(ringSize - 38);
                if (diff <= 10) {
                  const nextCombo = forgeCombo + 1;
                  const pts = 100 * nextCombo;
                  const nextScore = forgeScore + pts;
                  setForgeCombo(nextCombo);
                  setForgeScore(nextScore);
                  onSubmitScoreRef.current(nextScore);
                  onAwardCoinsRef.current(
                    Math.max(450, Math.floor(baseProd * 10 * nextCombo)),
                    `PERFECT FORGE ${nextCombo}x!`
                  );
                  if (nextCombo % 3 === 0) onAwardGemsRef.current(2);
                  setForgeFeedback(`🔥 PERFECT! (${nextCombo}x Combo)`);
                } else if (diff <= 22) {
                  const nextScore = forgeScore + 35;
                  setForgeScore(nextScore);
                  onSubmitScoreRef.current(nextScore);
                  onAwardCoinsRef.current(Math.max(200, Math.floor(baseProd * 4)), 'Good Forge!');
                  setForgeFeedback('GOOD HIT! (+35 pts)');
                } else {
                  setForgeCombo(0);
                  setForgeFeedback('MISSED SWEET SPOT — Combo Reset!');
                }
                setRingSize(100);
              }}
              className="relative w-48 h-48 rounded-full bg-slate-950 border-2 border-slate-700 flex items-center justify-center cursor-pointer"
            >
              <div
                className="absolute rounded-full border-4 border-amber-300/70 pointer-events-none"
                style={{ width: '38%', height: '38%' }}
              />
              <div
                className="absolute rounded-full border-4 border-orange-400 pointer-events-none"
                style={{ width: `${ringSize}%`, height: `${ringSize}%` }}
              />
              <Flame className="w-12 h-12 text-amber-300 pointer-events-none" />
            </button>
            <div className="text-xs font-black text-slate-200">
              Forge Score: <span className="text-amber-300">{forgeScore}</span> • Combo:{' '}
              <span className="text-orange-300">{forgeCombo}x</span>
            </div>
          </div>
        )}

        {/* 5. COIN JACKPOT WHEEL */}
        {event.type === 'coin_jackpot_wheel' && (
          <div className="p-6 flex flex-col items-center gap-4">
            <div className="relative w-52 h-52 flex items-center justify-center">
              <div className="absolute -top-3 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-white drop-shadow" />
              <div
                className="w-48 h-48 rounded-full border-4 border-yellow-300 shadow-[0_0_35px_rgba(250,204,21,0.5)] flex items-center justify-center transition-transform duration-[2200ms] ease-out"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  background: `conic-gradient(${WHEEL_WEDGES.map(
                    (w, i) => `${w.color} ${i * 60}deg ${(i + 1) * 60}deg`
                  ).join(', ')})`,
                }}
              >
                <div className="w-14 h-14 rounded-full bg-slate-950 border-2 border-yellow-300 flex items-center justify-center text-[10px] font-black text-yellow-200">
                  SPIN
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
              {WHEEL_WEDGES.map((w) => (
                <span
                  key={w.label}
                  className="px-2 py-0.5 rounded text-[10px] font-black text-slate-950"
                  style={{ background: w.color }}
                >
                  {w.label}
                </span>
              ))}
            </div>
            <button
              type="button"
              disabled={wheelSpinsLeft <= 0 || wheelSpinning}
              onClick={() => {
                if (wheelSpinsLeft <= 0 || wheelSpinning) return;
                setWheelSpinning(true);
                setWheelSpinsLeft((s) => s - 1);
                const pick = Math.floor(Math.random() * WHEEL_WEDGES.length);
                const wedge = WHEEL_WEDGES[pick];
                const targetDeg = wheelRotation + 1080 + (360 - (pick * 60 + 30));
                setWheelRotation(targetDeg);
                setTimeout(() => {
                  setWheelSpinning(false);
                  const nextScore = wheelScore + wedge.points;
                  setWheelScore(nextScore);
                  onSubmitScoreRef.current(nextScore);
                  const coinWin = Math.max(1000, Math.floor(baseProd * wedge.mult));
                  onAwardCoinsRef.current(coinWin, `Wheel: ${wedge.label}`);
                  if (wedge.gems > 0) onAwardGemsRef.current(wedge.gems);
                  setWheelResult(`Landed on ${wedge.label}! (+${formatCoins(coinWin)} MC${wedge.gems ? ` & +${wedge.gems} Gems` : ''})`);
                }, 2250);
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-300 to-amber-500 disabled:opacity-40 text-slate-950 font-black text-xs uppercase cursor-pointer"
            >
              {wheelSpinning ? 'Spinning...' : wheelSpinsLeft > 0 ? `Spin Wheel (${wheelSpinsLeft} left)` : 'No Spins Left'}
            </button>
            {wheelResult && <div className="text-xs font-black text-emerald-300 text-center">{wheelResult}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
