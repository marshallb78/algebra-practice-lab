import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { soundManager } from '../../audio/soundManager';

interface SnapDustCutsceneModalProps {
  skinImage: string;
  skinName: string;
  snappedByUsername: string;
  isPreview?: boolean;
  onComplete: () => void;
}

interface DustParticle {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  size: number;
  delayFrac: number;
  vx: number;
  vy: number;
  life: number;
  started: boolean;
}

/**
 * Full-Screen Unclipped Infinity Gauntlet Snap ("Turned to Ash") Cutscene:
 * Renders directly onto a full-viewport canvas (zero bounding box clipping) so
 * dust particles scatter freely across the whole screen while clearly signaling an attack.
 */
export const SnapDustCutsceneModal: React.FC<SnapDustCutsceneModalProps> = ({
  skinImage,
  skinName,
  snappedByUsername,
  isPreview = false,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phaseLabel, setPhaseLabel] = useState<'flash' | 'dust' | 'gone'>('flash');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    soundManager.playThunder();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = window.innerWidth || 1280;
    const H = window.innerHeight || 720;
    canvas.width = W;
    canvas.height = H;

    let animId = 0;
    let cancelled = false;
    const startMs = performance.now();
    const totalDurationMs = 4200;

    const spriteSize = Math.min(340, Math.round(Math.min(W, H) * 0.42));
    const drawX = Math.round((W - spriteSize) / 2);
    const drawY = Math.round(H * 0.44 - spriteSize / 2);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = skinImage || './images/skins/classic_matthew.png';

    const buildParticles = (loadedImg: HTMLImageElement | null): DustParticle[] => {
      const off = document.createElement('canvas');
      off.width = spriteSize;
      off.height = spriteSize;
      const octx = off.getContext('2d');
      if (!octx) return [];

      if (loadedImg && loadedImg.naturalWidth > 0) {
        const scale = Math.min(
          spriteSize / loadedImg.naturalWidth,
          spriteSize / loadedImg.naturalHeight
        );
        const dw = loadedImg.naturalWidth * scale;
        const dh = loadedImg.naturalHeight * scale;
        const dx = (spriteSize - dw) / 2;
        const dy = (spriteSize - dh) / 2;
        octx.drawImage(loadedImg, dx, dy, dw, dh);
      } else {
        octx.fillStyle = '#f43f5e';
        octx.beginPath();
        octx.arc(spriteSize / 2, spriteSize / 2, spriteSize * 0.36, 0, Math.PI * 2);
        octx.fill();
      }

      let data: Uint8ClampedArray;
      try {
        data = octx.getImageData(0, 0, spriteSize, spriteSize).data;
      } catch {
        return [];
      }

      const particles: DustParticle[] = [];
      // Stride 4 keeps particle count Chromebook-friendly while looking crisp across full screen
      const stride = 4;
      for (let py = 0; py < spriteSize; py += stride) {
        for (let px = 0; px < spriteSize; px += stride) {
          const idx = (py * spriteSize + px) * 4;
          const a = data[idx + 3];
          if (a < 28) continue;
          const diag = (px / spriteSize) * 0.65 + (1 - py / spriteSize) * 0.35;
          const jitter = (Math.random() - 0.5) * 0.16;
          particles.push({
            x: drawX + px,
            y: drawY + py,
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: a / 255,
            size: stride + Math.random() * 1.6,
            delayFrac: Math.max(0.06, Math.min(0.84, 1 - diag + jitter)),
            vx: 2.2 + Math.random() * 6.5,
            vy: -1.4 - Math.random() * 4.2,
            life: 1,
            started: false,
          });
        }
      }
      return particles;
    };

    let particles: DustParticle[] = [];
    let initialized = false;

    const beginAnimation = (loadedImg: HTMLImageElement | null) => {
      if (cancelled || initialized) return;
      initialized = true;
      particles = buildParticles(loadedImg);

      const frame = (now: number) => {
        if (cancelled) return;
        const elapsed = now - startMs;
        const t = Math.min(1, elapsed / totalDurationMs);

        if (t < 0.18) {
          setPhaseLabel('flash');
        } else if (t < 0.84) {
          setPhaseLabel('dust');
        } else {
          setPhaseLabel('gone');
        }

        ctx.clearRect(0, 0, W, H);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (t >= p.delayFrac) {
            p.started = true;
          }
          if (p.started) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 1.018;
            p.vy -= 0.04;
            p.life = Math.max(0, p.life - 0.017);
          }
          if (p.life <= 0.01) continue;

          const ashMix = p.started ? Math.min(1, 1 - p.life) : 0;
          const cr = Math.round(p.r * (1 - ashMix * 0.45) + 95 * ashMix * 0.45);
          const cg = Math.round(p.g * (1 - ashMix * 0.65) + 35 * ashMix * 0.45);
          const cb = Math.round(p.b * (1 - ashMix * 0.55) + 60 * ashMix * 0.45);
          ctx.globalAlpha = Math.max(0, Math.min(1, p.a * p.life));
          ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        if (t < 1) {
          animId = requestAnimationFrame(frame);
        } else {
          setTimeout(() => {
            if (!cancelled) onCompleteRef.current();
          }, 550);
        }
      };

      animId = requestAnimationFrame(frame);
    };

    img.onload = () => beginAnimation(img);
    img.onerror = () => beginAnimation(null);
    const fallbackTimeout = window.setTimeout(() => beginAnimation(null), 500);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimeout);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [skinImage]);

  return (
    <div className="fixed inset-0 z-[190] bg-gradient-to-b from-[#2b040b]/96 via-[#14051c]/96 to-black/98 flex flex-col items-center justify-between py-6 px-4 select-none overflow-hidden">
      {/* Danger Crimson Pulse Border */}
      <div
        className={`fixed inset-0 pointer-events-none border-[8px] transition-opacity duration-300 ${
          phaseLabel === 'flash'
            ? 'border-red-500 shadow-[inset_0_0_120px_rgba(239,68,68,0.85)] opacity-100'
            : 'border-rose-600/60 shadow-[inset_0_0_90px_rgba(225,29,72,0.5)] opacity-85'
        }`}
      />

      {/* Full-screen unclipped disintegration canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-screen h-screen pointer-events-none z-[192]"
      />

      {/* Top Danger Banner */}
      <div className="relative z-[195] flex flex-col items-center text-center mt-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/90 border-2 border-red-200 text-white text-xs font-black uppercase tracking-[0.2em] mb-2 shadow-[0_0_25px_rgba(239,68,68,0.85)] animate-pulse">
          <AlertTriangle className="w-4 h-4 text-yellow-200" />
          DANGER • YOU HAVE BEEN SNAPPED!
        </div>

        <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-marvel text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-300 to-purple-300 drop-shadow-[0_4px_18px_rgba(239,68,68,0.6)]">
          {phaseLabel === 'flash'
            ? '*THANOS SNAPPED!*'
            : phaseLabel === 'dust'
            ? `${skinName} IS TURNING TO ASH...`
            : 'WIPED TO ZERO!'}
        </h2>
      </div>

      <div className="flex-1" />

      {/* Bottom Explanation & Continue */}
      <div className="relative z-[195] flex flex-col items-center text-center max-w-md w-full mb-2">
        <div className="px-5 py-3.5 rounded-2xl bg-slate-950/92 border-2 border-rose-500/65 w-full shadow-2xl">
          <div className="text-sm font-black text-white flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>
              Attacked by <span className="text-amber-300">{snappedByUsername}</span>
            </span>
          </div>
          <p className="text-xs font-bold text-rose-300 mt-1">
            {isPreview
              ? 'Preview Mode — Coins, Upgrades & Leaderboard stay untouched.'
              : 'Your Coins, Upgrades & Leaderboard Total were wiped to 0! Your Gems & Skins are safe.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="mt-3 px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-300/60 text-white text-xs font-black uppercase cursor-pointer shadow-lg"
        >
          {isPreview ? 'Close Preview' : 'Continue'}
        </button>
      </div>
    </div>
  );
};
