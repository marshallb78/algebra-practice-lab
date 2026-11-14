import React, { useEffect, useState } from 'react';
import { EggRarity } from '../../types/game';
import {
  getEggDefinition,
  getPetAnimationFrames,
  getPetImage,
  getPetSpeciesDefinition,
} from '../../data/petsAndEggs';

export const EggBadgeVisual: React.FC<{ rarity: EggRarity; size?: number; className?: string }> = ({
  rarity,
  size = 56,
  className = '',
}) => {
  const def = getEggDefinition(rarity);
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-1 rounded-full blur-md opacity-70 pointer-events-none"
        style={{ background: def.glowColor }}
      />
      <img
        src={def.eggImage}
        alt={rarity}
        width={size}
        height={size}
        className="relative w-full h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]"
        draggable={false}
      />
    </div>
  );
};

export const PetSprite2D: React.FC<{
  speciesId: string;
  rarity: EggRarity;
  size?: number;
  tired?: boolean;
  attacking?: boolean;
  flip?: boolean;
  className?: string;
}> = ({ speciesId, rarity, size = 56, attacking = false, flip = false, className = '' }) => {
  const spec = getPetSpeciesDefinition(speciesId, rarity);
  const frames = getPetAnimationFrames(speciesId);
  const fallbackSrc = getPetImage(speciesId);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % frames.length);
    }, attacking ? 95 : 155);
    return () => window.clearInterval(id);
  }, [attacking, frames.length]);

  const activeSrc = frames[frameIdx] || fallbackSrc;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none pointer-events-none transition-transform duration-150 ${className}`}
      style={{
        width: size,
        height: size,
        transform: `${flip ? 'scaleX(-1) ' : ''}${attacking ? 'scale(1.16) translateY(-4px)' : 'scale(1)'}`,
      }}
    >
      <div
        className="absolute inset-0 rounded-full blur-md pointer-events-none transition-opacity"
        style={{
          background: spec.glowColor,
          opacity: attacking ? 0.92 : 0.45,
        }}
      />
      <img
        src={activeSrc}
        alt={spec.name}
        width={size}
        height={size}
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src !== fallbackSrc) img.src = fallbackSrc;
        }}
        className="relative w-full h-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)]"
        draggable={false}
      />
    </div>
  );
};
