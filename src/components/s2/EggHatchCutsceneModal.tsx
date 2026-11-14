import React, { useMemo, useState } from 'react';
import { EggRarity } from '../../types/game';
import {
  getEggDefinition,
  getPetAnimationFrames,
  getPetSpeciesDefinition,
} from '../../data/petsAndEggs';
import { Scene3DCutsceneCanvas, SceneSegment3D, WorldEntity3D } from './Scene3DCutsceneCanvas';
import { soundManager } from '../../audio/soundManager';

interface EggHatchCutsceneModalProps {
  rarity: EggRarity;
  speciesId: string;
  onComplete: () => void;
}

/**
 * Fullscreen 3D Perspective Egg Hatching Cutscene:
 * Flight through ancient crystal shrine -> egg shatters -> animated pet bounds out & waits for Claim Pet!
 */
export const EggHatchCutsceneModal: React.FC<EggHatchCutsceneModalProps> = ({
  rarity,
  speciesId,
  onComplete,
}) => {
  const [readyToClaim, setReadyToClaim] = useState(false);
  const def = useMemo(() => getEggDefinition(rarity), [rarity]);
  const speciesSpec = useMemo(() => getPetSpeciesDefinition(speciesId, rarity), [speciesId, rarity]);

  const scenes = useMemo<SceneSegment3D[]>(() => {
    const petFrames = getPetAnimationFrames(speciesId);

    const crystals: WorldEntity3D[] = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      crystals.push({
        id: `ec_${i}`,
        kind: 'crystal',
        x: Math.cos(ang) * 3.8,
        y: 0,
        z: 14 + Math.sin(ang) * 3.8,
        scale: 1.4,
        tintColor: def.color,
      });
    }

    // SHRINE ORBIT + HEARTBEAT EGG VIBRATION -> LOW-ANGLE HERO HATCH REVEAL!
    const incubateOrbit: SceneSegment3D = {
      durationMs: 2200,
      skyTop: '#030816',
      skyBottom: '#0c3559',
      groundNear: '#091b30',
      groundFar: '#020617',
      horizonGlow: def.glowColor,
      auroraColor: def.glowColor,
      backdropStyle: 'vortex',
      snowCount: 70,
      snowVz: -4.0,
      cameraStart: { x: 0, y: 1.8, z: 10 },
      cameraEnd: { x: 0, y: 1.0, z: 10.5, shake: 0.09 },
      cameraOrbit: {
        centerX: 0,
        centerZ: 14,
        radius: 3.9,
        startAngle: 0.1,
        endAngle: Math.PI * 1.15,
        startY: 2.1,
        endY: 0.95,
        lookAtY: 0.65,
      },
      fadeInMs: 260,
      fadeOutMs: 160,
      onEnter: () => soundManager.playChestOpen(),
      entities: [
        ...crystals,
        {
          id: 'hatch_egg',
          kind: 'sprite',
          x: 0,
          y: 0.35,
          z: 14,
          scale: 1.38,
          frames: [def.eggImage],
          bobSpeed: 18,
          bobAmp: 0.16,
          glowColor: def.glowColor,
        },
      ],
    };

    const hatchHold: SceneSegment3D = {
      durationMs: 2300,
      skyTop: '#020c1b',
      skyBottom: '#084c61',
      groundNear: '#0c2a44',
      groundFar: '#020617',
      horizonGlow: speciesSpec.glowColor,
      auroraColor: speciesSpec.glowColor,
      spotlights: true,
      snowCount: 85,
      snowVz: -3.0,
      radialBurstAtMs: 70,
      radialBurstColor: speciesSpec.color,
      cameraStart: { x: 0, y: 0.85, z: 10.5, shake: 0.11 },
      cameraEnd: { x: 0, y: 1.0, z: 10.2, shake: 0 },
      cameraOrbit: {
        centerX: 0,
        centerZ: 14,
        radius: 3.3,
        startAngle: Math.PI * 1.15,
        endAngle: Math.PI * 2.0,
        startY: 0.85,
        endY: 1.1,
        lookAtY: 0.75,
      },
      fadeInMs: 120,
      fadeOutMs: 0,
      onEnter: () => soundManager.playSkinUnlock(),
      entities: [
        ...crystals,
        {
          id: 'hatched_pet',
          kind: 'sprite',
          x: 0,
          y: 0.15,
          z: 14,
          scale: 1.75,
          frames: petFrames,
          fps: 9,
          bobSpeed: 5,
          bobAmp: 0.12,
          glowColor: speciesSpec.glowColor,
        },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `hatch_gem_${i}`,
          kind: 'gem' as const,
          x: Math.cos((i / 8) * Math.PI * 2) * 2.1,
          y: 0.7 + (i % 3) * 0.35,
          z: 14 + Math.sin((i / 8) * Math.PI * 2) * 1.8,
          scale: 1.15,
          bobSpeed: 4,
          bobAmp: 0.12,
        })),
      ],
    };

    return [incubateOrbit, hatchHold];
  }, [def, speciesSpec, speciesId]);

  const handleClaim = () => {
    soundManager.playBuy();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[138] select-none">
      <Scene3DCutsceneCanvas
        scenes={scenes}
        holdAtEnd
        onReachedEnd={() => setReadyToClaim(true)}
        onComplete={handleClaim}
        zIndexClass="z-[138]"
      />

      {readyToClaim && (
        <div className="fixed inset-0 z-[139] flex flex-col items-center justify-end pb-12 sm:pb-18 px-4 pointer-events-none">
          <div className="flex flex-col items-center text-center animate-fade-in max-w-xl">
            <div
              className="text-xs sm:text-sm font-black uppercase tracking-[0.28em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]"
              style={{ color: speciesSpec.color }}
            >
              {speciesSpec.rarityLabel} • {def.rarity} Hatched
            </div>
            <h2 className="mt-1 text-3xl sm:text-5xl font-black uppercase tracking-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.95)]">
              {speciesSpec.name}
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-bold text-slate-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              +{(speciesSpec.baseMultiplierBonus * 100).toFixed(0)}% Click Power • {speciesSpec.baseDps} Base Zombie DPS
            </p>
            <button
              onClick={handleClaim}
              className="pointer-events-auto mt-5 px-10 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-300 hover:brightness-110 active:scale-95 text-slate-950 font-black text-base uppercase tracking-wider shadow-[0_0_35px_rgba(56,189,248,0.65)] cursor-pointer transition"
            >
              Claim Pet
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
