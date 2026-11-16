import React, { useEffect, useRef, useState } from 'react';
import { CursorDefinition } from '../../data/cursors';

interface CursorVisualProps {
  cursor: CursorDefinition;
  size?: number;
  className?: string;
  disableDropShadow?: boolean;
}

/**
 * Renders the custom cursor PNG if present in public/images/cursors/<id>.png,
 * falling back seamlessly to an elemental styled pointer SVG when the user hasn't added the PNG yet.
 */
export const CursorVisual: React.FC<CursorVisualProps> = ({
  cursor,
  size = 40,
  className = '',
  disableDropShadow = false,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [cursor.image]);

  if (!imgFailed) {
    return (
      <img
        src={cursor.image}
        alt={cursor.name}
        width={size}
        height={size}
        draggable={false}
        onError={() => setImgFailed(true)}
        className={`object-contain pointer-events-none select-none ${className}`}
        style={{
          width: size,
          height: size,
          ...(disableDropShadow
            ? {}
            : { filter: `drop-shadow(0 0 8px ${cursor.glowColor})` }),
        }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={`pointer-events-none select-none ${className}`}
      style={disableDropShadow ? undefined : { filter: `drop-shadow(0 0 8px ${cursor.glowColor})` }}
    >
      <defs>
        <linearGradient id={`cg-${cursor.id}`} x1="4" y1="4" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor={cursor.accentColor} />
          <stop
            offset="100%"
            stopColor={
              cursor.crateType === 'frost'
                ? '#0284c7'
                : cursor.crateType === 'starter'
                ? '#0369a1'
                : '#9a3412'
            }
          />
        </linearGradient>
      </defs>
      <path
        d="M6 4L28 16L17.5 19.2L24.5 29.5L20.5 32L13.5 21.5L7.5 28L6 4Z"
        fill={`url(#cg-${cursor.id})`}
        stroke="#0f172a"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {cursor.freezeImmune && (
        <circle cx="24" cy="9" r="4" fill="#fb923c" opacity="0.9" />
      )}
      {cursor.id === 'frosty_cursor' && (
        <path d="M25 6L26.5 9.5L30 11L26.5 12.5L25 16L23.5 12.5L20 11L23.5 9.5Z" fill="#e0f2fe" />
      )}
    </svg>
  );
};

interface EquippedCursorFollowerProps {
  cursor: CursorDefinition | null;
}

/**
 * Floating elemental cursor follower using direct GPU transform mutations (zero React re-renders per mouse move)
 * so 4GB RAM Chromebooks stay smooth at 60fps.
 */
export const EquippedCursorFollower: React.FC<EquippedCursorFollowerProps> = ({ cursor }) => {
  const followerRef = useRef<HTMLDivElement | null>(null);
  const clickingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number; visible: boolean }>({
    x: -100,
    y: -100,
    visible: false,
  });

  useEffect(() => {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    const el = followerRef.current;
    if (!cursor) {
      if (el) el.style.opacity = '0';
      lastPosRef.current.visible = false;
      root?.classList.remove('in-game-custom-cursor');
      return;
    }

    const isTouchDevice =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;

    if (!isTouchDevice) {
      root?.classList.add('in-game-custom-cursor');
    }

    const applyTransform = () => {
      const node = followerRef.current;
      const p = lastPosRef.current;
      if (!node || !p.visible) return;
      node.style.opacity = '1';
      node.style.transform = `translate3d(${p.x - 8}px, ${p.y - 5}px, 0) ${
        clickingRef.current ? 'scale(0.84) rotate(-8deg)' : 'scale(1)'
      }`;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        root?.classList.remove('in-game-custom-cursor');
        lastPosRef.current.visible = false;
        if (followerRef.current) followerRef.current.style.opacity = '0';
        return;
      }
      root?.classList.add('in-game-custom-cursor');
      lastPosRef.current.x = e.clientX;
      lastPosRef.current.y = e.clientY;
      lastPosRef.current.visible = true;
      applyTransform();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      clickingRef.current = true;
      applyTransform();
    };
    const onUp = () => {
      clickingRef.current = false;
      applyTransform();
    };
    const onLeave = () => {
      lastPosRef.current.visible = false;
      if (followerRef.current) followerRef.current.style.opacity = '0';
      root?.classList.remove('in-game-custom-cursor');
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      root?.classList.remove('in-game-custom-cursor');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [cursor]);

  if (!cursor) return null;

  return (
    <div
      ref={followerRef}
      className="fixed z-[999] pointer-events-none select-none"
      style={{
        left: 0,
        top: 0,
        opacity: 0,
        transformOrigin: '8px 5px',
        willChange: 'transform',
      }}
    >
      <CursorVisual cursor={cursor} size={46} disableDropShadow={true} />
    </div>
  );
};

