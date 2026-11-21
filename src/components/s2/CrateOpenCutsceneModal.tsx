import React, { useEffect, useState } from 'react';
import { CRATE_DEFINITIONS, CrateOpenResult } from '../../data/crates';
import { CursorVisual } from './CursorVisual';
import { soundManager } from '../../audio/soundManager';
import { Sparkles } from 'lucide-react';

interface CrateOpenCutsceneModalProps {
  result: CrateOpenResult;
  onComplete: (equipReward?: boolean) => void;
}

/**
 * Upgraded Marvel Crate Opening Cutscene:
 * Plays dedicated crate suspense music (`s2_mystery`) + rising fanfare,
 * shakes & supercharges the Marvel Crate -> Cosmic Beam Rupture -> Reward Showcase,
 * then returns music cleanly back to the Avengers theme when claimed.
 */
export const CrateOpenCutsceneModal: React.FC<CrateOpenCutsceneModalProps> = ({
  result,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'charge' | 'burst' | 'reveal'>('charge');
  const crateSpec = CRATE_DEFINITIONS[result.crateType];

  const isCosmic = result.crateType === 'wakanda' || result.crateType === 'infinity';
  const accentHex =
    result.crateType === 'infinity'
      ? '#facc15'
      : result.crateType === 'wakanda'
      ? '#c084fc'
      : result.crateType === 'stark'
      ? '#ef4444'
      : '#fb923c';

  useEffect(() => {
    // Dedicated Crate suspense music track (distinct from Avengers main BGM)
    soundManager.setMusicTrack('s2_mystery', true);
    soundManager.playChestOpen();

    const tBurst = window.setTimeout(() => {
      setPhase('burst');
      soundManager.playCutsceneBoom();
    }, 950);

    const tReveal = window.setTimeout(() => {
      setPhase('reveal');
      soundManager.playSkinUnlock();
    }, 1450);

    return () => {
      window.clearTimeout(tBurst);
      window.clearTimeout(tReveal);
    };
  }, [result.crateType]);

  const finishAndRestoreBgm = (equipReward: boolean) => {
    soundManager.playBuy();
    soundManager.setMusicTrack('s3_marvel', true);
    onComplete(equipReward);
  };

  const rewardTitle =
    result.rewardKind === 'cursor' && result.cursor
      ? result.cursor.name
      : result.skin?.name || 'Reward';
  const rewardRarity =
    result.rewardKind === 'cursor' && result.cursor
      ? `Cursor • ${result.cursor.rarity}`
      : `Skin • ${result.skin?.rarity || 'Rare'}`;
  const rewardDetail =
    result.rewardKind === 'cursor' && result.cursor
      ? result.cursor.abilitySummary
      : result.skin?.description || '';

  return (
    <div className="fixed inset-0 z-[135] bg-slate-950/94 flex flex-col items-center justify-center p-4 select-none overflow-hidden">
      <style>{`
        @keyframes crateChargeShake {
          0%, 100% { transform: translate(0, 0) scale(1); }
          20% { transform: translate(-6px, 3px) rotate(-3deg) scale(1.06); }
          40% { transform: translate(6px, -4px) rotate(3deg) scale(1.1); }
          60% { transform: translate(-8px, -2px) rotate(-4deg) scale(1.14); }
          80% { transform: translate(8px, 4px) rotate(4deg) scale(1.18); }
        }
        @keyframes crateRewardPop {
          0% { transform: scale(0.45) translateY(30px); opacity: 0; }
          75% { transform: scale(1.06) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Radial Energy Glow */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-500"
        style={{
          width: phase === 'burst' ? '120vmax' : phase === 'reveal' ? '440px' : '280px',
          height: phase === 'burst' ? '120vmax' : phase === 'reveal' ? '440px' : '280px',
          background: `radial-gradient(circle, ${accentHex}aa 0%, ${accentHex}22 45%, transparent 72%)`,
          opacity: phase === 'burst' ? 0.95 : phase === 'reveal' ? 0.55 : 0.4,
        }}
      />

      {phase !== 'reveal' && (
        <div className="relative z-10 flex flex-col items-center text-center gap-4">
          <div className="text-xs font-black uppercase tracking-[0.3em] text-amber-300">
            UNLOCKING {crateSpec.name.toUpperCase()}...
          </div>
          <img
            src={crateSpec.image}
            alt={crateSpec.name}
            className="w-52 h-52 sm:w-64 sm:h-64 object-contain drop-shadow-[0_0_32px_rgba(251,191,36,0.75)]"
            style={{
              animation: phase === 'charge' ? 'crateChargeShake 0.45s infinite' : undefined,
              transform: phase === 'burst' ? 'scale(1.45)' : undefined,
              transition: 'transform 0.28s ease-out',
            }}
          />
        </div>
      )}

      {phase === 'reveal' && (
        <div
          className="relative z-10 flex flex-col items-center text-center max-w-lg w-full gap-3"
          style={{ animation: 'crateRewardPop 0.35s ease-out forwards' }}
        >
          <div
            className="px-4 py-1 rounded-full border text-xs font-black uppercase tracking-widest flex items-center gap-1.5"
            style={{
              backgroundColor: `${accentHex}22`,
              borderColor: `${accentHex}99`,
              color: accentHex,
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {rewardRarity}
          </div>

          <div
            className="w-44 h-44 sm:w-56 sm:h-56 rounded-3xl bg-slate-900/90 border-2 p-4 flex items-center justify-center shadow-2xl"
            style={{
              borderColor: `${accentHex}99`,
              boxShadow: `0 0 42px ${accentHex}55`,
            }}
          >
            {result.rewardKind === 'cursor' && result.cursor ? (
              <CursorVisual cursor={result.cursor} size={112} />
            ) : (
              <img
                src={result.skin?.image || crateSpec.image}
                alt={rewardTitle}
                className="w-full h-full object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.85)]"
              />
            )}
          </div>

          <h2 className="text-2xl sm:text-4xl font-black font-marvel uppercase tracking-wide text-white drop-shadow">
            {rewardTitle}
          </h2>
          <p className="text-xs sm:text-sm font-bold text-slate-300 max-w-md">{rewardDetail}</p>

          {result.isDuplicate && (
            <div className="px-3.5 py-1.5 rounded-xl bg-fuchsia-500/25 border border-fuchsia-300 text-fuchsia-200 text-xs font-black">
              Duplicate Converted: +{result.refundGems} Gems Refunded!
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            {!result.isDuplicate && (
              <button
                type="button"
                onClick={() => finishAndRestoreBgm(true)}
                className={`px-7 py-3 rounded-2xl font-black text-sm uppercase tracking-wider cursor-pointer transition hover:brightness-110 active:scale-95 text-slate-950 ${
                  isCosmic
                    ? 'bg-gradient-to-r from-purple-300 via-fuchsia-300 to-amber-300 shadow-[0_0_26px_rgba(192,132,252,0.65)]'
                    : 'bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200 shadow-[0_0_26px_rgba(251,146,60,0.65)]'
                }`}
              >
                Equip &amp; Claim
              </button>
            )}
            <button
              type="button"
              onClick={() => finishAndRestoreBgm(false)}
              className="px-7 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/25 text-white font-black text-sm uppercase tracking-wider cursor-pointer transition"
            >
              Claim
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
