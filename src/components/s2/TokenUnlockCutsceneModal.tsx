import React, { useMemo, useState } from 'react';
import { Scene3DCutsceneCanvas, SceneSegment3D, WorldEntity3D } from './Scene3DCutsceneCanvas';
import { soundManager } from '../../audio/soundManager';

interface TokenUnlockCutsceneModalProps {
  onComplete: () => void;
}

/**
 * Fullscreen 3D Perspective Matthew Shop Token Cutscene:
 * - Flies down obsidian crystal monolith hall -> erupts into a giant 3D spinning gold medallion embossed with a bold "M".
 * - Holds alive on center frame showing "YOU FOUND THE MATTHEW SHOP TOKEN!" until clicking CLAIM!
 */
export const TokenUnlockCutsceneModal: React.FC<TokenUnlockCutsceneModalProps> = ({
  onComplete,
}) => {
  const [readyToClaim, setReadyToClaim] = useState(false);

  const scenes = useMemo<SceneSegment3D[]>(() => {
    // Semi-circular crystal amphitheater BEHIND & flanking the token (never blocking the front camera corridor!)
    const crystals: WorldEntity3D[] = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 9) * Math.PI * 1.1 - Math.PI * 0.05;
      crystals.push({
        id: `tk_${i}`,
        kind: 'crystal',
        x: Math.cos(ang) * 5.2,
        y: 0,
        z: 14.4 + Math.sin(ang) * 4.4,
        scale: 1.85,
        tintColor: i % 2 === 0 ? '#fde047' : '#e879f9',
      });
    }

    // CELESTIAL ASCENSION ELEVATOR: Camera sweeps in across unobstructed sightline to rising 360-spinning Matthew Shop Token!
    const ascension: SceneSegment3D = {
      durationMs: 2150,
      skyTop: '#060318',
      skyBottom: '#4c1d95',
      groundNear: '#1e1b4b',
      groundFar: '#020617',
      horizonGlow: 'rgba(250,204,21,0.72)',
      auroraColor: 'rgba(232,121,249,0.58)',
      backdropStyle: 'starfield',
      speedLines: true,
      spotlights: true,
      lightningFlash: true,
      snowCount: 65,
      snowColor: 'rgba(253,224,71,0.85)',
      snowVz: -5.5,
      cameraStart: { x: 0, y: 0.9, z: 7.5 },
      cameraEnd: { x: 0, y: 2.4, z: 8.6, shake: 0.06 },
      cameraOrbit: {
        centerX: 0,
        centerZ: 14,
        radius: 5.8,
        startAngle: -0.75,
        endAngle: 0.28,
        startY: 0.9,
        endY: 2.6,
        lookAtY: 1.85,
      },
      fadeInMs: 220,
      fadeOutMs: 120,
      onEnter: () => soundManager.setMusicTrack('s2_event', true),
      entities: [
        ...crystals,
        {
          id: 'token_rising',
          kind: 'token3d',
          x: 0,
          y: 0.35,
          vy: 0.85,
          z: 14,
          scale: 1.75,
          vr: 3.4,
          bobSpeed: 3.6,
          bobAmp: 0.14,
        },
        ...Array.from({ length: 12 }, (_, i) => {
          const ang = (i / 11) * Math.PI * 1.15 - Math.PI * 0.075;
          return {
            id: `asc_gem_${i}`,
            kind: (i % 2 === 0 ? 'gem' : 'coin') as 'gem' | 'coin',
            x: Math.cos(ang) * 3.4,
            y: 0.85 + (i % 4) * 0.55,
            vy: 0.65,
            z: 14.3 + Math.sin(ang) * 2.5,
            scale: 1.25,
          };
        }),
      ],
    };

    const finaleHold: SceneSegment3D = {
      durationMs: 2500,
      skyTop: '#160730',
      skyBottom: '#b45309',
      groundNear: '#312e81',
      groundFar: '#020617',
      horizonGlow: 'rgba(253,224,71,0.9)',
      auroraColor: 'rgba(244,114,182,0.58)',
      backdropStyle: 'starfield',
      spotlights: true,
      lightningFlash: true,
      snowCount: 75,
      snowColor: 'rgba(254,240,138,0.9)',
      snowVz: -3.2,
      radialBurstAtMs: 40,
      radialBurstColor: '#fde047',
      cameraStart: { x: 0, y: 2.6, z: 8.6, shake: 0.08 },
      cameraEnd: { x: 0, y: 1.75, z: 8.6, shake: 0 },
      cameraOrbit: {
        centerX: 0,
        centerZ: 14,
        radius: 5.4,
        startAngle: 0.28,
        endAngle: 0.0,
        startY: 2.6,
        endY: 1.75,
        lookAtY: 1.55,
      },
      fadeInMs: 120,
      fadeOutMs: 0,
      onEnter: () => soundManager.playTokenUnlock(),
      entities: [
        ...crystals,
        {
          id: 'giant_spinning_m_token',
          kind: 'token3d',
          x: 0,
          y: 0.85,
          z: 14,
          scale: 2.05,
          vr: 2.4,
          bobSpeed: 3.0,
          bobAmp: 0.14,
        },
        ...Array.from({ length: 14 }, (_, i) => {
          const ang = (i / 13) * Math.PI * 1.15 - Math.PI * 0.075;
          return {
            id: `t_coin_${i}`,
            kind: (i % 3 === 0 ? 'gem' : 'coin') as 'gem' | 'coin',
            x: Math.cos(ang) * (3.1 + (i % 2) * 0.9),
            y: 1.1 + (i % 4) * 0.45,
            z: 14.4 + Math.sin(ang) * 2.5,
            scale: 1.25,
            bobSpeed: 4.5 + (i % 3),
            bobAmp: 0.16,
          };
        }),
      ],
    };

    return [ascension, finaleHold];
  }, []);

  const handleClaim = () => {
    soundManager.playBuy();
    soundManager.setMusicTrack('s2_winter');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[140] select-none">
      <Scene3DCutsceneCanvas
        scenes={scenes}
        holdAtEnd
        onReachedEnd={() => setReadyToClaim(true)}
        onComplete={handleClaim}
        zIndexClass="z-[140]"
      />

      {readyToClaim && (
        <div className="fixed inset-0 z-[141] flex flex-col items-center justify-end pb-14 sm:pb-20 px-4 pointer-events-none">
          <div className="flex flex-col items-center text-center animate-fade-in max-w-2xl">
            <div className="px-4 py-1 rounded-full bg-amber-400/20 border border-yellow-300/70 text-xs sm:text-sm font-black uppercase tracking-[0.35em] text-yellow-200 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] animate-pulse">
              Mythic Discovery • 1 In 1,000 Drop
            </div>
            <h2 className="mt-2 text-2xl sm:text-5xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-200 to-amber-500 drop-shadow-[0_6px_32px_rgba(251,191,36,0.85)]">
              YOU FOUND A MATTHEW SHOP TOKEN!
            </h2>
            <p className="mt-2 text-xs sm:text-sm font-bold text-cyan-200/95 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
              Every skin in the Matthew Shop AND every ability Cursor is now 100% FREE to claim!
            </p>
            <button
              onClick={handleClaim}
              className="pointer-events-auto mt-5 px-10 py-3.5 rounded-2xl bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-200 hover:brightness-110 active:scale-95 text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider shadow-[0_0_40px_rgba(251,191,36,0.75)] cursor-pointer transition"
            >
              Claim Token
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
