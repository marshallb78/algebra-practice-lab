import React from 'react';
import { GameState } from '../types/game';
import { formatCoins, formatNumber, formatTime } from '../utils/formatters';
import { Clock, ShieldAlert, Trophy, Settings, Eye, FlaskConical, Wrench, User } from 'lucide-react';
import { isVerifiedLiveDevSession } from '../firebase/moderation';

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
  if (!isOpen) return null;

  const careerClicks = Math.max(state.lifetimeAllSeasonsClicks || 0, state.clicks || 0);
  const activeUsername = state.cloudAccount?.displayUsername || state.cloudAccount?.username;
  const isDev = isVerifiedLiveDevSession(state.cloudAccount?.uid);

  return (
    <div className="fixed inset-0 z-[45] w-screen h-screen flex flex-col items-center justify-center bg-[#060914] text-white select-none p-6 overflow-y-auto font-chunky">
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] rounded-full border-2 border-dashed border-amber-500/20 animate-spin pointer-events-none"
        style={{ animationDuration: '18s' }}
      />

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center text-center">
        <div
          onDoubleClick={() => onOpenAccount?.()}
          className="w-24 h-24 rounded-3xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mb-4 shadow-[0_0_35px_rgba(251,191,36,0.45)] animate-pulse"
        >
          <ShieldAlert className="w-12 h-12 text-amber-300" />
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-cyan-300 uppercase tracking-tight">
          SEASON DOWNTIME
        </h1>

        {/* BIG COUNTDOWN TIMER */}
        <div className="my-6 px-8 py-6 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-cyan-400/25 shadow-2xl">
          <span className="text-xs font-black uppercase tracking-widest text-cyan-300 flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4" /> Next Season Starts Monday In
          </span>
          <div className="text-4xl sm:text-6xl font-black font-mono text-yellow-300 mt-2 drop-shadow-[0_0_25px_rgba(250,204,21,0.6)]">
            {formatTime(downtimeRemainingSeconds)}
          </div>
        </div>

        {/* VISUAL SUMMARY TILES */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10">
            <span className="text-[10px] font-black uppercase text-slate-400">
              Season #{seasonNumber} Score
            </span>
            <p className="text-lg font-black text-amber-300 mt-1">
              {formatCoins(Math.max(state.seasonalScore || 0, state.lifetimeCoins || 0))}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10">
            <span className="text-[10px] font-black uppercase text-emerald-300">Skins Saved ✓</span>
            <p className="text-lg font-black text-white mt-1">
              {state.unlockedSkins.length} Matthews
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10">
            <span className="text-[10px] font-black uppercase text-emerald-300">Playtime ✓</span>
            <p className="text-lg font-black text-white mt-1">
              {formatTime(state.totalPlaytimeSeconds)}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10">
            <span className="text-[10px] font-black uppercase text-emerald-300">Clicks ✓</span>
            <p className="text-lg font-black text-white mt-1">{formatNumber(careerClicks)}</p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={onOpenLeaderboard}
            className="px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase flex items-center gap-2 cursor-pointer transition shadow-lg btn-chunky"
          >
            <Trophy className="w-5 h-5" />
            <span>Standings</span>
          </button>

          <button
            onClick={onOpenSkins}
            className="px-6 py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm uppercase flex items-center gap-2 cursor-pointer transition shadow-lg btn-chunky"
          >
            <Eye className="w-5 h-5" />
            <span>My Skins</span>
          </button>

          {onOpenAccount && (
            <button
              onClick={onOpenAccount}
              className="px-6 py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs sm:text-sm uppercase flex items-center gap-2 cursor-pointer transition shadow-lg btn-chunky"
            >
              <User className="w-5 h-5" />
              <span>{activeUsername ? activeUsername : 'Sign In'}</span>
            </button>
          )}

          <button
            onClick={onOpenEscMenu}
            className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border-2 border-slate-600 font-black text-xs sm:text-sm uppercase flex items-center gap-2 cursor-pointer transition"
          >
            <Settings className="w-5 h-5 text-cyan-400" />
            <span>Menu (ESC)</span>
          </button>
        </div>

        {/* EXCLUSIVE DEV PREVIEW & CONTROLS (Shown ONLY to verified authorized dev UIDs) */}
        {isDev && (
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap p-4 rounded-2xl bg-cyan-950/50 border-2 border-cyan-400/50">
            {onEnterSandboxS2 && (
              <button
                onClick={onEnterSandboxS2}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs sm:text-sm uppercase flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <FlaskConical className="w-4 h-4" />
                <span>Test Season 2 Now</span>
              </button>
            )}
            {onOpenDevTools && (
              <button
                onClick={onOpenDevTools}
                className="px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase flex items-center gap-2 cursor-pointer shadow-lg"
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
