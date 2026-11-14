import React, { useEffect, useState } from 'react';
import { Sparkles, Play, Zap, ShieldCheck, Trophy, Snowflake } from 'lucide-react';
import { soundManager, MusicTrackMode } from '../audio/soundManager';

interface IntroCutsceneModalProps {
  isOpen: boolean;
  onComplete: () => void;
  isCloudLoading?: boolean;
  isFrozenTheme?: boolean;
  willPlayCutsceneAfter?: boolean;
}

const FLOATING_BADGES = [
  { left: '10%', top: '16%', size: 54, delay: '0s', duration: '5.5s', rot: '-12deg' },
  { left: '84%', top: '18%', size: 62, delay: '0.8s', duration: '6.2s', rot: '14deg' },
  { left: '14%', top: '76%', size: 58, delay: '1.3s', duration: '5.8s', rot: '10deg' },
  { left: '82%', top: '74%', size: 50, delay: '0.4s', duration: '6.5s', rot: '-15deg' },
  { left: '48%', top: '10%', size: 42, delay: '1.7s', duration: '5.2s', rot: '8deg' },
];

export const IntroCutsceneModal: React.FC<IntroCutsceneModalProps> = ({
  isOpen,
  onComplete,
  isCloudLoading = false,
  isFrozenTheme = false,
  willPlayCutsceneAfter = false,
}) => {
  const [progress, setProgress] = useState(0);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setProgress(0);
    setIsReadyToPlay(false);
    const startTime = Date.now();
    const durationMs = 2100;

    const loadTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const rawRatio = Math.min(1, elapsed / durationMs);
      const easedPct = Math.min(100, Math.floor((1 - Math.pow(1 - rawRatio, 2.2)) * 100));
      setProgress(easedPct);
      if (rawRatio >= 1) {
        setProgress(100);
        setIsReadyToPlay(true);
        clearInterval(loadTimer);
      }
    }, 35);

    return () => {
      clearInterval(loadTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const loadingStageText =
    progress < 35
      ? isFrozenTheme
        ? 'Preparing Season 2: Frozen Apocalypse & Cloud Sync...'
        : 'Connecting to Matthew Realtime Cloud & Worldwide Leaderboards...'
      : progress < 70
      ? isFrozenTheme
        ? 'Waking Frost Pup Companions, Snowy Homestead & 3D Cutscenes...'
        : 'Loading Weekly Season Schedule, 4x Friday Storm & Collectible Skins...'
      : !isReadyToPlay
      ? 'Synchronizing Ascension Multipliers & Cloud Profile...'
      : isCloudLoading
      ? 'Retrieving your most recent cloud save before starting...'
      : isFrozenTheme
      ? willPlayCutsceneAfter
        ? 'Click PLAY to begin the Season 2 Opening Cutscene!'
        : 'All Systems Frozen & Ready! Click PLAY to enter Season 2!'
      : 'All Systems Ready! Click PLAY to enter Matthew Clicker!';

  const handleStartGame = () => {
    if (!isReadyToPlay || isCloudLoading) return;
    // Direct user gesture reliably unlocks browser AudioContext & HTMLAudioElement playback!
    const targetTrack: MusicTrackMode = isFrozenTheme
      ? willPlayCutsceneAfter
        ? 's2_cutscene'
        : 's2_winter'
      : 'chill';
    if (willPlayCutsceneAfter) {
      soundManager.unlockAndEnsureAudio();
      soundManager.fadeOutMusic(280);
    } else {
      soundManager.unlockAndEnsureAudio(targetTrack);
    }
    soundManager.playSkinUnlock();
    onComplete();
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center text-white select-none p-6 overflow-hidden font-chunky ${
        isFrozenTheme ? 'bg-[#020815]' : 'bg-[#050711]'
      }`}
    >
      <style>{`
        @keyframes introFloat {
          0%, 100% { transform: translateY(0px) rotate(var(--rot, 0deg)) scale(1); }
          50% { transform: translateY(-18px) rotate(calc(var(--rot, 0deg) * -1)) scale(1.08); }
        }
        @keyframes introHeroPulse {
          0%, 100% { transform: scale(1) rotate(-2deg); filter: drop-shadow(0 0 28px rgba(56,189,248,0.55)); }
          50% { transform: scale(1.07) rotate(2deg); filter: drop-shadow(0 0 46px rgba(251,191,36,0.65)); }
        }
        @keyframes introPlayPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(56,189,248,0.5), 0 0 60px rgba(250,204,21,0.3); }
          50% { transform: scale(1.045); box-shadow: 0 0 46px rgba(103,232,249,0.85), 0 0 85px rgba(250,204,21,0.45); }
        }
        @keyframes introShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(220%); }
        }
      `}</style>

      {/* ATMOSPHERIC BACKGROUND GLOW */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isFrozenTheme
            ? 'radial-gradient(ellipse at 50% 35%, rgba(56,189,248,0.22) 0%, rgba(16,185,129,0.12) 38%, rgba(2,6,23,0.98) 78%)'
            : 'radial-gradient(circle at 50% 42%, rgba(245, 158, 11, 0.16) 0%, rgba(56, 189, 248, 0.1) 35%, rgba(5, 7, 17, 0.98) 75%)',
        }}
      />

      {/* FLOATING MATTHEW SILHOUETTES */}
      {FLOATING_BADGES.map((b, i) => (
        <div
          key={i}
          className="absolute pointer-events-none opacity-25"
          style={
            {
              left: b.left,
              top: b.top,
              width: b.size,
              height: b.size,
              '--rot': b.rot,
              animation: `introFloat ${b.duration} ease-in-out ${b.delay} infinite`,
            } as React.CSSProperties
          }
        >
          <img
            src={
              isFrozenTheme && i % 2 === 1
                ? './images/s2/pets/frost_pup_1.png'
                : './images/skins/classic_matthew.png'
            }
            alt=""
            className="w-full h-full object-contain drop-shadow-[0_0_16px_rgba(103,232,249,0.45)]"
          />
        </div>
      ))}

      {/* ANIMATED RINGS */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[26rem] h-[26rem] sm:w-[32rem] sm:h-[32rem] rounded-full border-2 border-dashed animate-spin pointer-events-none ${
          isFrozenTheme ? 'border-cyan-400/25' : 'border-amber-400/30'
        }`}
        style={{ animationDuration: '12s' }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 sm:w-96 sm:h-96 rounded-full border-2 border-dotted border-sky-300/25 animate-spin pointer-events-none"
        style={{ animationDuration: '8s', animationDirection: 'reverse' }}
      />

      {/* MAIN CENTER CONTENT */}
      <div className="relative z-10 flex flex-col items-center max-w-lg w-full text-center">
        {/* HERO EMBLEM */}
        <div
          className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-[2rem] bg-gradient-to-tr from-cyan-400 via-sky-200 to-amber-300 p-1 mb-6 flex items-center justify-center"
          style={{ animation: 'introHeroPulse 2.6s ease-in-out infinite' }}
        >
          <div className="w-full h-full rounded-[1.8rem] bg-[#040a17] flex items-center justify-center p-3 relative overflow-hidden">
            <img
              src="./images/skins/classic_matthew.png"
              alt="Matthew Clicker"
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain relative z-10"
            />
          </div>
          <div className="absolute -bottom-2.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-cyan-300 to-amber-300 text-slate-950 font-black text-[10px] uppercase tracking-widest shadow-lg">
            {isFrozenTheme ? 'Season 2 • Frozen Apocalypse' : 'Weekly Seasons Edition'}
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-cyan-500/15 text-cyan-200 text-xs font-black uppercase tracking-widest mb-2">
          {isFrozenTheme ? (
            <Snowflake className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
          )}
          <span>{isFrozenTheme ? 'Season 2 Major Update' : 'Matthew Clicker • Live Cloud Sync'}</span>
        </div>

        <h1
          className={`text-4xl sm:text-6xl font-black text-transparent bg-clip-text uppercase tracking-tight drop-shadow-[0_4px_24px_rgba(56,189,248,0.4)] ${
            isFrozenTheme
              ? 'bg-gradient-to-r from-cyan-200 via-white to-amber-300'
              : 'bg-gradient-to-r from-yellow-200 via-amber-400 to-cyan-300'
          }`}
        >
          {isFrozenTheme ? 'FROZEN APOCALYPSE' : 'MATTHEW CLICKER'}
        </h1>

        <p className="text-xs sm:text-sm font-bold text-cyan-200/90 mt-2.5 mb-5 min-h-[1.5rem] px-2">
          {loadingStageText}
        </p>

        {/* FEATURE PILLS */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-5 text-[11px] font-black">
          <span className="px-2.5 py-1 rounded-xl bg-white/5 text-amber-300 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" /> {isFrozenTheme ? '96 Upgrades to Vg' : '1-Week Seasons'}
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-white/5 text-cyan-200 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> {isFrozenTheme ? 'Pets & Zombie Raids' : 'Friday 4× Live Event'}
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-white/5 text-emerald-300 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Auto-Save Cloud
          </span>
        </div>

        {/* PROGRESS BAR OR PLAY BUTTON */}
        {!isReadyToPlay ? (
          <div className="w-full max-w-md">
            <div className="relative w-full h-4 rounded-full bg-slate-900/90 overflow-hidden p-0.5 shadow-inner">
              <div
                className="relative h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-200 to-amber-300 transition-all duration-75 overflow-hidden"
                style={{ width: `${progress}%` }}
              >
                <div
                  className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  style={{ animation: 'introShimmer 1.1s linear infinite' }}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-black font-mono text-cyan-200 px-1">
              <span>{isFrozenTheme ? 'LOADING SEASON 2 WORLD...' : 'LOADING ASSETS & CLOUD...'}</span>
              <span>{progress}%</span>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm flex flex-col items-center animate-fade-in">
            <button
              onClick={handleStartGame}
              disabled={isCloudLoading}
              style={{ animation: isCloudLoading ? undefined : 'introPlayPulse 1.6s ease-in-out infinite' }}
              className={`w-full py-4 px-8 rounded-2xl font-black text-xl sm:text-2xl uppercase tracking-wider flex items-center justify-center gap-3 transition ${
                isCloudLoading
                  ? 'bg-slate-800 text-cyan-300 cursor-wait opacity-90'
                  : 'bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-300 hover:brightness-110 active:scale-95 text-slate-950 cursor-pointer shadow-2xl'
              }`}
            >
              {isCloudLoading ? (
                <>
                  <div className="w-6 h-6 border-3 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                  <span className="text-base sm:text-lg">SYNCING LATEST SAVE...</span>
                </>
              ) : (
                <>
                  <Play className="w-7 h-7 fill-slate-950 text-slate-950" />
                  <span>PLAY</span>
                </>
              )}
            </button>
            <span className="mt-2.5 text-[11px] font-bold text-slate-400">
              Tip: Press <strong className="text-cyan-300">SPACEBAR</strong> to click &amp;{' '}
              <strong className="text-amber-300">ESC</strong> for Menu
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
