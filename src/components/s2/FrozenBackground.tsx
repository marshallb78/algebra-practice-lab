import React, { useMemo } from 'react';
import { SkinBackgroundTheme } from '../../types/game';

interface FrozenBackgroundProps {
  theme: SkinBackgroundTheme;
  isFrozenApocalypse: boolean;
  isRaidActive?: boolean;
  isStormActive?: boolean;
  stormWaveActive?: boolean;
  combo?: number;
  unlockedSkinImages?: string[];
  reducedMotion?: boolean;
}

const THEME_GRADIENTS: Record<SkinBackgroundTheme, string> = {
  default: '',
  gold: 'radial-gradient(circle at 50% 35%, rgba(250,204,21,0.28), rgba(180,83,9,0.20), rgba(15,23,42,0.72))',
  snowy: 'radial-gradient(circle at 50% 25%, rgba(186,230,253,0.32), rgba(14,116,144,0.22), rgba(2,6,23,0.68))',
  ice: 'radial-gradient(circle at 50% 30%, rgba(103,232,249,0.34), rgba(3,105,161,0.26), rgba(8,47,73,0.72))',
  lava: 'radial-gradient(circle at 50% 45%, rgba(249,115,22,0.34), rgba(185,28,28,0.26), rgba(15,10,12,0.75))',
  royal: 'radial-gradient(circle at 50% 35%, rgba(192,132,252,0.28), rgba(245,158,11,0.2), rgba(17,24,39,0.74))',
  minecraft: 'radial-gradient(circle at 50% 35%, rgba(74,222,128,0.25), rgba(21,128,61,0.2), rgba(10,20,16,0.74))',
  festive: 'radial-gradient(circle at 50% 30%, rgba(239,68,68,0.26), rgba(21,128,61,0.24), rgba(15,23,42,0.74))',
  pizza: 'radial-gradient(circle at 50% 40%, rgba(251,146,60,0.3), rgba(220,38,38,0.22), rgba(24,14,10,0.75))',
  burger: 'radial-gradient(circle at 50% 40%, rgba(245,158,11,0.28), rgba(180,83,9,0.22), rgba(20,14,10,0.75))',
  fries: 'radial-gradient(circle at 50% 40%, rgba(250,204,21,0.28), rgba(202,138,4,0.22), rgba(20,16,8,0.75))',
  strawberry: 'radial-gradient(circle at 50% 40%, rgba(251,113,133,0.3), rgba(190,18,60,0.22), rgba(20,10,18,0.75))',
  chocolate: 'radial-gradient(circle at 50% 40%, rgba(161,98,7,0.3), rgba(120,53,15,0.26), rgba(18,12,10,0.75))',
  zombie: 'radial-gradient(circle at 50% 40%, rgba(132,204,22,0.3), rgba(21,128,61,0.24), rgba(10,18,12,0.75))',
  ghost: 'radial-gradient(circle at 50% 35%, rgba(226,232,240,0.24), rgba(100,116,139,0.2), rgba(9,13,22,0.75))',
  neon: 'radial-gradient(circle at 50% 35%, rgba(34,211,238,0.3), rgba(217,70,239,0.22), rgba(10,10,24,0.75))',
  space: 'radial-gradient(circle at 50% 35%, rgba(129,140,248,0.3), rgba(109,40,217,0.24), rgba(5,7,20,0.78))',
  ocean: 'radial-gradient(circle at 50% 35%, rgba(56,189,248,0.3), rgba(30,58,138,0.28), rgba(5,15,32,0.75))',
  infernal: 'radial-gradient(circle at 50% 45%, rgba(239,68,68,0.32), rgba(124,45,18,0.26), rgba(15,8,8,0.76))',
};

const SNOWFLAKES = Array.from({ length: 42 }, (_, i) => ({
  id: i,
  left: `${(i * 37) % 100}%`,
  size: i % 6 === 0 ? 7 : 3 + (i % 4) * 1.5,
  opacity: i % 6 === 0 ? 0.55 : 0.4 + (i % 4) * 0.16,
  blur: i % 6 === 0 ? 2 : 0,
  delay: `${(i % 9) * 0.6}s`,
  duration: `${3.4 + (i % 6) * 0.95}s`,
}));

const STARS = Array.from({ length: 34 }, (_, i) => ({
  id: i,
  left: `${(i * 53 + 7) % 98}%`,
  top: `${(i * 29 + 4) % 48}%`,
  size: i % 5 === 0 ? 4 : i % 2 === 0 ? 3 : 2,
  delay: `${(i % 6) * 0.5}s`,
  color:
    i % 4 === 0
      ? '#67e8f9'
      : i % 4 === 1
      ? '#bae6fd'
      : i % 4 === 2
      ? '#fde68a'
      : '#c4b5fd',
}));

const ICE_SPIRES = [
  { left: '4%', width: 42, height: 118, tilt: '-8deg', glow: 'rgba(56,189,248,0.5)' },
  { left: '13%', width: 28, height: 86, tilt: '6deg', glow: 'rgba(34,211,238,0.42)' },
  { left: '24%', width: 34, height: 96, tilt: '-4deg', glow: 'rgba(103,232,249,0.45)' },
  { left: '74%', width: 32, height: 92, tilt: '5deg', glow: 'rgba(34,211,238,0.45)' },
  { left: '84%', width: 44, height: 124, tilt: '-6deg', glow: 'rgba(56,189,248,0.52)' },
  { left: '93%', width: 30, height: 84, tilt: '9deg', glow: 'rgba(129,140,248,0.46)' },
];

export const FrozenBackground: React.FC<FrozenBackgroundProps> = ({
  theme,
  isFrozenApocalypse,
  isRaidActive = false,
  isStormActive = false,
  stormWaveActive = false,
  combo = 0,
  unlockedSkinImages = [],
  reducedMotion = false,
}) => {
  const customGradient = theme !== 'default' ? THEME_GRADIENTS[theme] : '';
  const comboRatio = Math.min(1, combo / 30);

  const rainDrops = useMemo(() => {
    const imgs = unlockedSkinImages.length > 0 ? unlockedSkinImages : [];
    if (imgs.length === 0) return [];
    return Array.from({ length: 8 }, (_, idx) => ({
      id: idx,
      leftPct: (idx * 12 + 5) % 92,
      delaySec: (idx * 0.55) % 4.0,
      durationSec: 3.4 + (idx % 3) * 0.7,
      sizePx: 42 + (idx % 2) * 10,
      skinImg: imgs[idx % imgs.length],
    }));
  }, [unlockedSkinImages]);

  if (!customGradient && !isFrozenApocalypse) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      <style>{`
        @keyframes s2SnowfallWind {
          0% { transform: translate3d(-16px, -8vh, 0); opacity: 0; }
          14% { opacity: 0.9; }
          86% { opacity: 0.75; }
          100% { transform: translate3d(42px, 108vh, 0); opacity: 0; }
        }
        @keyframes s2AuroraFlow {
          0%, 100% { transform: translateX(-6%) skewX(-8deg) scaleY(1); opacity: 0.58; }
          50% { transform: translateX(6%) skewX(6deg) scaleY(1.18); opacity: 0.9; }
        }
        @keyframes s2StarTwinkle {
          0%, 100% { opacity: 0.28; transform: scale(0.85); }
          50% { opacity: 0.95; transform: scale(1.3); }
        }
        @keyframes s2GridScroll {
          0% { transform: perspective(360px) rotateX(64deg) translateY(0px); }
          100% { transform: perspective(360px) rotateX(64deg) translateY(52px); }
        }
        @keyframes s2FogDrift {
          0%, 100% { transform: translateX(-4%); opacity: 0.35; }
          50% { transform: translateX(4%); opacity: 0.62; }
        }
        @keyframes s2GoldPulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.72; transform: scale(1.08); }
        }
        @keyframes s2StormRain {
          0% { transform: translate3d(0, -90px, 0) rotate(0deg); opacity: 0; }
          12% { opacity: 0.88; }
          88% { opacity: 0.88; }
          100% { transform: translate3d(0, 105vh, 0) rotate(360deg); opacity: 0; }
        }
      `}</style>

      {/* Deep Polar Night Sky + Combo-Reactive Energy */}
      {isFrozenApocalypse && (
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            background: isRaidActive
              ? 'radial-gradient(circle at 50% 42%, rgba(225,29,72,0.28), rgba(15,23,42,0.5) 45%, #020617 100%), linear-gradient(to bottom, #1a0715 0%, #0d1328 52%, #030712 100%)'
              : comboRatio > 0.45
              ? 'radial-gradient(circle at 50% 44%, rgba(34,211,238,0.26), rgba(251,191,36,0.14) 38%, transparent 70%), linear-gradient(to bottom, #071936 0%, #091d3a 48%, #030a1a 100%)'
              : 'radial-gradient(circle at 50% 34%, rgba(14,116,144,0.34), rgba(56,189,248,0.12) 42%, transparent 72%), linear-gradient(to bottom, #041229 0%, #071b38 50%, #020817 100%)',
          }}
        />
      )}

      {/* Skin-Matched Atmospheric Color Layer */}
      {customGradient && (
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{ background: customGradient }}
        />
      )}

      {/* Gold Aura Shimmer */}
      {theme === 'gold' && !reducedMotion && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 42%, rgba(253,224,71,0.26) 0%, transparent 62%)',
            animation: 's2GoldPulse 3.2s ease-in-out infinite',
          }}
        />
      )}

      {/* Arctic Starfield & Moon Halo */}
      {isFrozenApocalypse && (
        <>
          {STARS.map((s) => (
            <div
              key={s.id}
              className="absolute rounded-full"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                backgroundColor: s.color,
                boxShadow: `0 0 8px ${s.color}`,
                animation: reducedMotion
                  ? undefined
                  : `s2StarTwinkle ${2.6 + (s.id % 3) * 0.7}s ease-in-out ${s.delay} infinite`,
              }}
            />
          ))}

          {/* Atmospheric Arctic Moon with Outer Diffraction Rings */}
          <div
            className="hidden sm:block absolute top-8 right-[16%] w-24 h-24 rounded-full pointer-events-none"
            style={{
              background: isRaidActive
                ? 'radial-gradient(circle at 36% 36%, #ffe4e6 0%, #fb7185 52%, rgba(136,19,55,0) 76%)'
                : 'radial-gradient(circle at 36% 36%, #f8fafc 0%, #bae6fd 50%, rgba(56,189,248,0) 76%)',
              boxShadow: isRaidActive
                ? '0 0 95px 32px rgba(244,63,94,0.34)'
                : '0 0 95px 30px rgba(125,211,252,0.26)',
            }}
          />

          {/* Shimmering Northern Lights Ribbons */}
          <div
            className="absolute -top-20 inset-x-[-14%] h-72 blur-3xl will-change-transform"
            style={{
              background: isRaidActive
                ? 'linear-gradient(100deg, rgba(239,68,68,0.45), rgba(185,28,28,0.34), rgba(249,115,22,0.40))'
                : isStormActive
                ? 'linear-gradient(100deg, rgba(217,70,239,0.42), rgba(56,189,248,0.36), rgba(168,85,247,0.42))'
                : 'linear-gradient(100deg, rgba(34,211,238,0.30), rgba(16,185,129,0.30), rgba(59,130,246,0.28))',
              animation: reducedMotion ? undefined : 's2AuroraFlow 10s ease-in-out infinite',
            }}
          />
          <div
            className="absolute top-8 inset-x-[-10%] h-44 blur-3xl opacity-70 will-change-transform"
            style={{
              background: isRaidActive
                ? 'linear-gradient(80deg, transparent, rgba(244,63,94,0.42), transparent)'
                : 'linear-gradient(80deg, transparent, rgba(52,211,153,0.28), rgba(103,232,249,0.28), transparent)',
              animation: reducedMotion ? undefined : 's2AuroraFlow 14s ease-in-out reverse infinite',
            }}
          />

          {/* Two-Layer Parallax Jagged Glacier Mountains + Glowing Ice Spires */}
          <svg
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            className="absolute inset-x-0 bottom-[26%] w-full h-[36%] opacity-85"
          >
            <defs>
              <linearGradient id="farPeakGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isRaidActive ? '#4c1d3d' : '#164e63'} stopOpacity="0.88" />
                <stop offset="100%" stopColor="#081529" stopOpacity="0.96" />
              </linearGradient>
              <linearGradient id="nearPeakGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isRaidActive ? '#3b0a22' : '#0e3456'} stopOpacity="0.95" />
                <stop offset="100%" stopColor="#040c1a" stopOpacity="1" />
              </linearGradient>
            </defs>
            {/* Far Glacial Range */}
            <path
              d="M0,260 L90,150 L185,215 L295,105 L415,195 L535,88 L660,185 L770,115 L895,205 L1020,76 L1145,180 L1275,98 L1385,175 L1440,145 L1440,320 L0,320 Z"
              fill="url(#farPeakGrad)"
            />
            {/* Near Shadowed Alpine Silhouettes */}
            <path
              d="M0,300 L70,210 L155,250 L250,155 L345,235 L465,148 L580,255 L695,168 L820,248 L940,138 L1075,245 L1190,152 L1315,240 L1440,185 L1440,320 L0,320 Z"
              fill="url(#nearPeakGrad)"
            />
          </svg>

          {/* Translucent Glowing Ice Spires Rising Along the Horizon */}
          <div className="absolute inset-x-0 bottom-[26%] h-40 overflow-hidden opacity-75">
            {ICE_SPIRES.map((spire, idx) => (
              <div
                key={idx}
                className="absolute bottom-0"
                style={{
                  left: spire.left,
                  width: spire.width,
                  height: spire.height,
                  transform: `rotate(${spire.tilt})`,
                  clipPath: 'polygon(50% 0%, 100% 62%, 78% 100%, 22% 100%, 0% 62%)',
                  background: isRaidActive
                    ? 'linear-gradient(to bottom, rgba(253,164,175,0.65), rgba(190,18,60,0.22))'
                    : 'linear-gradient(to bottom, rgba(165,243,252,0.65), rgba(14,116,144,0.22))',
                  boxShadow: `0 0 22px ${spire.glow}`,
                }}
              />
            ))}
          </div>

          {/* 3D Perspective Scrolling Icy Horizon Grid Floor */}
          <div
            className="absolute inset-x-0 bottom-0 h-[38%] opacity-40"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 42%, black 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 42%, black 100%)',
            }}
          >
            <div
              className="w-full h-[145%] origin-bottom will-change-transform"
              style={{
                backgroundImage: isRaidActive
                  ? 'linear-gradient(to right, rgba(251,113,133,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(251,146,60,0.22) 1px, transparent 1px)'
                  : isStormActive
                  ? 'linear-gradient(to right, rgba(232,121,249,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.24) 1px, transparent 1px)'
                  : 'linear-gradient(to right, rgba(103,232,249,0.26) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.22) 1px, transparent 1px)',
                backgroundSize: '52px 52px',
                animation: reducedMotion ? undefined : 's2GridScroll 2.6s linear infinite',
              }}
            />
          </div>

          {/* Drifting Valley Blizzard Mist */}
          <div
            className="absolute inset-x-[-10%] bottom-[16%] h-36 blur-2xl"
            style={{
              background: isRaidActive
                ? 'radial-gradient(ellipse at 50% 60%, rgba(244,63,94,0.18), transparent 70%)'
                : 'radial-gradient(ellipse at 50% 60%, rgba(186,230,253,0.22), rgba(56,189,248,0.10) 50%, transparent 72%)',
              animation: reducedMotion ? undefined : 's2FogDrift 9s ease-in-out infinite',
            }}
          />
        </>
      )}

      {/* Matthew Storm Synergy: Spinning Chaos Vortex Ring + Raining Unlocked Matthews */}
      {isStormActive && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full border-2 border-dashed border-fuchsia-400/35 animate-spin will-change-transform"
            style={{ animationDuration: stormWaveActive ? '8s' : '16s' }}
          />
          {!reducedMotion &&
            rainDrops.map((drop) => (
              <img
                key={drop.id}
                src={drop.skinImg}
                alt=""
                decoding="async"
                className="absolute top-0 rounded-full object-cover border-2 border-fuchsia-400/70 pointer-events-none select-none will-change-transform"
                style={{
                  left: `${drop.leftPct}%`,
                  width: `${drop.sizePx}px`,
                  height: `${drop.sizePx}px`,
                  animation: `s2StormRain ${drop.durationSec}s linear ${drop.delaySec}s infinite`,
                }}
              />
            ))}
        </div>
      )}

      {/* Animated Falling Snow Crystals, Foreground Bokeh & Embers */}
      {(isFrozenApocalypse || theme === 'snowy' || theme === 'ice' || theme === 'lava') &&
        !reducedMotion &&
        SNOWFLAKES.map((f) => (
          <div
            key={f.id}
            className="absolute rounded-full will-change-transform"
            style={{
              left: f.left,
              top: '-6vh',
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              filter: f.blur ? `blur(${f.blur}px)` : undefined,
              background:
                theme === 'lava' || theme === 'infernal'
                  ? 'rgba(251,146,60,0.85)'
                  : theme === 'gold'
                  ? 'rgba(253,224,71,0.85)'
                  : 'rgba(224,242,254,0.92)',
              animation: `s2SnowfallWind ${f.duration} linear ${f.delay} infinite`,
            }}
          />
        ))}

      {/* Red Alert Vignette Border during Active Zombie Raids */}
      {isRaidActive && (
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_115px_rgba(225,29,72,0.52)]" />
      )}
    </div>
  );
};

