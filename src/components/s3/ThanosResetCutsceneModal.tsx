import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../../audio/soundManager';

interface ThanosResetCutsceneModalProps {
  isOpen: boolean;
  onResetCoinsNow: () => void;
  onComplete: () => void;
}

/**
 * Season 3: Periodic Thanos Coin-Reset Cinematic Event (every 5-10 minutes).
 * Giant Thanos face fills the screen and rolls down, resets coins to 0 (keeping upgrades & CPS),
 * holds at 0 Coins for 2 seconds so the player sees 0, then resumes clicking & CPS.
 */
export const ThanosResetCutsceneModal: React.FC<ThanosResetCutsceneModalProps> = ({
  isOpen,
  onResetCoinsNow,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'rolling' | 'hold_zero'>('rolling');
  const onResetRef = useRef(onResetCoinsNow);
  onResetRef.current = onResetCoinsNow;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isOpen) return;
    setPhase('rolling');
    soundManager.playThunder();

    const t1 = window.setTimeout(() => {
      onResetRef.current();
      soundManager.playCutsceneBoom();
      setPhase('hold_zero');
    }, 2100);

    const t2 = window.setTimeout(() => {
      onCompleteRef.current();
    }, 4100); // 2.0s holding at 0 Coins before clicking & CPS resume

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[152] select-none overflow-hidden flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-sm">
      {/* Cosmic Purple & Crimson Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.38),rgba(127,29,29,0.28)_55%,rgba(2,6,23,0.92)_90%)] pointer-events-none" />

      {phase === 'rolling' ? (
        <div
          className="relative z-10 flex flex-col items-center justify-center pointer-events-none"
          style={{ animation: 'thanosFaceRollDown 2.1s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
        >
          <img
            src="./images/s3/skins/infinity_thanos_matthew.png"
            alt="Thanos"
            className="w-[84vmin] h-[84vmin] max-w-none object-contain drop-shadow-[0_0_65px_rgba(168,85,247,0.95)]"
          />
          <div className="-mt-6 px-6 py-2.5 rounded-2xl bg-slate-950/90 border-2 border-purple-400 text-center shadow-[0_0_40px_rgba(168,85,247,0.75)]">
            <div className="text-2xl sm:text-4xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-amber-300 to-rose-400">
              THANOS ARRIVED!
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
              Wiping your Coins — keeping all Upgrades &amp; CPS!
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 px-7 py-5 rounded-3xl bg-slate-950/92 border-2 border-amber-400/75 text-center shadow-[0_0_60px_rgba(251,191,36,0.45)] animate-fade-in">
          <div className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
            Coins Reset to Zero
          </div>
          <div className="text-4xl sm:text-6xl font-black text-amber-300 my-1.5 font-mono">
            0 Coins
          </div>
          <div className="text-xs font-bold text-emerald-300">
            Your Marvel Upgrades &amp; CPS are safe — resuming in 2s...
          </div>
        </div>
      )}
    </div>
  );
};
