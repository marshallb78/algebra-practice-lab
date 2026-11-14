import React, { useMemo, useState } from 'react';
import { Scene3DCutsceneCanvas, SceneSegment3D, WorldEntity3D } from './Scene3DCutsceneCanvas';
import { soundManager } from '../../audio/soundManager';
import { ChevronRight } from 'lucide-react';

interface FrozenIntroCutsceneModalProps {
  onComplete: () => void;
}

const ZOMBIE_MALE_WALK = [
  './images/s2/zombies/male_walk_1.png',
  './images/s2/zombies/male_walk_2.png',
  './images/s2/zombies/male_walk_3.png',
  './images/s2/zombies/male_walk_4.png',
  './images/s2/zombies/male_walk_5.png',
  './images/s2/zombies/male_walk_6.png',
];

const ZOMBIE_FEMALE_WALK = [
  './images/s2/zombies/female_walk_1.png',
  './images/s2/zombies/female_walk_2.png',
  './images/s2/zombies/female_walk_3.png',
  './images/s2/zombies/female_walk_4.png',
  './images/s2/zombies/female_walk_5.png',
  './images/s2/zombies/female_walk_6.png',
];

const ZOMBIE_MALE_ATTACK = [
  './images/s2/zombies/male_attack_1.png',
  './images/s2/zombies/male_attack_2.png',
  './images/s2/zombies/male_attack_3.png',
  './images/s2/zombies/male_attack_4.png',
];

const FROST_PUP_RUN = [
  './images/s2/pets/frost_pup_1.png',
  './images/s2/pets/frost_pup_2.png',
  './images/s2/pets/frost_pup_3.png',
  './images/s2/pets/frost_pup_4.png',
];

const FOX_RUN = [
  './images/s2/pets/aurora_fox_1.png',
  './images/s2/pets/aurora_fox_2.png',
  './images/s2/pets/aurora_fox_3.png',
  './images/s2/pets/aurora_fox_4.png',
];

const WYVERN_FLY = [
  './images/s2/pets/cryo_wyvern_1.png',
  './images/s2/pets/cryo_wyvern_2.png',
  './images/s2/pets/cryo_wyvern_3.png',
  './images/s2/pets/cryo_wyvern_4.png',
];

const PHOENIX_FLY = [
  './images/s2/pets/frost_phoenix_1.png',
  './images/s2/pets/frost_phoenix_2.png',
  './images/s2/pets/frost_phoenix_3.png',
  './images/s2/pets/frost_phoenix_4.png',
];

function buildForestAndFence(startZ: number, endZ: number, stepZ = 3): WorldEntity3D[] {
  const list: WorldEntity3D[] = [];
  for (let z = startZ; z <= endZ; z += stepZ) {
    list.push({ id: `fL_${z}`, kind: 'fence', x: -3.2, y: 0, z, scale: 1 });
    list.push({ id: `fR_${z}`, kind: 'fence', x: 3.2, y: 0, z, scale: 1 });
    list.push({ id: `pL_${z}`, kind: 'pine', x: -5.4 - ((z * 13) % 3), y: 0, z: z + 0.5, scale: 1.15 });
    list.push({ id: `pR_${z}`, kind: 'pine', x: 5.4 + ((z * 17) % 3), y: 0, z: z + 0.9, scale: 1.15 });
  }
  return list;
}

const FINALE_FLAKES = Array.from({ length: 34 }, (_, i) => ({
  id: i,
  left: (i * 37) % 100,
  size: 2 + (i % 4),
  delay: (i * 0.27) % 6,
  duration: 4.5 + (i % 5) * 1.1,
  opacity: 0.35 + (i % 4) * 0.14,
}));

const ACT_CAPTIONS: Record<number, { chapter: string; line: string }> = {
  1: {
    chapter: 'ACT I • GOLDEN VALLEY',
    line: 'Before the blizzard fell, Matthew and his Frost Pup guarded the valley of coins...',
  },
  2: {
    chapter: 'ACT II • THE BLOOD BLIZZARD',
    line: 'Then the sky cracked open — and the Undead Horde marched through the pines.',
  },
  3: {
    chapter: 'ACT III • UNDER SIEGE',
    line: 'They scattered the vault... until Matthew’s companions refused to back down!',
  },
  4: {
    chapter: 'ACT IV • FROST GUARDIANS UNLEASHED',
    line: 'Wyverns, Foxes & the Frost Phoenix ignited a counter-blizzard of pure cryo power!',
  },
};

export const FrozenIntroCutsceneModal: React.FC<FrozenIntroCutsceneModalProps> = ({
  onComplete,
}) => {
  const [activeAct, setActiveAct] = useState<number>(1);
  const [finaleTitleVisible, setFinaleTitleVisible] = useState(false);
  const [finaleReady, setFinaleReady] = useState(false);
  const [exiting, setExiting] = useState(false);

  const cutsceneScenes = useMemo<SceneSegment3D[]>(() => {
    const act1: SceneSegment3D = {
      durationMs: 4100,
      skyTop: '#0c2340',
      skyBottom: '#fbbf24',
      groundNear: '#1e3a2f',
      groundFar: '#0f172a',
      horizonGlow: 'rgba(253,224,71,0.48)',
      auroraColor: 'rgba(251,191,36,0.28)',
      backdropStyle: 'horizon',
      spotlights: true,
      snowCount: 24,
      snowColor: 'rgba(254,240,138,0.5)',
      snowVz: -2.2,
      cameraStart: { x: -3.5, y: 2.1, z: 3.0, yaw: 0.14, pitch: -0.02 },
      cameraEnd: { x: 2.2, y: 1.55, z: 10.2, yaw: -0.08, pitch: 0.01 },
      cameraOrbit: {
        centerX: 0,
        centerZ: 15.8,
        radius: 13.5,
        startAngle: -0.42,
        endAngle: 0.34,
        startY: 2.25,
        endY: 1.48,
        lookAtY: 1.05,
      },
      fadeInMs: 650,
      fadeOutMs: 380,
      onEnter: () => {
        setActiveAct(1);
        soundManager.unlockAndEnsureAudio('s2_cutscene');
        soundManager.setMusicTrack('s2_cutscene', true);
      },
      entities: [
        ...buildForestAndFence(0, 26, 2.8),
        { id: 'gold_1', kind: 'coin', x: -1.1, y: 0.25, z: 15.2, scale: 1.4, bobSpeed: 3, bobAmp: 0.08 },
        { id: 'gold_2', kind: 'coin', x: 1.0, y: 0.22, z: 15.4, scale: 1.35, bobSpeed: 3.4, bobAmp: 0.08 },
        { id: 'gold_3', kind: 'coin', x: 0.1, y: 0.35, z: 15.8, scale: 1.5, bobSpeed: 2.8, bobAmp: 0.1 },
        {
          id: 'matthew_calm',
          kind: 'sprite',
          x: 0,
          y: 0,
          z: 16.5,
          scale: 1.35,
          frames: ['./images/skins/classic_matthew.png'],
          bobSpeed: 2,
          bobAmp: 0.06,
          glowColor: 'rgba(250,204,21,0.55)',
        },
        {
          id: 'pup_calm',
          kind: 'sprite',
          x: -1.65,
          y: 0,
          z: 15.6,
          scale: 0.78,
          frames: FROST_PUP_RUN,
          fps: 6,
        },
      ],
    };

    const act2: SceneSegment3D = {
      durationMs: 4300,
      skyTop: '#090314',
      skyBottom: '#7f1d1d',
      groundNear: '#0f172a',
      groundFar: '#020617',
      horizonGlow: 'rgba(239,68,68,0.55)',
      auroraColor: 'rgba(248,113,113,0.34)',
      backdropStyle: 'inferno',
      speedLines: true,
      lightningFlash: true,
      snowCount: 95,
      snowColor: 'rgba(224,242,254,0.85)',
      snowVz: 8.5,
      cameraStart: { x: 0.6, y: 1.55, z: 10.5, yaw: 0.06, pitch: -0.02, shake: 0.02 },
      cameraEnd: { x: -0.3, y: 1.28, z: 1.2, yaw: -0.06, pitch: 0.03, shake: 0.095 },
      fadeInMs: 360,
      fadeOutMs: 380,
      onEnter: () => {
        setActiveAct(2);
        soundManager.playThunder();
      },
      entities: [
        ...buildForestAndFence(-2, 30, 2.6),
        { id: 'cr1', kind: 'crystal', x: -3.9, y: 0, z: 14, scale: 1.2 },
        { id: 'cr2', kind: 'crystal', x: 4.1, y: 0, z: 18, scale: 1.45 },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `eyes_${i}`,
          kind: 'eyes' as const,
          x: (i - 3.5) * 1.4,
          y: 0.15,
          z: 24 + (i % 3) * 3,
          scale: 1,
        })),
        { id: 'zw1', kind: 'sprite', x: -1.6, y: 0, z: 22, vz: -3.9, scale: 1.15, frames: ZOMBIE_MALE_WALK, fps: 10 },
        { id: 'zw2', kind: 'sprite', x: 1.7, y: 0, z: 21, vz: -4.1, scale: 1.1, frames: ZOMBIE_FEMALE_WALK, fps: 10 },
        { id: 'zw3', kind: 'sprite', x: 0, y: 0, z: 19.5, vz: -3.6, scale: 1.35, frames: ZOMBIE_MALE_ATTACK, fps: 11, glowColor: 'rgba(244,63,94,0.55)' },
        { id: 'zw4', kind: 'sprite', x: -0.8, y: 0, z: 25, vz: -4.3, scale: 1.05, frames: ZOMBIE_FEMALE_WALK, fps: 11 },
        { id: 'zw5', kind: 'sprite', x: 1.0, y: 0, z: 26, vz: -4.4, scale: 1.05, frames: ZOMBIE_MALE_WALK, fps: 11 },
      ],
    };

    const act3: SceneSegment3D = {
      durationMs: 4200,
      skyTop: '#040814',
      skyBottom: '#1e3a5f',
      groundNear: '#0b192c',
      groundFar: '#020617',
      horizonGlow: 'rgba(244,63,94,0.44)',
      auroraColor: 'rgba(34,211,238,0.32)',
      backdropStyle: 'blizzard',
      speedLines: true,
      lightningFlash: true,
      snowCount: 95,
      snowVz: -9.5,
      cameraStart: { x: -0.8, y: 1.15, z: 3.5, yaw: 0.08, pitch: 0.02, shake: 0.06 },
      cameraEnd: { x: 0.15, y: 1.25, z: 12.0, yaw: -0.04, pitch: -0.02, shake: 0.04 },
      cameraOrbit: {
        centerX: 0,
        centerZ: 13.5,
        radius: 8.5,
        startAngle: -0.58,
        endAngle: 0.45,
        startY: 1.65,
        endY: 1.25,
        lookAtY: 0.9,
      },
      fadeInMs: 340,
      fadeOutMs: 380,
      onEnter: () => {
        setActiveAct(3);
        soundManager.playStormWaveStart();
      },
      entities: [
        ...buildForestAndFence(4, 28, 3.0),
        {
          id: 'matthew_hit',
          kind: 'sprite',
          x: -1.4,
          vx: -0.45,
          y: 0,
          z: 10.5,
          scale: 1.25,
          frames: ['./images/skins/classic_matthew.png'],
          rotation: -0.22,
          vr: -0.06,
        },
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `steal_coin_${i}`,
          kind: 'coin' as const,
          x: (i - 4.5) * 0.45,
          y: 0.9 + (i % 3) * 0.35,
          z: 12 + i * 0.4,
          vx: (i % 2 === 0 ? 1 : -1) * 0.6,
          vy: 0.35,
          vz: 2.8,
          scale: 1.2,
        })),
        { id: 'zl1', kind: 'sprite', x: 0.6, y: 0, z: 13.8, vx: -0.5, vz: -1.1, scale: 1.32, frames: ZOMBIE_MALE_ATTACK, fps: 12, flip: true },
        { id: 'zl2', kind: 'sprite', x: 1.9, y: 0, z: 15.2, vz: -1.4, scale: 1.18, frames: ZOMBIE_FEMALE_WALK, fps: 11, flip: true },
        {
          id: 'pup_stand',
          kind: 'sprite',
          x: 0.15,
          y: 0,
          z: 14.5,
          vz: 0.4,
          scale: 0.95,
          frames: FROST_PUP_RUN,
          fps: 9,
          glowColor: 'rgba(34,211,238,0.9)',
        },
      ],
    };

    const act4: SceneSegment3D = {
      durationMs: 4500,
      skyTop: '#021526',
      skyBottom: '#0ea5e9',
      groundNear: '#0c4a6e',
      groundFar: '#082f49',
      horizonGlow: 'rgba(103,232,249,0.65)',
      auroraColor: 'rgba(34,211,238,0.52)',
      backdropStyle: 'vortex',
      spotlights: true,
      speedLines: true,
      snowCount: 95,
      snowVz: -15.0,
      radialBurstAtMs: 550,
      radialBurstColor: '#38bdf8',
      cameraStart: { x: 0, y: 1.05, z: 2.0, yaw: 0, pitch: 0.03, shake: 0.02 },
      cameraEnd: { x: 0, y: 1.55, z: 17.5, yaw: 0, pitch: -0.01, shake: 0.09 },
      fadeInMs: 340,
      fadeOutMs: 420,
      onEnter: () => {
        setActiveAct(4);
        soundManager.playTokenUnlock();
      },
      entities: [
        ...buildForestAndFence(2, 34, 2.5),
        { id: 'crA', kind: 'crystal', x: -3.1, y: 0, z: 9, scale: 1.5, tintColor: '#38bdf8' },
        { id: 'crB', kind: 'crystal', x: 3.1, y: 0, z: 13, scale: 1.7, tintColor: '#a5f3fc' },
        { id: 'crC', kind: 'crystal', x: -3.2, y: 0, z: 18, scale: 1.6, tintColor: '#22d3ee' },
        { id: 'pk_pup', kind: 'sprite', x: -0.35, y: 0, z: 6.0, vz: 3.6, scale: 1.05, frames: FROST_PUP_RUN, fps: 12, glowColor: '#22d3ee' },
        { id: 'pk_fox', kind: 'sprite', x: 1.35, y: 0, z: 6.4, vz: 3.7, scale: 1.0, frames: FOX_RUN, fps: 12, glowColor: '#38bdf8' },
        { id: 'pk_wyvern', kind: 'sprite', x: -1.8, y: 1.9, z: 6.8, vz: 3.8, scale: 1.15, frames: WYVERN_FLY, fps: 10, bobSpeed: 5, bobAmp: 0.25, glowColor: '#67e8f9' },
        { id: 'pk_phoenix', kind: 'sprite', x: 1.8, y: 2.1, z: 7.2, vz: 3.9, scale: 1.05, frames: PHOENIX_FLY, fps: 10, bobSpeed: 6, bobAmp: 0.22, glowColor: '#f43f5e' },
        { id: 'ko1', kind: 'sprite', x: -0.9, vx: -1.9, y: 0.4, vy: 0.7, z: 11, vz: -2.5, rotation: 0, vr: -2.4, scale: 1.25, frames: ['./images/s2/zombies/male_dead.png'] },
        { id: 'ko2', kind: 'sprite', x: 1.0, vx: 2.1, y: 0.3, vy: 0.6, z: 14, vz: -2.8, rotation: 0, vr: 2.6, scale: 1.25, frames: ['./images/s2/zombies/female_dead.png'] },
        { id: 'ko3', kind: 'sprite', x: -0.4, vx: -2.4, y: 0.5, vy: 0.9, z: 19, vz: -3.2, rotation: 0, vr: -3.0, scale: 1.35, frames: ['./images/s2/zombies/male_dead.png'] },
      ],
    };

    const act5: SceneSegment3D = {
      durationMs: 6400,
      skyTop: '#020617',
      skyBottom: '#0f3f5c',
      groundNear: '#0f2942',
      groundFar: '#020617',
      horizonGlow: 'rgba(103,232,249,0.62)',
      auroraColor: 'rgba(52,211,153,0.48)',
      backdropStyle: 'starfield',
      spotlights: true,
      snowCount: 90,
      snowVz: -2.4,
      cameraStart: { x: 0, y: 1.25, z: 11.5, yaw: 0, pitch: -0.02 },
      cameraEnd: { x: 0, y: 2.38, z: 3.8, yaw: 0, pitch: -0.055 },
      cameraOrbit: {
        centerX: 0,
        centerZ: 16,
        radius: 10.8,
        startAngle: -0.65,
        endAngle: 0.0,
        startY: 1.45,
        endY: 2.38,
        lookAtY: 1.25,
      },
      fadeInMs: 400,
      fadeOutMs: 0,
      onEnter: () => {
        setActiveAct(5);
        soundManager.playSkinUnlock();
        setFinaleTitleVisible(true);
      },
      entities: [
        ...buildForestAndFence(5, 31, 3.0),
        { id: 'cr_hero1', kind: 'crystal', x: -2.45, y: 0, z: 17, scale: 1.55, tintColor: '#22d3ee' },
        { id: 'cr_hero2', kind: 'crystal', x: 2.45, y: 0, z: 17, scale: 1.55, tintColor: '#67e8f9' },
        {
          id: 'matthew_hero',
          kind: 'sprite',
          x: 0,
          y: 0,
          z: 16,
          scale: 1.44,
          frames: ['./images/skins/classic_matthew.png'],
          bobSpeed: 2.0,
          bobAmp: 0.05,
          glowColor: 'rgba(103,232,249,0.78)',
        },
        {
          id: 'pup_hero',
          kind: 'sprite',
          x: -1.45,
          y: 0,
          z: 15.2,
          scale: 0.9,
          frames: FROST_PUP_RUN,
          fps: 6,
          glowColor: 'rgba(34,211,238,0.88)',
        },
        {
          id: 'wyv_hero',
          kind: 'sprite',
          x: 1.9,
          y: 1.8,
          z: 16.4,
          scale: 1.06,
          frames: WYVERN_FLY,
          fps: 7,
          bobSpeed: 4,
          bobAmp: 0.16,
          glowColor: 'rgba(56,189,248,0.85)',
        },
      ],
    };

    return [act1, act2, act3, act4, act5];
  }, []);

  const handleContinue = () => {
    if (exiting) return;
    setExiting(true);
    soundManager.playSkinUnlock();
    soundManager.unlockAndEnsureAudio('s2_winter');
    soundManager.setMusicTrack('s2_winter', true);
    setTimeout(() => {
      onComplete();
    }, 520);
  };

  return (
    <div
      className={`fixed inset-0 z-[135] w-screen h-screen bg-[#020617] overflow-hidden select-none transition-opacity duration-500 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <Scene3DCutsceneCanvas
        scenes={cutsceneScenes}
        holdAtEnd
        onReachedEnd={() => {
          setFinaleTitleVisible(true);
          setFinaleReady(true);
          soundManager.setMusicTrack('s2_winter', true);
        }}
        onComplete={() => {}}
        zIndexClass="z-[135]"
      />

      {/* CINEMATIC WIDESCREEN LETTERBOX + STORY CAPTIONS (ACTS 1–4) */}
      <div className="fixed inset-x-0 top-0 h-10 sm:h-14 bg-black/90 z-[136] pointer-events-none flex items-center justify-between px-4 sm:px-6 border-b border-cyan-500/20">
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.28em] text-cyan-300/90">
          {ACT_CAPTIONS[activeAct]?.chapter || 'SEASON 2 PREMIERE'}
        </span>
      </div>
      <div className="fixed inset-x-0 bottom-0 h-14 sm:h-20 bg-black/90 z-[136] pointer-events-none flex items-center justify-center px-5 border-t border-cyan-500/20">
        {!finaleTitleVisible && ACT_CAPTIONS[activeAct] && (
          <p className="text-xs sm:text-base font-bold text-cyan-50 text-center max-w-2xl drop-shadow animate-fade-in">
            {ACT_CAPTIONS[activeAct].line}
          </p>
        )}
      </div>

      {!finaleReady && (
        <button
          onClick={() => {
            setFinaleTitleVisible(true);
            setFinaleReady(true);
            soundManager.setMusicTrack('s2_winter', true);
          }}
          className="fixed top-2 sm:top-3 right-4 z-[138] px-3.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-600 text-[10px] sm:text-xs font-black uppercase text-slate-200 cursor-pointer"
        >
          Skip Intro →
        </button>
      )}

      {finaleTitleVisible && (
        <div className="fixed inset-0 z-[136] pointer-events-none overflow-hidden">
          {FINALE_FLAKES.map((f) => (
            <span
              key={f.id}
              className="absolute rounded-full bg-cyan-100 animate-pulse"
              style={{
                left: `${f.left}%`,
                top: `${(f.id * 19) % 95}%`,
                width: `${f.size}px`,
                height: `${f.size}px`,
                opacity: f.opacity,
                animationDuration: `${f.duration}s`,
                animationDelay: `${f.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      {finaleTitleVisible && (
        <div
          className={`fixed inset-0 z-[137] flex flex-col items-center justify-center px-6 text-center bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/50 transition-all duration-700 ${
            exiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
          }`}
        >
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.44em] text-cyan-200/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] mb-2">
            Matthew Clicker Presents
          </p>
          <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-[0.22em] text-white drop-shadow-[0_6px_32px_rgba(34,211,238,0.75)]">
            SEASON 2
          </h2>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-[0.14em] bg-gradient-to-b from-white via-cyan-100 to-sky-400 bg-clip-text text-transparent drop-shadow-[0_10px_38px_rgba(14,165,233,0.85)] mt-1">
            FROZEN APOCALYPSE
          </h1>

          {finaleReady && (
            <button
              onClick={handleContinue}
              className="mt-8 inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-black text-base sm:text-lg tracking-wider uppercase text-slate-950 bg-gradient-to-r from-cyan-300 via-sky-200 to-cyan-400 shadow-[0_0_45px_rgba(34,211,238,0.8)] hover:scale-105 active:scale-95 transition-all cursor-pointer animate-fade-in"
            >
              Continue to Season 2
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
