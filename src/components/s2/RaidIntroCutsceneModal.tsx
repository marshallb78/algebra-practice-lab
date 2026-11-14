import React, { useMemo } from 'react';
import { Scene3DCutsceneCanvas, SceneSegment3D, WorldEntity3D } from './Scene3DCutsceneCanvas';
import { soundManager } from '../../audio/soundManager';

interface RaidIntroCutsceneModalProps {
  onComplete: () => void;
}

const MALE_WALK = [
  './images/s2/zombies/male_walk_1.png',
  './images/s2/zombies/male_walk_2.png',
  './images/s2/zombies/male_walk_3.png',
  './images/s2/zombies/male_walk_4.png',
  './images/s2/zombies/male_walk_5.png',
  './images/s2/zombies/male_walk_6.png',
];

const FEMALE_WALK = [
  './images/s2/zombies/female_walk_1.png',
  './images/s2/zombies/female_walk_2.png',
  './images/s2/zombies/female_walk_3.png',
  './images/s2/zombies/female_walk_4.png',
  './images/s2/zombies/female_walk_5.png',
  './images/s2/zombies/female_walk_6.png',
];

const MALE_ATTACK = [
  './images/s2/zombies/male_attack_1.png',
  './images/s2/zombies/male_attack_2.png',
  './images/s2/zombies/male_attack_3.png',
  './images/s2/zombies/male_attack_4.png',
];

/**
 * Fullscreen 3D Perspective Raid Ambush Cutscene (Zero text, zero borders/bubbles):
 * Camera retreats down dark frosted timber lane while crimson eyes & charging hordes swarm forward.
 */
export const RaidIntroCutsceneModal: React.FC<RaidIntroCutsceneModalProps> = ({ onComplete }) => {
  const scenes = useMemo<SceneSegment3D[]>(() => {
    const woods: WorldEntity3D[] = [];
    for (let z = -2; z <= 34; z += 3) {
      woods.push({ id: `rpL_${z}`, kind: 'pine', x: -4.2, y: 0, z, scale: 1.3 });
      woods.push({ id: `rpR_${z}`, kind: 'pine', x: 4.2, y: 0, z: z + 1.1, scale: 1.3 });
    }

    const eyesScene: SceneSegment3D = {
      durationMs: 2500,
      skyTop: '#050106',
      skyBottom: '#3b0714',
      groundNear: '#09090b',
      groundFar: '#000000',
      horizonGlow: 'rgba(244,63,94,0.38)',
      snowCount: 100,
      snowColor: 'rgba(254,205,211,0.55)',
      snowVz: 7.5,
      cameraStart: { x: 0, y: 1.4, z: 14, yaw: 0, pitch: 0.01, shake: 0.01 },
      cameraEnd: { x: 0, y: 1.2, z: 6, yaw: 0.03, pitch: 0.03, shake: 0.05 },
      fadeInMs: 280,
      fadeOutMs: 240,
      onEnter: () => soundManager.playThunder(),
      entities: [
        ...woods,
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `re_${i}`,
          kind: 'eyes' as const,
          x: ((i % 6) - 2.5) * 1.45,
          y: (i > 5 ? 0.35 : 0.05),
          z: 18 + (i % 4) * 3,
          scale: 1.15,
        })),
      ],
    };

    const swarmRush: SceneSegment3D = {
      durationMs: 3200,
      skyTop: '#08010b',
      skyBottom: '#7f1d1d',
      groundNear: '#111827',
      groundFar: '#020617',
      horizonGlow: 'rgba(244,63,94,0.62)',
      lightningFlash: true,
      snowCount: 130,
      snowVz: 11.0,
      cameraStart: { x: 0, y: 1.25, z: 6, yaw: 0, pitch: 0.02, shake: 0.06 },
      cameraEnd: { x: 0, y: 1.05, z: -1, yaw: -0.04, pitch: 0.05, shake: 0.11 },
      fadeInMs: 200,
      fadeOutMs: 420,
      onEnter: () => soundManager.playStormWaveStart(),
      entities: [
        ...woods,
        { id: 'rz1', kind: 'sprite', x: 0, y: 0, z: 12, vz: -4.2, scale: 1.5, frames: MALE_ATTACK, fps: 12, glowColor: 'rgba(244,63,94,0.8)' },
        { id: 'rz2', kind: 'sprite', x: -1.8, y: 0, z: 14, vz: -4.0, scale: 1.25, frames: FEMALE_WALK, fps: 11 },
        { id: 'rz3', kind: 'sprite', x: 1.8, y: 0, z: 13.5, vz: -4.1, scale: 1.25, frames: MALE_WALK, fps: 11 },
        { id: 'rz4', kind: 'sprite', x: -0.9, y: 0, z: 17, vz: -4.3, scale: 1.18, frames: MALE_WALK, fps: 11 },
        { id: 'rz5', kind: 'sprite', x: 0.9, y: 0, z: 17.5, vz: -4.3, scale: 1.18, frames: FEMALE_WALK, fps: 11 },
      ],
    };

    return [eyesScene, swarmRush];
  }, []);

  return <Scene3DCutsceneCanvas scenes={scenes} onComplete={onComplete} zIndexClass="z-[132]" />;
};
