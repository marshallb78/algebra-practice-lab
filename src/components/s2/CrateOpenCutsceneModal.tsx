import React, { useMemo, useState } from 'react';
import { CRATE_DEFINITIONS, CrateOpenResult } from '../../data/crates';
import { Scene3DCutsceneCanvas, SceneSegment3D, WorldEntity3D } from './Scene3DCutsceneCanvas';
import { CursorVisual } from './CursorVisual';
import { soundManager } from '../../audio/soundManager';

interface CrateOpenCutsceneModalProps {
  result: CrateOpenResult;
  onComplete: (equipReward?: boolean) => void;
}

/**
 * Distinct 3D Cutscenes for Normal Crate (50G) vs Frost Crate (75G):
 * - Normal Crate: Lateral Side-Sweep Inferno Forge Arena using user's normal crate image.
 * - Frost Crate: High-angle Spiral Blizzard Orbit using user's icy crate image.
 */
export const CrateOpenCutsceneModal: React.FC<CrateOpenCutsceneModalProps> = ({
  result,
  onComplete,
}) => {
  const [readyToClaim, setReadyToClaim] = useState(false);
  const isFrost = result.crateType === 'frost';
  const crateImage = CRATE_DEFINITIONS[result.crateType].image;

  const scenes = useMemo<SceneSegment3D[]>(() => {
    const ring: WorldEntity3D[] = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const rad = isFrost ? 4.4 : 4.8;
      ring.push({
        id: `cring_${i}`,
        kind: isFrost ? 'crystal' : i % 2 === 0 ? 'pillar' : 'crystal',
        x: Math.cos(a) * rad,
        y: 0,
        z: 14 + Math.sin(a) * rad,
        scale: isFrost ? 1.85 : 1.5,
        tintColor: isFrost
          ? i % 2 === 0
            ? '#67e8f9'
            : '#38bdf8'
          : i % 2 === 0
          ? '#fb923c'
          : '#fde047',
      });
    }

    const approach: SceneSegment3D = isFrost
      ? {
          durationMs: 1950,
          skyTop: '#010d1f',
          skyBottom: '#0e7490',
          groundNear: '#0c4a6e',
          groundFar: '#020617',
          horizonGlow: 'rgba(56,189,248,0.6)',
          auroraColor: 'rgba(103,232,249,0.45)',
          backdropStyle: 'blizzard',
          snowCount: 105,
          snowColor: 'rgba(224,242,254,0.9)',
          snowVz: -11.5,
          cameraStart: { x: 0, y: 1.5, z: 14, pitch: -0.02 },
          cameraEnd: { x: 0, y: 1.5, z: 14, pitch: -0.06, shake: 0.06 },
          cameraOrbit: {
            centerZ: 14,
            radius: 7.5,
            startAngle: -Math.PI * 0.45,
            endAngle: Math.PI * 0.65,
            startY: 4.5,
            endY: 1.55,
            lookAtY: 0.25,
          },
          fadeInMs: 220,
          fadeOutMs: 150,
          onEnter: () => soundManager.setMusicTrack('s2_event', true),
          entities: [
        ...ring,
        {
          id: 'crate_closed',
          kind: 'sprite',
          x: 0,
          y: 0.15,
          z: 14,
          scale: 1.6,
          frames: [crateImage],
          bobSpeed: 16,
          bobAmp: 0.08,
          glowColor: 'rgba(56,189,248,0.95)',
        },
      ],
        }
      : {
          durationMs: 1850,
          skyTop: '#180504',
          skyBottom: '#9a3412',
          groundNear: '#29150b',
          groundFar: '#020617',
          horizonGlow: 'rgba(251,146,60,0.6)',
          auroraColor: 'rgba(251,191,36,0.38)',
          backdropStyle: 'inferno',
          speedLines: true,
          snowCount: 70,
          snowColor: 'rgba(253,186,116,0.85)',
          snowVz: -9.0,
          cameraStart: { x: 0, y: 1.5, z: 14, pitch: 0.08 },
          cameraEnd: { x: 0, y: 1.5, z: 14, pitch: -0.02, shake: 0.08 },
          cameraOrbit: {
            centerZ: 14,
            radius: 6.2,
            startAngle: -Math.PI * 0.42,
            endAngle: 0,
            startY: 0.85,
            endY: 1.35,
            lookAtY: 0.25,
          },
          fadeInMs: 220,
          fadeOutMs: 150,
          onEnter: () => soundManager.setMusicTrack('s2_event', true),
          entities: [
        ...ring,
        {
          id: 'crate_closed',
          kind: 'sprite',
          x: 0,
          y: 0.15,
          z: 14,
          scale: 1.6,
          frames: [crateImage],
          bobSpeed: 16,
          bobAmp: 0.08,
          glowColor: 'rgba(251,146,60,0.95)',
        },
      ],
        };

    const rewardSprite =
      result.rewardKind === 'skin' && result.skin
        ? result.skin.image
        : result.rewardKind === 'cursor' && result.cursor
        ? result.cursor.image
        : null;

    const revealEntities: WorldEntity3D[] = [
      ...ring,
      {
        id: 'crate_open',
        kind: 'sprite',
        x: 0,
        y: -0.15,
        z: 14.3,
        scale: 1.25,
        frames: [crateImage],
        alpha: 0.55,
        glowColor: isFrost ? 'rgba(103,232,249,0.9)' : 'rgba(251,191,36,0.9)',
      },
      ...(rewardSprite
        ? [
            {
              id: 'crate_reward_sprite',
              kind: 'sprite' as const,
              x: 0,
              y: 0.95,
              z: 13.6,
              scale: result.rewardKind === 'skin' ? 1.6 : 1.2,
              frames: [rewardSprite],
              bobSpeed: 3.8,
              bobAmp: 0.14,
              glowColor: isFrost ? 'rgba(56,189,248,0.95)' : 'rgba(251,146,60,0.95)',
            },
          ]
        : []),
      ...Array.from({ length: 14 }, (_, i) => ({
        id: `cr_part_${i}`,
        kind: (isFrost ? 'gem' : i % 2 === 0 ? 'coin' : 'gem') as 'gem' | 'coin',
        x: Math.cos((i / 14) * Math.PI * 2) * 2.5,
        y: 0.75 + (i % 3) * 0.42,
        z: 13.9 + Math.sin((i / 14) * Math.PI * 2) * 1.3,
        scale: 1.35,
        bobSpeed: 4.2 + (i % 3),
        bobAmp: 0.14,
      })),
    ];

    const revealHold: SceneSegment3D = {
      durationMs: 2100,
      skyTop: isFrost ? '#04142c' : '#260805',
      skyBottom: isFrost ? '#0369a1' : '#b45309',
      groundNear: isFrost ? '#0c4a6e' : '#431407',
      groundFar: '#020617',
      horizonGlow: isFrost ? 'rgba(103,232,249,0.78)' : 'rgba(251,191,36,0.75)',
      auroraColor: isFrost ? 'rgba(56,189,248,0.52)' : 'rgba(249,115,22,0.48)',
      backdropStyle: isFrost ? 'blizzard' : 'inferno',
      spotlights: true,
      lightningFlash: true,
      snowCount: isFrost ? 100 : 75,
      snowColor: isFrost ? 'rgba(186,230,253,0.95)' : 'rgba(253,224,71,0.9)',
      snowVz: -4.8,
      radialBurstAtMs: 60,
      radialBurstColor: isFrost ? '#67e8f9' : '#fb923c',
      cameraStart: { x: 0, y: 1.25, z: 9.6, shake: 0.1 },
      cameraEnd: { x: 0, y: 1.35, z: 9.2, shake: 0 },
      cameraOrbit: {
        centerX: 0,
        centerZ: 13.8,
        radius: 4.3,
        startAngle: isFrost ? 0.15 : -0.08,
        endAngle: isFrost ? 0.55 : -0.45,
        startY: 1.25,
        endY: 1.45,
        lookAtY: 0.85,
      },
      fadeInMs: 140,
      fadeOutMs: 0,
      onEnter: () => soundManager.playChestOpen(),
      entities: revealEntities,
    };

    return [approach, revealHold];
  }, [crateImage, isFrost, result]);

  const title = isFrost ? 'FROST CRATE UNLOCKED!' : 'NORMAL CRATE UNLOCKED!';
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
    <div className="fixed inset-0 z-[135] select-none">
      <Scene3DCutsceneCanvas
        scenes={scenes}
        holdAtEnd
        onReachedEnd={() => setReadyToClaim(true)}
        onComplete={() => onComplete(false)}
        zIndexClass="z-[135]"
      />

      {readyToClaim && (
        <div className="fixed inset-0 z-[136] flex flex-col items-center justify-end pb-12 sm:pb-16 px-4 pointer-events-none">
          <div className="flex flex-col items-center text-center animate-fade-in max-w-xl">
            <div
              className={`px-3.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-widest ${
                isFrost
                  ? 'bg-cyan-500/20 border-cyan-300/70 text-cyan-200'
                  : 'bg-orange-500/20 border-amber-300/70 text-amber-200'
              }`}
            >
              {rewardRarity}
            </div>

            {result.rewardKind === 'cursor' && result.cursor && (
              <div className="mt-3 p-3 rounded-2xl bg-slate-950/75 border border-white/15 backdrop-blur-md">
                <CursorVisual cursor={result.cursor} size={56} />
              </div>
            )}

            <h2
              className={`mt-2 text-2xl sm:text-4xl font-black uppercase tracking-wide text-transparent bg-clip-text drop-shadow-[0_6px_22px_rgba(0,0,0,0.95)] ${
                isFrost
                  ? 'bg-gradient-to-b from-white via-cyan-200 to-sky-400'
                  : 'bg-gradient-to-b from-white via-amber-200 to-orange-500'
              }`}
            >
              {title}
            </h2>

            <div className="mt-1.5 text-lg sm:text-2xl font-black text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.95)]">
              {rewardTitle}
            </div>
            <p className="mt-1 text-xs sm:text-sm font-bold text-slate-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              {rewardDetail}
            </p>
            {result.isDuplicate && (
              <div className="mt-2 px-3 py-1 rounded-xl bg-fuchsia-500/25 border border-fuchsia-300 text-fuchsia-200 text-xs font-black">
                Duplicate Converted: +{result.refundGems} Gems Refunded!
              </div>
            )}

            <div className="pointer-events-auto mt-5 flex flex-wrap items-center justify-center gap-3">
              {!result.isDuplicate && (
                <button
                  onClick={() => {
                    soundManager.playBuy();
                    onComplete(true);
                  }}
                  className={`px-7 py-3 rounded-2xl font-black text-sm uppercase tracking-wider cursor-pointer transition hover:brightness-110 active:scale-95 text-slate-950 ${
                    isFrost
                      ? 'bg-gradient-to-r from-cyan-300 via-sky-300 to-white shadow-[0_0_30px_rgba(56,189,248,0.7)]'
                      : 'bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-200 shadow-[0_0_30px_rgba(251,146,60,0.7)]'
                  }`}
                >
                  Equip &amp; Claim
                </button>
              )}
              <button
                onClick={() => {
                  soundManager.playBuy();
                  onComplete(false);
                }}
                className="px-7 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/25 text-white font-black text-sm uppercase tracking-wider cursor-pointer transition"
              >
                Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

