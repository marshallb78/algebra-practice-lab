import React, { useMemo, useState } from 'react';
import { ChestLootResult, getEggDefinition } from '../../data/petsAndEggs';
import { Scene3DCutsceneCanvas, SceneSegment3D, WorldEntity3D } from './Scene3DCutsceneCanvas';
import { soundManager } from '../../audio/soundManager';
import { formatCoins } from '../../utils/formatters';

interface ChestOpenCutsceneModalProps {
  loot: ChestLootResult;
  onComplete: () => void;
}

/**
 * Fullscreen 3D Perspective Frozen Treasury Vault Opening Cutscene:
 * Flies down pillar hall -> chest bursts open -> holds alive showcasing Egg, Coins, Gems & rare drops until you click CLAIM!
 */
export const ChestOpenCutsceneModal: React.FC<ChestOpenCutsceneModalProps> = ({
  loot,
  onComplete,
}) => {
  const [readyToClaim, setReadyToClaim] = useState(false);

  const eggDef = useMemo(
    () => (loot.eggRarity ? getEggDefinition(loot.eggRarity) : null),
    [loot.eggRarity]
  );
  const isTreasureCacheOnly =
    !eggDef && !loot.foundMatthewShopToken && !loot.foundSkinId;

  const scenes = useMemo<SceneSegment3D[]>(() => {
    // Back/flanking timber amphitheater so trees never cross between the camera and the chest/reward
    const perimeter: WorldEntity3D[] = [];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 7) * Math.PI;
      perimeter.push({
        id: `vp_${i}`,
        kind: 'pine',
        x: Math.cos(ang) * 6.0,
        y: 0,
        z: 15.2 + Math.sin(ang) * 5.2,
        scale: 1.25,
      });
    }

    // SKY-SLAM CHEST DROP: camera starts pitched UP into the storm clouds watching chest rocket straight down from high sky!
    const skyDrop: SceneSegment3D = {
      durationMs: 2150,
      skyTop: '#020617',
      skyBottom: '#0c4a6e',
      groundNear: '#0f172a',
      groundFar: '#020617',
      horizonGlow: 'rgba(56,189,248,0.52)',
      auroraColor: 'rgba(251,191,36,0.28)',
      backdropStyle: 'blizzard',
      snowCount: 75,
      snowVz: -6.0,
      cameraStart: { x: 0, y: 0.85, z: 8.5, pitch: 0.44, shake: 0.01 },
      cameraEnd: { x: 0, y: 1.25, z: 9.2, pitch: -0.03, shake: 0.12 },
      fadeInMs: 220,
      fadeOutMs: 140,
      entities: [
        ...perimeter,
        {
          id: 'falling_chest',
          kind: 'sprite',
          x: 0,
          y: 11.0,
          vy: -5.1,
          z: 14.5,
          scale: 1.75,
          frames: ['./images/s2/chest/pixel_closed.png'],
          glowColor: 'rgba(251,191,36,0.9)',
        },
      ],
    };

    const burstHold: SceneSegment3D = {
      durationMs: 2250,
      skyTop: '#070b1e',
      skyBottom: '#78350f',
      groundNear: '#1e1b4b',
      groundFar: '#020617',
      horizonGlow: 'rgba(251,191,36,0.65)',
      auroraColor: 'rgba(250,204,21,0.38)',
      spotlights: true,
      snowCount: 85,
      snowColor: 'rgba(253,224,71,0.82)',
      snowVz: -3.5,
      radialBurstAtMs: 60,
      radialBurstColor: '#fbbf24',
      cameraStart: { x: 0, y: 0.9, z: 9.8, pitch: 0.08, shake: 0.14 },
      cameraEnd: { x: 0, y: 1.35, z: 9.2, pitch: -0.02, shake: 0 },
      fadeInMs: 120,
      fadeOutMs: 0,
      onEnter: () => {
        soundManager.playChestOpen();
        if (isTreasureCacheOnly) {
          setTimeout(() => soundManager.playSkinUnlock(), 240);
          setTimeout(() => soundManager.playBuy(), 520);
        }
      },
      entities: [
        ...perimeter,
        {
          id: 'open_chest',
          kind: 'sprite',
          x: 0,
          y: 0,
          z: 14.5,
          scale: isTreasureCacheOnly ? 1.65 : 1.5,
          frames: ['./images/s2/chest/pixel_open.png'],
          glowColor: 'rgba(251,191,36,0.9)',
        },
        ...(eggDef
          ? [
              {
                id: 'loot_egg',
                kind: 'sprite' as const,
                x: 0,
                y: 0.95,
                z: 13.8,
                scale: 1.4,
                frames: [eggDef.eggImage],
                bobSpeed: 4,
                bobAmp: 0.14,
                glowColor: eggDef.glowColor,
              },
            ]
          : []),
        ...Array.from({ length: eggDef ? 10 : 24 }, (_, i) => {
          const total = eggDef ? 10 : 24;
          const ang = (i / (total - 1)) * Math.PI;
          const ring = i < 12 ? 1.85 : 2.95;
          return {
            id: `burst_gem_${i}`,
            kind: (i % 2 === 0 ? 'gem' : 'coin') as 'gem' | 'coin',
            x: Math.cos(ang) * (eggDef ? 2.4 : ring),
            y: 0.65 + (i % 4) * 0.42,
            z: 14.55 + Math.sin(ang) * (eggDef ? 1.3 : 1.65),
            scale: eggDef ? 1.25 : 1.6,
            bobSpeed: 3.5 + (i % 4) * 0.6,
            bobAmp: isTreasureCacheOnly ? 0.22 : 0.14,
          };
        }),
      ],
    };

    return [skyDrop, burstHold];
  }, [eggDef, isTreasureCacheOnly]);

  const handleClaim = () => {
    soundManager.playBuy();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[132] select-none">
      <Scene3DCutsceneCanvas
        scenes={scenes}
        holdAtEnd
        onReachedEnd={() => setReadyToClaim(true)}
        onComplete={handleClaim}
        zIndexClass="z-[132]"
      />

      {readyToClaim && (
        <div className="fixed inset-0 z-[133] flex flex-col items-center justify-end pb-12 sm:pb-16 px-4 pointer-events-none">
          <div className="flex flex-col items-center text-center animate-fade-in max-w-xl w-full">
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-200 to-amber-500 drop-shadow-[0_6px_22px_rgba(0,0,0,0.95)]">
              {isTreasureCacheOnly ? 'TREASURE JACKPOT!' : 'CHEST OPENED!'}
            </h2>

            {isTreasureCacheOnly ? (
              <div className="mt-3.5 grid grid-cols-2 gap-3 w-full max-w-md">
                {loot.coins > 0 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-b from-amber-500/30 to-slate-950/90 border-2 border-amber-300/80 shadow-[0_0_32px_rgba(251,191,36,0.45)] flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-200">
                      Coin Cache
                    </span>
                    <span className="mt-1 text-xl sm:text-2xl font-black text-amber-300 drop-shadow">
                      +{formatCoins(loot.coins)}
                    </span>
                  </div>
                )}
                <div className="p-3.5 rounded-2xl bg-gradient-to-b from-fuchsia-500/30 to-slate-950/90 border-2 border-fuchsia-300/80 shadow-[0_0_32px_rgba(217,70,239,0.45)] flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-200">
                    Gem Haul
                  </span>
                  <span className="mt-1 text-xl sm:text-2xl font-black text-fuchsia-300 drop-shadow">
                    +{loot.gems} 💎
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3 text-sm sm:text-base font-black drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)]">
                {loot.coins > 0 && (
                  <>
                    <span className="text-amber-300">+{formatCoins(loot.coins)} Coins</span>
                    <span className="text-white/40">•</span>
                  </>
                )}
                <span className="text-fuchsia-300">+{loot.gems} Gems</span>
                {loot.eggRarity && eggDef && (
                  <>
                    <span className="text-white/40">•</span>
                    <span style={{ color: eggDef.color }}>+1 {loot.eggRarity}</span>
                  </>
                )}
                {loot.foundMatthewShopToken && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="text-amber-300 animate-pulse">1/1000 MATTHEW SHOP TOKEN!</span>
                  </>
                )}
                {loot.foundSkinId && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="text-emerald-300">NEW SKIN UNLOCKED!</span>
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleClaim}
              className="pointer-events-auto mt-5 px-10 py-3.5 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-cyan-300 hover:brightness-110 active:scale-95 text-slate-950 font-black text-base uppercase tracking-wider shadow-[0_0_35px_rgba(251,191,36,0.7)] cursor-pointer transition"
            >
              Claim Loot
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
