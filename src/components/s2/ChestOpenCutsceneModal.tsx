import React, { useEffect, useMemo, useState } from 'react';
import { ChestLootResult, getInfinityStoneDefinition } from '../../data/infinityGauntlet';
import { soundManager } from '../../audio/soundManager';
import { formatCoins } from '../../utils/formatters';
import { Crown, Gem, Sparkles } from 'lucide-react';

interface ChestOpenCutsceneModalProps {
  loot: ChestLootResult;
  onComplete: () => void;
}

const CHEST_FRAMES = [
  './images/s3/chest/marvel_chest_closed.png',
  './images/s3/chest/marvel_chest_f1.png',
  './images/s3/chest/marvel_chest_f2.png',
  './images/s3/chest/marvel_chest_open.png',
];

/**
 * Short Interactive Center-Screen Marvel Chest Cutscene:
 * Scales chest up into center -> smoothly plays closed-to-open reference frames ->
 * reveals rewards -> click anywhere to continue.
 */
export const ChestOpenCutsceneModal: React.FC<ChestOpenCutsceneModalProps> = ({
  loot,
  onComplete,
}) => {
  const [frameIdx, setFrameIdx] = useState(0);
  const [canDismiss, setCanDismiss] = useState(false);

  const stoneDef = useMemo(
    () => (loot.foundInfinityStone ? getInfinityStoneDefinition(loot.foundInfinityStone) : null),
    [loot.foundInfinityStone]
  );

  useEffect(() => {
    // Preload all frames cleanly
    CHEST_FRAMES.forEach((src) => {
      const i = new Image();
      i.src = src;
    });

    soundManager.playChestOpen();
    const t1 = window.setTimeout(() => setFrameIdx(1), 85);
    const t2 = window.setTimeout(() => setFrameIdx(2), 170);
    const t3 = window.setTimeout(() => {
      setFrameIdx(3);
      setCanDismiss(true);
      soundManager.playBuy();
      if (loot.foundInfinityStone || loot.foundMatthewShopToken) {
        soundManager.playSkinUnlock();
      }
    }, 260);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [loot.foundInfinityStone, loot.foundMatthewShopToken]);

  const isOpened = frameIdx >= 3;

  return (
    <div
      onClick={() => {
        if (canDismiss) onComplete();
      }}
      className={`fixed inset-0 z-[185] bg-slate-950/92 flex flex-col items-center justify-center p-4 select-none overflow-hidden ${
        canDismiss ? 'cursor-pointer' : 'cursor-wait'
      }`}
    >
      <style>{`
        @keyframes marvelChestScaleIn {
          0% { transform: scale(0.32) translateY(60px); opacity: 0.35; }
          60% { transform: scale(1.16) translateY(-6px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes marvelLootPop {
          0% { transform: scale(0.55) translateY(26px); opacity: 0; }
          75% { transform: scale(1.07) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Center glow behind chest */}
      <div
        className="w-72 h-72 rounded-full absolute pointer-events-none transition-all duration-500"
        style={{
          background: stoneDef
            ? `radial-gradient(circle, ${stoneDef.glowColor} 0%, transparent 70%)`
            : 'radial-gradient(circle, rgba(250,204,21,0.45) 0%, transparent 70%)',
          transform: isOpened ? 'scale(1.35)' : 'scale(0.8)',
          opacity: isOpened ? 0.95 : 0.45,
        }}
      />

      {/* Smooth Crossfade Multi-Frame Chest Stack */}
      <div
        className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center"
        style={{ animation: 'marvelChestScaleIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        {CHEST_FRAMES.map((src, idx) => (
          <img
            key={src}
            src={src}
            alt="Marvel Mystery Chest"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                idx < 2 ? './images/s2/chest/pixel_closed.png' : './images/s2/chest/pixel_open.png';
            }}
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-75 pointer-events-none drop-shadow-[0_14px_30px_rgba(250,204,21,0.55)]"
            style={{ opacity: frameIdx === idx ? 1 : 0 }}
          />
        ))}
      </div>

      {/* Reward Cards */}
      {isOpened && (
        <div
          className="relative z-10 mt-3 flex flex-col items-center gap-3 text-center max-w-md w-full"
          style={{ animation: 'marvelLootPop 0.35s ease-out forwards' }}
        >
          {loot.foundMatthewShopToken && (
            <div className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/30 via-yellow-400/20 to-amber-500/30 border-2 border-yellow-300 flex items-center justify-center gap-2.5 shadow-[0_0_28px_rgba(250,204,21,0.65)]">
              <Crown className="w-6 h-6 text-yellow-300" />
              <span className="text-sm font-black uppercase text-yellow-200">
                MATTHEW SHOP TOKEN UNLOCKED! (EVERYTHING FREE FOREVER)
              </span>
            </div>
          )}

          {stoneDef && (
            <div
              className="w-full p-4 rounded-2xl bg-slate-900/95 border-2 flex items-center gap-3.5 shadow-2xl"
              style={{ borderColor: stoneDef.color, boxShadow: `0 0 32px ${stoneDef.glowColor}` }}
            >
              <img src={stoneDef.image} alt={stoneDef.name} className="w-14 h-14 object-contain shrink-0" />
              <div className="text-left">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  1-in-75 Infinity Stone Drop!
                </div>
                <div className="text-lg font-black font-marvel uppercase" style={{ color: stoneDef.color }}>
                  {stoneDef.name}
                </div>
                <div className="text-xs font-bold text-slate-300">{stoneDef.powerLore}</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 flex-wrap w-full">
            <div className="px-4 py-2.5 rounded-2xl bg-amber-950/85 border-2 border-amber-400/70 text-amber-200 font-black text-base shadow-lg">
              +{formatCoins(loot.coins)} Coins
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-fuchsia-950/85 border-2 border-fuchsia-400/70 text-fuchsia-200 font-black text-base flex items-center gap-1.5 shadow-lg">
              <Gem className="w-4 h-4 text-fuchsia-300" />+{loot.gems} Gems
            </div>
          </div>

          <div className="mt-2 px-5 py-2 rounded-full bg-white/10 border border-white/25 text-xs font-black uppercase tracking-widest text-white animate-pulse">
            Click anywhere to continue
          </div>
        </div>
      )}
    </div>
  );
};
