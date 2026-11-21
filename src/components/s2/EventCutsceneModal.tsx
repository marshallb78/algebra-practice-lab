import React, { useMemo, useState } from 'react';
import { Scene3DCutsceneCanvas, SceneSegment3D, WorldEntity3D } from './Scene3DCutsceneCanvas';
import { GlobalEventType } from '../../firebase/liveEvents';
import { soundManager } from '../../audio/soundManager';

export type LiveEventCutsceneKind = GlobalEventType | 'storm';

interface EventCutsceneModalProps {
  eventType: LiveEventCutsceneKind;
  summonedBy?: string;
  onComplete: () => void;
}

const EVENT_TITLES: Record<LiveEventCutsceneKind, { title: string; accent: string }> = {
  golden_rain: { title: 'STARK GOLD RAIN', accent: '#fbbf24' },
  screen_freeze: { title: 'DR. STRANGE DARK ICE', accent: '#c084fc' },
  upside_down_chaos: { title: 'MIRROR DIMENSION FLIP 180°', accent: '#c084fc' },
  blackout_flashlight: { title: 'SYMBIOTE BLACKOUT', accent: '#94a3b8' },
  storm: { title: 'MULTIVERSE STORM LIVE', accent: '#e879f9' },
};

/**
 * Dramatic Widescreen 3D Cinematic Intro for Live Server Events & Matthew Storm:
 * Plays ~4 seconds of high-energy 3D camera action matching the event theme, reveals the borderless event title, then starts!
 */
export const EventCutsceneModal: React.FC<EventCutsceneModalProps> = ({
  eventType,
  summonedBy,
  onComplete,
}) => {
  const [showTitle, setShowTitle] = useState(false);

  const scenes = useMemo<SceneSegment3D[]>(() => {
    const lane: WorldEntity3D[] = [];
    for (let z = 2; z <= 34; z += 3.2) {
      if (eventType === 'screen_freeze') {
        lane.push({ id: `evcL_${z}`, kind: 'crystal', x: -3.1, y: 0, z, scale: 1.65, tintColor: '#a855f7' });
        lane.push({ id: `evcR_${z}`, kind: 'crystal', x: 3.1, y: 0, z, scale: 1.65, tintColor: '#34d399' });
      } else {
        lane.push({ id: `evpiL_${z}`, kind: 'pillar', x: -3.6, y: 0, z, scale: 1.15 });
        lane.push({ id: `evpiR_${z}`, kind: 'pillar', x: 3.6, y: 0, z, scale: 1.15 });
      }
    }

    const paletteMap: Record<
      LiveEventCutsceneKind,
      { skyTop: string; skyBottom: string; glow: string; aurora: string; burst: string }
    > = {
      golden_rain: {
        skyTop: '#0c0802',
        skyBottom: '#b45309',
        glow: 'rgba(253,224,71,0.65)',
        aurora: 'rgba(251,191,36,0.48)',
        burst: '#fbbf24',
      },
      screen_freeze: {
        skyTop: '#080316',
        skyBottom: '#3b0764',
        glow: 'rgba(168,85,247,0.68)',
        aurora: 'rgba(52,211,153,0.42)',
        burst: '#c084fc',
      },
      upside_down_chaos: {
        skyTop: '#0f0520',
        skyBottom: '#581c87',
        glow: 'rgba(192,132,252,0.65)',
        aurora: 'rgba(168,85,247,0.45)',
        burst: '#c084fc',
      },
      blackout_flashlight: {
        skyTop: '#02040a',
        skyBottom: '#1e293b',
        glow: 'rgba(148,163,184,0.5)',
        aurora: 'rgba(100,116,139,0.35)',
        burst: '#cbd5e1',
      },
      storm: {
        skyTop: '#090318',
        skyBottom: '#6b21a8',
        glow: 'rgba(217,70,239,0.62)',
        aurora: 'rgba(192,132,252,0.5)',
        burst: '#e879f9',
      },
    };
    const pal = paletteMap[eventType];

    const centerEnts: WorldEntity3D[] =
      eventType === 'golden_rain'
        ? Array.from({ length: 10 }, (_, i) => ({
            id: `ev_drop_${i}`,
            kind: 'sprite' as const,
            x: (i - 4.5) * 0.72,
            y: 2.2 + (i % 4) * 0.85,
            vy: -1.45,
            z: 13 + (i % 3) * 1.4,
            scale: 1.05,
            frames: ['./images/skins/golden_matthew.png'],
            bobSpeed: 4,
            bobAmp: 0.1,
            glowColor: pal.glow,
          }))
        : eventType === 'storm'
        ? [
            {
              id: 'ev_token_storm',
              kind: 'sprite',
              x: 0,
              y: 0.2,
              z: 16,
              scale: 1.55,
              frames: ['./images/skins/aura_matthew.png'],
              bobSpeed: 5,
              bobAmp: 0.12,
              glowColor: pal.glow,
            },
            ...Array.from({ length: 8 }, (_, i) => ({
              id: `ev_orb_${i}`,
              kind: 'coin' as const,
              x: Math.cos((i / 8) * Math.PI * 2) * 2.5,
              y: 0.7 + (i % 2) * 0.5,
              z: 15.5 + Math.sin((i / 8) * Math.PI * 2) * 1.3,
              vz: -1.6,
              scale: 1.25,
            })),
          ]
        : [
            {
              id: 'ev_ice_core',
              kind: 'crystal',
              x: 0,
              y: 0,
              z: 14,
              scale: 2.1,
              tintColor: '#e0f2fe',
            },
          ];

    const isRain = eventType === 'golden_rain';
    const isOrbit = eventType === 'storm';
    const isFreeze = eventType === 'screen_freeze';
    const backdrop = isOrbit
      ? 'vortex'
      : isRain
      ? 'starfield'
      : isFreeze
      ? 'blizzard'
      : 'inferno';

    const seg1: SceneSegment3D = {
      durationMs: 2100,
      skyTop: pal.skyTop,
      skyBottom: pal.skyBottom,
      groundNear: '#09111e',
      groundFar: '#020617',
      horizonGlow: pal.glow,
      auroraColor: pal.aurora,
      backdropStyle: backdrop,
      speedLines: isOrbit,
      lightningFlash: eventType === 'storm',
      snowCount: 85,
      snowVz: isRain ? -4.0 : -11.0,
      cameraStart: isRain
        ? { x: 0, y: 0.9, z: 7.5, pitch: 0.44 }
        : isFreeze
        ? { x: 0, y: 1.35, z: 11.2, pitch: -0.02 }
        : { x: -3.2, y: 1.2, z: 9.0, yaw: -0.25, pitch: 0.02 },
      cameraEnd: isRain
        ? { x: 0, y: 1.35, z: 9.2, pitch: 0.04, shake: 0.08 }
        : isFreeze
        ? { x: 0, y: 1.9, z: 5.5, pitch: -0.06, shake: 0.09 }
        : { x: 0, y: 1.25, z: 10.2, yaw: 0.08, pitch: -0.02, shake: 0.08 },
      cameraOrbit: isOrbit
        ? {
            centerX: 0,
            centerZ: 15.5,
            radius: 5.2,
            startAngle: -0.58,
            endAngle: 0.42,
            startY: 2.1,
            endY: 1.3,
            lookAtY: 0.8,
          }
        : undefined,
      fadeInMs: 220,
      fadeOutMs: 140,
      onEnter: () => {
        soundManager.setMusicTrack('s2_event');
        soundManager.playCutsceneBoom();
        setTimeout(() => setShowTitle(true), 800);
      },
      entities: [...lane, ...centerEnts],
    };

    const seg2: SceneSegment3D = {
      durationMs: 2150,
      skyTop: pal.skyTop,
      skyBottom: pal.skyBottom,
      groundNear: '#09111e',
      groundFar: '#020617',
      horizonGlow: pal.glow,
      auroraColor: pal.aurora,
      backdropStyle: backdrop,
      spotlights: isOrbit || isRain,
      radialBurstAtMs: 80,
      radialBurstColor: pal.burst,
      snowCount: 85,
      snowVz: -7.5,
      cameraStart: seg1.cameraEnd,
      cameraEnd: isRain
        ? { x: 0, y: 1.45, z: 8.8, pitch: 0.14, shake: 0.02 }
        : isFreeze
        ? { x: 0, y: 1.4, z: 8.6, pitch: -0.02, shake: 0.02 }
        : { x: 1.4, y: 1.45, z: 9.4, yaw: -0.14, shake: 0.01 },
      cameraOrbit: isOrbit
        ? {
            centerX: 0,
            centerZ: 15.5,
            radius: 4.5,
            startAngle: 0.4,
            endAngle: 1.25,
            startY: 1.3,
            endY: 1.5,
            lookAtY: 0.85,
          }
        : undefined,
      fadeInMs: 140,
      fadeOutMs: 400,
      onEnter: () => soundManager.playStormWaveStart(),
      entities: [...lane, ...centerEnts],
    };

    return [seg1, seg2];
  }, [eventType]);

  const meta = EVENT_TITLES[eventType];

  return (
    <div className="fixed inset-0 z-[136] select-none">
      <Scene3DCutsceneCanvas scenes={scenes} onComplete={onComplete} zIndexClass="z-[136]" />

      {showTitle && (
        <div className="fixed inset-0 z-[137] flex flex-col items-center justify-end pb-14 sm:pb-20 px-4 pointer-events-none">
          <div className="flex flex-col items-center text-center animate-fade-in">
            {summonedBy && (
              <div className="text-xs font-black uppercase tracking-[0.3em] text-white/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
                Summoned By {summonedBy}
              </div>
            )}
            <h2
              className="mt-1 text-3xl sm:text-5xl font-black uppercase tracking-tight drop-shadow-[0_6px_26px_rgba(0,0,0,0.95)]"
              style={{ color: meta.accent }}
            >
              {meta.title}
            </h2>
          </div>
        </div>
      )}
    </div>
  );
};

