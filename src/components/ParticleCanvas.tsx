import React, { useEffect, useRef } from 'react';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  rotSpeed: number;
  type: 'coin' | 'spark' | 'star' | 'ember' | 'matthew_rain';
  gravity: number;
  imageSrc?: string;
}

// Keep particle cap low and pause RAF when idle for smooth 60fps Chromebook performance
const MAX_PARTICLES = 22;

class ParticleSystem {
  private particles: Particle[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animId: number | null = null;
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private spriteCanvasCache: Map<string, HTMLCanvasElement> = new Map();
  public enabled: boolean = true;
  public reducedMotion: boolean = false;

  public init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
  }

  public resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private getPreRenderedSprite(src: string): HTMLCanvasElement | null {
    if (typeof Image === 'undefined' || typeof document === 'undefined') return null;

    const cachedCanvas = this.spriteCanvasCache.get(src);
    if (cachedCanvas) return cachedCanvas;

    let img = this.imageCache.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      this.imageCache.set(src, img);
    }

    if (img.complete && img.naturalWidth > 0) {
      const offscreen = document.createElement('canvas');
      offscreen.width = 40;
      offscreen.height = 40;
      const octx = offscreen.getContext('2d');
      if (octx) {
        octx.beginPath();
        octx.arc(20, 20, 18, 0, Math.PI * 2);
        octx.closePath();
        octx.clip();
        octx.drawImage(img, 2, 2, 36, 36);
        this.spriteCanvasCache.set(src, offscreen);
        return offscreen;
      }
    }
    return null;
  }

  private pushBounded(p: Particle) {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push(p);
    this.ensureLoopRunning();
  }

  public getActiveCount(): number {
    return this.particles.length;
  }

  public emitClick(x: number, y: number, isCrit: boolean, count = 4) {
    if (!this.enabled || this.reducedMotion) return;

    const actualCount = isCrit ? Math.min(7, count + 2) : Math.min(4, count);
    const colors = isCrit
      ? ['#fbbf24', '#ef4444', '#ffffff']
      : ['#facc15', '#fb923c', '#ffffff'];

    for (let i = 0; i < actualCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (isCrit ? 4.5 : 2.8) + Math.random() * (isCrit ? 6 : 4);
      this.pushBounded({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isCrit ? 3 : 1.5),
        size: isCrit ? 3.5 + Math.random() * 2.5 : 2.5 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.95,
        decay: 0.045 + Math.random() * 0.02,
        rotation: 0,
        rotSpeed: 0,
        type: isCrit ? 'spark' : 'coin',
        gravity: 0.25,
      });
    }
  }

  public emitPrestige() {
    if (!this.enabled || this.reducedMotion || !this.canvas) return;
    const colors = ['#facc15', '#ef4444', '#a855f7', '#ffffff'];
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * this.canvas.width;
      const y = this.canvas.height + 16;
      this.pushBounded({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: -(8 + Math.random() * 10),
        size: 3.5 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.95,
        decay: 0.022 + Math.random() * 0.012,
        rotation: 0,
        rotSpeed: 0,
        type: 'star',
        gravity: 0.12,
      });
    }
  }

  public emitMatthewRain(count = 10, skinImages?: string[]) {
    if (!this.enabled || this.reducedMotion || !this.canvas) return;
    const colors = ['#a855f7', '#ef4444', '#facc15', '#38bdf8'];
    const validImages = skinImages && skinImages.length > 0 ? skinImages : undefined;
    if (validImages) {
      validImages.slice(0, 6).forEach((src) => this.getPreRenderedSprite(src));
    }

    const cappedCount = Math.min(10, count);
    for (let i = 0; i < cappedCount; i++) {
      const x = Math.random() * this.canvas.width;
      const y = -28 - Math.random() * 90;
      const chosenImg = validImages
        ? validImages[Math.floor(Math.random() * Math.min(validImages.length, 6))]
        : undefined;
      this.pushBounded({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 4.2 + Math.random() * 3.4,
        size: chosenImg ? 16 + Math.random() * 5 : 8 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.9,
        decay: 0.01 + Math.random() * 0.005,
        rotation: 0,
        rotSpeed: 0,
        type: 'matthew_rain',
        gravity: 0.05,
        imageSrc: chosenImg,
      });
    }
  }

  private ensureLoopRunning() {
    if (this.animId !== null) return;
    const tick = () => {
      this.updateAndDraw();
      if (this.particles.length > 0) {
        this.animId = requestAnimationFrame(tick);
      } else {
        this.animId = null;
      }
    };
    this.animId = requestAnimationFrame(tick);
  }

  private updateAndDraw() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.particles.length === 0) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y > this.canvas.height + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.type === 'matthew_rain') {
        const sprite = p.imageSrc ? this.getPreRenderedSprite(p.imageSrc) : null;
        const r = p.size;
        if (sprite) {
          this.ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
        } else {
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          this.ctx.fillStyle = p.color;
          this.ctx.fill();
        }
      } else if (p.type === 'coin') {
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else {
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
    }
    this.ctx.globalAlpha = 1.0;
  }

  public destroy() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.particles = [];
  }
}

export const particleEngine = new ParticleSystem();

export const ParticleCanvas: React.FC<{ reducedMotion?: boolean; showParticles?: boolean }> = ({
  reducedMotion = false,
  showParticles = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    particleEngine.enabled = showParticles;
    particleEngine.reducedMotion = reducedMotion;
  }, [reducedMotion, showParticles]);

  useEffect(() => {
    if (canvasRef.current) {
      particleEngine.init(canvasRef.current);
    }

    const handleResize = () => {
      particleEngine.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      particleEngine.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
      style={{ display: showParticles ? 'block' : 'none' }}
    />
  );
};
