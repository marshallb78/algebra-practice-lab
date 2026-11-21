import React, { useEffect } from 'react';
import { GameState } from '../types/game';
import { formatCoins, formatTime } from '../utils/formatters';
import { isAuthorizedDevUid } from '../config/gameConfig';
import { INFINITY_GAUNTLET_IMAGE, INFINITY_STONES } from '../data/infinityGauntlet';
import { soundManager } from '../audio/soundManager';
import {
  Clock,
  Trophy,
  Palette,
  Menu,
  ShieldAlert,
  UserCheck,
  Sparkles,
  FlaskConical,
  Wrench,
  Volume2,
} from 'lucide-react';

interface SeasonDowntimeModalProps {
  isOpen: boolean;
  state: GameState;
  seasonNumber: number;
  downtimeRemainingSeconds: number;
  onOpenLeaderboard: () => void;
  onOpenSkins: () => void;
  onOpenEscMenu: () => void;
  onOpenAccount?: () => void;
  onEnterSandboxS2?: () => void;
  onOpenDevTools?: () => void;
}

/**
 * Cinematic Weekend / Pre-Launch Season Downtime Overlay:
 * Features animated cosmic Infinity Gauntlet visuals + original cinematic synth anthem (`s3_downtime`).
 * Devs have a dedicated button to skip Downtime into Season 3: Marvel with full cutscenes (Leaderboards OFF).
 */
export const SeasonDowntimeModal: React.FC<SeasonDowntimeModalProps> = ({
  isOpen,
  state,
  seasonNumber,
  downtimeRemainingSeconds,
  onOpenLeaderboard,
  onOpenSkins,
  onOpenEscMenu,
  onOpenAccount,
  onEnterSandboxS2,
  onOpenDevTools,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    soundManager.setMusicTrack('s3_downtime', true);
  }, [isOpen]);

  if (!isOpen) return null;

  const isDev = isAuthorizedDevUid(state.cloudAccount?.uid);

  return (
    <div
      onPointerDown={() => soundManager.unlockAndEnsureAudio()}
      className="fixed inset-0 z-[105] bg-[#04020d] flex items-center justify-center p-4 overflow-y-auto select-none"
    >
      {/* Cinematic Animated Cosmic Nebula & Radial Rings */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(168,85,247,0.28),rgba(220,38,38,0.16)_42%,rgba(2,6,23,0.98)_80%)] pointer-events-none" />
      <div
        className="absolute w-[620px] h-[620px] rounded-full border border-amber-400/15 animate-spin pointer-events-none"
        style={{ animationDuration: '32s' }}
      />
      <div
        className="absolute w-[440px] h-[440px] rounded-full border border-purple-400/20 animate-spin pointer-events-none"
        style={{ animationDuration: '20s', animationDirection: 'reverse' }}
      />

      <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-[#0c0a1d]/92 border-2 border-amber-400/50 p-6 sm:p-9 text-center shadow-[0_0_90px_rgba(168,85,247,0.35)] my-auto backdrop-blur-xl">
        {/* Orbiting Infinity Stones + Gauntlet Centerpiece */}
        <div className="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400/25 via-purple-500/20 to-red-500/25 blur-xl animate-pulse" />
          <img
            src={INFINITY_GAUNTLET_IMAGE}
            alt="Season 3 Infinity Gauntlet"
            className="w-24 h-24 object-contain relative z-10 drop-shadow-[0_0_24px_rgba(251,191,36,0.75)]"
          />
          {INFINITY_STONES.map((stone, idx) => {
            const angle = (idx / INFINITY_STONES.length) * Math.PI * 2 - Math.PI / 2;
            const r = 56;
            return (
              <img
                key={stone.id}
                src={stone.image}
                alt={stone.name}
                className="w-6 h-6 object-contain absolute z-20 animate-pulse"
                style={{
                  left: `calc(50% + ${Math.cos(angle) * r}px - 12px)`,
                  top: `calc(50% + ${Math.sin(angle) * r}px - 12px)`,
                  filter: `drop-shadow(0 0 8px ${stone.glowColor})`,
                }}
              />
            );
          })}
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] font-black uppercase tracking-[0.2em]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Official Season Intermission</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-300 to-purple-300 uppercase tracking-tight mt-3">
          SEASON DOWNTIME
        </h1>

        <p className="text-xs sm:text-sm font-bold text-slate-300 mt-2 max-w-lg mx-auto">
          The Multiverse is resetting! Get ready for{' '}
          <span className="text-amber-300 font-black">Season 3: MARVEL</span> — featuring 44 Marvel Matthew skins, 8 Marvel cursors, 4 crates &amp; the Infinity Gauntlet Snap!
        </p>

        {/* Big Countdown Box */}
        <div className="mt-5 p-5 rounded-2xl bg-slate-950/90 border border-amber-400/35 shadow-inner">
          <div className="flex items-center justify-center gap-2 text-amber-300 text-[11px] font-black uppercase tracking-[0.25em]">
            <Clock className="w-4 h-4" />
            <span>Season 3: Marvel Launches In</span>
          </div>
          <div className="text-3xl sm:text-5xl font-black font-mono text-white mt-2 tracking-wider drop-shadow-[0_0_20px_rgba(251,191,36,0.45)]">
            {formatTime(downtimeRemainingSeconds)}
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-purple-300/90">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Tap anywhere if audio is paused to hear the Downtime Anthem</span>
          </div>
        </div>

        {/* Account & Stats Row */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] font-black text-slate-400 uppercase">
              Season #{seasonNumber} Score
            </div>
            <div className="text-base font-black text-amber-300 mt-0.5">
              {formatCoins(state.seasonalScore || 0)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="text-[10px] font-black text-slate-400 uppercase">
              Skins Unlocked (Kept Forever)
            </div>
            <div className="text-base font-black text-emerald-300 mt-0.5">
              {state.unlockedSkins.length} Matthews
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
          {onOpenAccount && (
            <button
              onClick={onOpenAccount}
              className="py-3 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-400 text-emerald-200 hover:text-slate-950 border border-emerald-400/50 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {state.cloudAccount ? state.cloudAccount.displayUsername : 'Sign In'}
              </span>
            </button>
          )}
          <button
            onClick={onOpenLeaderboard}
            className="py-3 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition"
          >
            <Trophy className="w-4 h-4 shrink-0" />
            <span>Leaderboard</span>
          </button>
          <button
            onClick={onOpenSkins}
            className="py-3 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-400 text-cyan-200 hover:text-slate-950 border border-cyan-400/50 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span>My Skins</span>
          </button>
          <button
            onClick={onOpenEscMenu}
            className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Menu className="w-4 h-4 shrink-0" />
            <span>Menu</span>
          </button>
        </div>

        {!state.cloudAccount && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/35 border border-emerald-500/35 text-xs font-bold text-emerald-200 flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Sign in before Season 3 launches so your skins &amp; score are saved to Cloud!</span>
          </div>
        )}

        {/* EXCLUSIVE DEV BUTTON: Skip Downtime & Play Season 3 Cutscenes (Leaderboards OFF) */}
        {isDev && (
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap p-4 rounded-2xl bg-gradient-to-r from-red-950/60 via-purple-950/60 to-amber-950/50 border-2 border-amber-400/60 shadow-xl">
            {onEnterSandboxS2 && (
              <button
                onClick={() => {
                  soundManager.unlockAndEnsureAudio();
                  onEnterSandboxS2();
                }}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-400 via-amber-300 to-purple-400 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm uppercase flex items-center gap-2 cursor-pointer shadow-lg transition active:scale-95"
              >
                <FlaskConical className="w-4 h-4" />
                <span>Test Season 3</span>
              </button>
            )}
            {onOpenDevTools && (
              <button
                onClick={onOpenDevTools}
                className="px-4 py-3.5 rounded-xl bg-amber-400/20 hover:bg-amber-400 text-amber-200 hover:text-slate-950 border border-amber-400/50 font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer transition"
              >
                <Wrench className="w-4 h-4" />
                <span>Dev Tools</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
