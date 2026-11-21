import React from 'react';
import { SkinBackgroundTheme } from '../../types/game';

interface MarvelBackgroundProps {
  theme: SkinBackgroundTheme;
  isStormActive: boolean;
  stormWaveActive: boolean;
  combo: number;
  unlockedSkinImages: string[];
  reducedMotion?: boolean;
}

/**
 * Season 3: Lightweight GPU-Composited Marvel Multiverse Scene
 * Slightly darkened and blurred so the Matthew character, HUD, and projectiles
 * stand out cleanly with zero lag on Chromebooks.
 */
export const MarvelBackground: React.FC<MarvelBackgroundProps> = ({
  theme,
  isStormActive,
  stormWaveActive,
}) => {
  const overlayGradient = isStormActive
    ? 'radial-gradient(circle at 50% 42%, rgba(250,204,21,0.18), rgba(88,28,135,0.52) 55%, rgba(3,2,10,0.86) 100%)'
    : theme === 'lava' || theme === 'infernal'
    ? 'radial-gradient(circle at 50% 42%, rgba(239,68,68,0.16), rgba(15,5,28,0.68) 58%, rgba(3,2,9,0.88) 100%)'
    : 'radial-gradient(circle at 50% 42%, rgba(251,191,36,0.1), rgba(10,5,24,0.65) 58%, rgba(3,2,9,0.88) 100%)';

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-[#04020a]">
      <img
        src="./images/s3/marvel_bg.jpg"
        alt=""
        aria-hidden="true"
        className={`w-full h-full object-cover brightness-[0.58] contrast-[1.06] blur-[2.5px] transition-transform duration-700 ${
          stormWaveActive ? 'scale-[1.06]' : 'scale-[1.04]'
        }`}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: overlayGradient }}
      />
    </div>
  );
};
