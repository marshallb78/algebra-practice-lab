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

export const NEW_GOOD_EVENT_TYPES = new Set<GlobalEventType>([]);

export const NEW_BAD_EVENT_TYPES = new Set<GlobalEventType>([
  'upside_down_chaos',
  'blackout_flashlight',
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

  // Reset all mini-game state on new event ID
  useEffect(() => {
    setPinataHits(0);
    setPinataCracks(0);
    setPinataFlash(null);
    setWheelSpinsLeft(3);
    setWheelRotation(0);
    setStabilizedUntilMs(0);
    setFlaresCaught(0);
  }, [event.id, event.type]);

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

  // ==================== BAD SABOTAGE OVERLAYS ====================
  if (!isGood) {
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
                Global Live Event
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

      </div>
    </div>
  );
};
