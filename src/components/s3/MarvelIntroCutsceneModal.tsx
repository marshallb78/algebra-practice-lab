import React, { useMemo, useState } from 'react';
import { Scene3DCutsceneCanvas, SceneSegment3D, WorldEntity3D } from '../s2/Scene3DCutsceneCanvas';
import { ALL_MARVEL_SKINS } from '../../data/season3Skins';
import { INFINITY_GAUNTLET_IMAGE, INFINITY_STONES } from '../../data/infinityGauntlet';
import { soundManager } from '../../audio/soundManager';

interface MarvelIntroCutsceneModalProps {
  onComplete: () => void;
}

const POPULAR_FRONT_IDS = [
  'spider_man_matthew',
  'iron_man_mk3_matthew',
  'captain_america_matthew',
  'hulk_matthew',
  'thor_matthew',
  'black_widow_matthew',
  'scarlet_witch_matthew',
  'black_panther_matthew',
];

/**
 * Season 3 3D-Space 2-Scene Intro Cutscene:
 * - Scene 1: Slow 3D zoom out starting on the main popular Avengers in front, revealing all 44 Marvel characters behind.
 * - Scene 2: Infinity Gauntlet centered in 3D space with 6 Stones orbiting -> pulling into the glove -> golden light burst -> fade to game.
 */
export const MarvelIntroCutsceneModal: React.FC<MarvelIntroCutsceneModalProps> = ({
  onComplete,
}) => {
  const [actIndex, setActIndex] = useState(0);

  const scenes = useMemo<SceneSegment3D[]>(() => {
    const frontSet = new Set(POPULAR_FRONT_IDS);
    const frontSkins = POPULAR_FRONT_IDS.map((id) =>
      ALL_MARVEL_SKINS.find((s) => s.id === id)
    ).filter(Boolean) as typeof ALL_MARVEL_SKINS;
    const backSkins = ALL_MARVEL_SKINS.filter((s) => !frontSet.has(s.id));

    // Front row: Popular Avengers closest to camera, kept lower so back rows stand clearly above them
    const frontEntities: WorldEntity3D[] = frontSkins.map((skin, idx) => {
      const spread = idx - (frontSkins.length - 1) / 2;
      return {
        id: `s1_front_${skin.id}`,
        kind: 'sprite',
        x: spread * 1.25,
        y: -0.25 + (idx % 2) * 0.18,
        z: 8.8 + Math.abs(spread) * 0.25,
        scale: 1.32,
        frames: [skin.image],
        bobSpeed: 3.2 + (idx % 3) * 0.4,
        bobAmp: 0.07,
        glowColor: 'rgba(251,191,36,0.75)',
      };
    });

    // Back rows: All remaining Marvel characters fanned out in elevated stadium arcs above & behind
    const backEntities: WorldEntity3D[] = backSkins.map((skin, idx) => {
      const row = Math.floor(idx / 12);
      const col = idx % 12;
      const spread = col - 5.5;
      return {
        id: `s1_back_${skin.id}`,
        kind: 'sprite',
        x: spread * 1.68,
        y: 1.18 + row * 1.18 + (col % 2) * 0.22,
        z: 13.4 + row * 2.4 + Math.abs(spread) * 0.16,
        scale: 1.38,
        frames: [skin.image],
        bobSpeed: 2.8 + (idx % 4) * 0.3,
        bobAmp: 0.06,
        glowColor: 'rgba(168,85,247,0.55)',
      };
    });

    const seg1: SceneSegment3D = {
      durationMs: 4200,
      skyTop: '#050410',
      skyBottom: '#450a0a',
      groundNear: '#090914',
      groundFar: '#1e1b4b',
      horizonGlow: 'rgba(239,68,68,0.55)',
      auroraColor: 'rgba(251,191,36,0.35)',
      backdropStyle: 'horizon',
      snowCount: 45,
      snowColor: '#fde047',
      snowVz: -4,
      cameraStart: { x: 0, y: 1.05, z: 4.0, pitch: 0.02 },
      cameraEnd: { x: 0, y: 2.55, z: -1.6, pitch: 0.06 },
      fadeInMs: 320,
      fadeOutMs: 280,
      onEnter: () => {
        setActIndex(0);
        soundManager.playStormWaveStart();
      },
      entities: [...backEntities, ...frontEntities],
    };

    // Scene 2: Infinity Gauntlet centered with 6 orbiting stones -> pull in -> golden burst -> fade to game
    const stoneEntities: WorldEntity3D[] = INFINITY_STONES.map((stone, idx) => {
      const a = (idx / INFINITY_STONES.length) * Math.PI * 2;
      return {
        id: `s2_stone_${stone.id}`,
        kind: 'sprite',
        x: Math.cos(a) * 2.1,
        y: 1.1 + Math.sin(a * 2) * 0.35,
        z: 14.5 + Math.sin(a) * 1.3,
        vx: -Math.cos(a) * 0.58,
        vy: -0.15,
        vz: -Math.sin(a) * 0.36,
        scale: 0.92,
        frames: [stone.image],
        bobSpeed: 5,
        bobAmp: 0.1,
        glowColor: stone.glowColor,
      };
    });

    const seg2: SceneSegment3D = {
      durationMs: 4100,
      skyTop: '#070314',
      skyBottom: '#78350f',
      groundNear: '#090514',
      groundFar: '#1e1b4b',
      horizonGlow: 'rgba(250,204,21,0.78)',
      auroraColor: 'rgba(168,85,247,0.48)',
      backdropStyle: 'starfield',
      spotlights: true,
      radialBurstAtMs: 2350,
      radialBurstColor: '#fef08a',
      snowCount: 65,
      snowColor: '#fef08a',
      snowVz: -5,
      cameraStart: { x: 0, y: 1.35, z: 7.5 },
      cameraEnd: { x: 0, y: 1.25, z: 10.6, shake: 0.015 },
      cameraOrbit: {
        centerX: 0,
        centerZ: 14.5,
        radius: 6.2,
        startAngle: -0.45,
        endAngle: 0.45,
        startY: 1.5,
        endY: 1.25,
        lookAtY: 0.9,
      },
      fadeInMs: 240,
      fadeOutMs: 650,
      onEnter: () => {
        setActIndex(1);
        soundManager.playThunder();
      },
      entities: [
        {
          id: 's2_gauntlet',
          kind: 'sprite',
          x: 0,
          y: 0.65,
          z: 14.5,
          scale: 2.55,
          frames: [INFINITY_GAUNTLET_IMAGE],
          bobSpeed: 2.6,
          bobAmp: 0.1,
          glowColor: 'rgba(253,224,71,0.95)',
        },
        ...stoneEntities,
      ],
    };

    return [seg1, seg2];
  }, []);

  const labels = [
    { tag: 'SCENE I • EARTH’S MIGHTIEST', title: 'HEROES & VILLAINS ASSEMBLE' },
    { tag: 'SCENE II • SIX INFINITY STONES', title: 'CLAIM THE INFINITY GAUNTLET' },
  ];
  const curr = labels[actIndex] || labels[0];

  return (
    <div className="fixed inset-0 z-[142] select-none bg-black">
      <Scene3DCutsceneCanvas scenes={scenes} onComplete={onComplete} zIndexClass="z-[142]" />

      <button
        type="button"
        onClick={onComplete}
        className="fixed top-4 right-4 z-[145] px-4 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-amber-400/60 text-amber-200 text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg"
      >
        Skip Intro →
      </button>

      <div className="fixed inset-x-0 bottom-8 sm:bottom-12 z-[144] flex flex-col items-center text-center px-4 pointer-events-none">
        <div className="text-[11px] font-black uppercase tracking-[0.32em] text-amber-300 drop-shadow">
          {curr.tag}
        </div>
        <h2 className="mt-1 text-2xl sm:text-5xl font-black font-marvel uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-300 to-cyan-300 drop-shadow-[0_6px_26px_rgba(0,0,0,0.95)]">
          {curr.title}
        </h2>
      </div>
    </div>
  );
};
