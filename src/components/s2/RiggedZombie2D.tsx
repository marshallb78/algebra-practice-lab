import React, { useEffect, useState } from 'react';

interface RiggedZombie2DProps {
  variant?: 'normal' | 'frost' | 'boss';
  pose?: 'walk' | 'lunge' | 'hit' | 'ko';
  size?: number;
  flip?: boolean;
  className?: string;
}

/**
 * Multi-frame sprite-animated CC0 Zombie character using real transparent PNG sequences
 * from public/images/s2/zombies/ with variant tint/glow (Frost Walker, Normal, Boss).
 */
export const RiggedZombie2D: React.FC<RiggedZombie2DProps> = ({
  variant = 'frost',
  pose = 'walk',
  size = 86,
  flip = false,
  className = '',
}) => {
  const [frame, setFrame] = useState<number>(1);

  useEffect(() => {
    if (pose === 'ko') return;
    const id = window.setInterval(() => {
      setFrame((f) => (f % (pose === 'lunge' ? 4 : 6)) + 1);
    }, pose === 'lunge' ? 95 : 130);
    return () => window.clearInterval(id);
  }, [pose]);

  const gender = variant === 'normal' ? 'female' : 'male';
  const src =
    pose === 'ko'
      ? `./images/s2/zombies/${gender}_dead.png`
      : pose === 'lunge'
      ? `./images/s2/zombies/${gender}_attack_${((frame - 1) % 4) + 1}.png`
      : `./images/s2/zombies/${gender}_walk_${((frame - 1) % 6) + 1}.png`;

  const variantFilter =
    pose === 'hit'
      ? 'drop-shadow(0 0 14px rgba(248,113,113,0.95)) brightness(1.45)'
      : variant === 'boss'
      ? 'drop-shadow(0 0 16px rgba(239,68,68,0.8)) hue-rotate(-18deg) saturate(1.35)'
      : variant === 'frost'
      ? 'drop-shadow(0 0 10px rgba(56,189,248,0.65)) hue-rotate(85deg) saturate(1.15)'
      : 'drop-shadow(0 6px 10px rgba(0,0,0,0.5))';

  return (
    <div
      className={`relative inline-flex items-end justify-center select-none pointer-events-none ${className}`}
      style={{
        width: size,
        height: size * 1.15,
        transform: `${flip ? 'scaleX(-1) ' : ''}${pose === 'ko' ? 'rotate(18deg) translateY(8px)' : ''}`,
      }}
    >
      <img
        src={src}
        alt="Zombie"
        className="w-full h-full object-contain"
        style={{ filter: variantFilter }}
        draggable={false}
      />
    </div>
  );
};
