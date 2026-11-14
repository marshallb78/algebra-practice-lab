import React, { useEffect, useRef } from 'react';

export interface CameraKeyframe {
  x: number;
  y: number;
  z: number;
  yaw?: number;
  pitch?: number;
  shake?: number;
}

export interface WorldEntity3D {
  id: string;
  kind:
    | 'sprite'
    | 'pine'
    | 'fence'
    | 'pillar'
    | 'crystal'
    | 'coin'
    | 'gem'
    | 'eyes'
    | 'token3d'
    | 'light_Orb';
  x: number;
  y: number;
  z: number;
  scale: number;
  vx?: number;
  vy?: number;
  vz?: number;
  frames?: string[];
  flip?: boolean;
  tintColor?: string;
  glowColor?: string;
  rotation?: number;
  vr?: number;
  alpha?: number;
  bobSpeed?: number;
  bobAmp?: number;
  fps?: number;
}

export interface CameraOrbitSpec {
  centerX?: number;
  centerZ: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  startY?: number;
  endY?: number;
  lookAtY?: number;
}

export interface SceneSegment3D {
  durationMs: number;
  skyTop: string;
  skyBottom: string;
  groundNear: string;
  groundFar: string;
  horizonGlow: string;
  auroraColor?: string;
  lightningFlash?: boolean;
  snowCount?: number;
  snowColor?: string;
  snowVz?: number;
  cameraStart: CameraKeyframe;
  cameraEnd: CameraKeyframe;
  cameraOrbit?: CameraOrbitSpec;
  backdropStyle?: 'horizon' | 'vortex' | 'starfield' | 'inferno' | 'blizzard';
  speedLines?: boolean;
  spotlights?: boolean;
  entities: WorldEntity3D[];
  onEnter?: () => void;
  fadeInMs?: number;
  fadeOutMs?: number;
  radialBurstAtMs?: number;
  radialBurstColor?: string;
}

interface Scene3DCutsceneCanvasProps {
  scenes: SceneSegment3D[];
  onComplete: () => void;
  /** When true, holds alive on final scene without fading out or auto-closing until parent dismisses! */
  holdAtEnd?: boolean;
  onReachedEnd?: () => void;
  zIndexClass?: string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export const Scene3DCutsceneCanvas: React.FC<Scene3DCutsceneCanvasProps> = ({
  scenes,
  onComplete,
  holdAtEnd = false,
  onReachedEnd,
  zIndexClass = 'z-[130]',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef(false);
  const reachedEndRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onReachedEndRef = useRef(onReachedEnd);
  onReachedEndRef.current = onReachedEnd;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    completedRef.current = false;
    reachedEndRef.current = false;

    // Preload all unique image URLs across scenes once (including Classic Matthew for 3D token)
    const imageCache = new Map<string, HTMLImageElement>();
    const preloadUrl = (src: string) => {
      if (src && !imageCache.has(src)) {
        const img = new Image();
        img.src = src;
        imageCache.set(src, img);
      }
    };
    preloadUrl('./images/skins/classic_matthew.png');
    for (const seg of scenes) {
      for (const ent of seg.entities) {
        if (!ent.frames) continue;
        for (const src of ent.frames) {
          preloadUrl(src);
        }
      }
    }

    const particles = Array.from({ length: 110 }, (_, i) => ({
      x: ((i * 73.1) % 36) - 18,
      y: ((i * 29.7) % 12) + 0.1,
      z: ((i * 41.3) % 44) - 2,
      size: 1.5 + (i % 4) * 1.1,
      driftX: Math.sin(i * 1.7) * 0.6,
      driftY: -0.4 - (i % 5) * 0.25,
    }));

    const startTime = performance.now();
    let prevTime = startTime;
    let enteredIdx = -1;
    let rafId = 0;

    // Precompute cumulative scene boundaries
    const cumulativeEnd: number[] = [];
    let running = 0;
    for (const s of scenes) {
      running += s.durationMs;
      cumulativeEnd.push(running);
    }
    const totalDuration = running;

    const resize = () => {
      // Capping DPR at 1.5 boosts performance dramatically on low-powered Chromebooks while staying sharp
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const project = (
      wx: number,
      wy: number,
      wz: number,
      camX: number,
      camY: number,
      camZ: number,
      yaw: number,
      pitch: number,
      cx: number,
      cy: number,
      fov: number
    ) => {
      const dx = wx - camX;
      const dy = wy - camY;
      const dz = wz - camZ;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rx = dx * cosY - dz * sinY;
      const rz = dx * sinY + dz * cosY;
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const ry = dy * cosP - rz * sinP;
      const fz = dy * sinP + rz * cosP;
      if (fz <= 0.14) return null;
      const scale = fov / fz;
      return {
        sx: cx + rx * scale,
        sy: cy - ry * scale,
        scale,
        fz,
      };
    };

    const drawPine3D = (sx: number, sy: number, scale: number, alpha: number) => {
      const h = scale * 3.8;
      const w = scale * 1.9;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#2d1c10';
      ctx.fillRect(sx - w * 0.09, sy - h * 0.25, w * 0.18, h * 0.25);
      const tiers = [
        { yOff: 0.2, hFrac: 0.42, wFrac: 1.0, col: '#0b2c2a' },
        { yOff: 0.42, hFrac: 0.36, wFrac: 0.78, col: '#0f3d3b' },
        { yOff: 0.62, hFrac: 0.38, wFrac: 0.54, col: '#164e4d' },
      ];
      for (const tier of tiers) {
        const baseY = sy - h * tier.yOff;
        const tipY = baseY - h * tier.hFrac;
        const halfW = w * tier.wFrac * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx, tipY);
        ctx.lineTo(sx + halfW, baseY);
        ctx.lineTo(sx - halfW, baseY);
        ctx.closePath();
        ctx.fillStyle = tier.col;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(sx, tipY);
        ctx.lineTo(sx + halfW * 0.7, tipY + h * tier.hFrac * 0.34);
        ctx.lineTo(sx - halfW * 0.55, tipY + h * tier.hFrac * 0.28);
        ctx.closePath();
        ctx.fillStyle = 'rgba(224,242,254,0.82)';
        ctx.fill();
      }
      ctx.restore();
    };

    const drawFence3D = (sx: number, sy: number, scale: number, alpha: number) => {
      const h = scale * 1.25;
      const w = scale * 2.1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#4a3121';
      ctx.fillRect(sx - w * 0.6, sy - h * 0.78, w * 1.2, h * 0.14);
      ctx.fillRect(sx - w * 0.6, sy - h * 0.42, w * 1.2, h * 0.14);
      ctx.fillStyle = '#5c3d28';
      ctx.fillRect(sx - w * 0.08, sy - h, w * 0.16, h);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(sx - w * 0.09, sy - h - h * 0.05, w * 0.18, h * 0.11);
      ctx.restore();
    };

    const drawCrystal3D = (
      sx: number,
      sy: number,
      scale: number,
      alpha: number,
      color = '#67e8f9'
    ) => {
      const h = scale * 3.1;
      const w = scale * 1.05;
      ctx.save();
      ctx.globalAlpha = alpha;
      // Soft halo glow behind crystal (much faster than canvas shadowBlur on Chromebooks!)
      const halo = ctx.createRadialGradient(sx, sy - h * 0.48, w * 0.1, sx, sy - h * 0.48, w * 1.35);
      halo.addColorStop(0, `${color}55`);
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.fillRect(sx - w * 1.4, sy - h * 1.2, w * 2.8, h * 1.4);

      ctx.beginPath();
      ctx.moveTo(sx, sy - h);
      ctx.lineTo(sx + w * 0.48, sy - h * 0.3);
      ctx.lineTo(sx + w * 0.34, sy);
      ctx.lineTo(sx - w * 0.34, sy);
      ctx.lineTo(sx - w * 0.48, sy - h * 0.3);
      ctx.closePath();
      const grad = ctx.createLinearGradient(sx - w * 0.4, sy - h, sx + w * 0.4, sy);
      grad.addColorStop(0, '#ecfeff');
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, '#0c4a6e');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    };

    const drawToken3D = (
      sx: number,
      sy: number,
      scale: number,
      alpha: number,
      spinAngle: number
    ) => {
      const R = Math.max(20, scale * 1.45);
      const cosA = Math.cos(spinAngle);
      const sinA = Math.sin(spinAngle);
      const facingFront = cosA >= 0;
      const absCos = Math.max(0.06, Math.abs(cosA));
      const faceRx = absCos * R;
      const rimThickness = Math.abs(sinA) * R * 0.34;
      const rimDir = sinA >= 0 ? 1 : -1;
      const centerY = sy - R * 1.15;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Rotating golden-prism god rays behind the 3D token
      const rayCount = 12;
      for (let i = 0; i < rayCount; i++) {
        const a0 = spinAngle * 0.45 + (i / rayCount) * Math.PI * 2;
        const a1 = a0 + 0.14;
        const rayLen = R * (2.35 + (i % 2) * 0.55);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(253, 224, 71, 0.24)' : 'rgba(56, 189, 248, 0.18)';
        ctx.beginPath();
        ctx.moveTo(sx, centerY);
        ctx.lineTo(sx + Math.cos(a0) * rayLen, centerY + Math.sin(a0) * rayLen);
        ctx.lineTo(sx + Math.cos(a1) * rayLen, centerY + Math.sin(a1) * rayLen);
        ctx.closePath();
        ctx.fill();
      }

      // Multi-layered flashy golden & prismatic aura behind 3D token
      const aura = ctx.createRadialGradient(sx, centerY, R * 0.2, sx, centerY, R * 2.25);
      aura.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
      aura.addColorStop(0.35, 'rgba(251, 191, 36, 0.45)');
      aura.addColorStop(0.65, 'rgba(232, 121, 249, 0.2)');
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(sx, centerY, R * 2.25, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting flash sparkles around token
      for (let i = 0; i < 6; i++) {
        const oa = spinAngle * 1.4 + (i / 6) * Math.PI * 2;
        const ox = sx + Math.cos(oa) * R * 1.38;
        const oy = centerY + Math.sin(oa) * R * 1.1;
        const sr = Math.max(2.5, R * 0.08 * (0.7 + 0.3 * Math.sin(spinAngle * 3 + i)));
        ctx.fillStyle = i % 2 === 0 ? '#fef08a' : '#67e8f9';
        ctx.beginPath();
        ctx.arc(ox, oy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3D cylindrical rim extrusion: back ellipse -> connecting wall -> front ellipse
      const backX = sx - rimDir * rimThickness * 0.5;
      const faceX = sx + rimDir * rimThickness * 0.5;

      const rimGrad = ctx.createLinearGradient(sx, centerY - R, sx, centerY + R);
      rimGrad.addColorStop(0, '#78350f');
      rimGrad.addColorStop(0.25, '#fde047');
      rimGrad.addColorStop(0.55, '#b45309');
      rimGrad.addColorStop(0.8, '#fef08a');
      rimGrad.addColorStop(1, '#451a03');

      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.ellipse(backX, centerY, faceRx, R, 0, 0, Math.PI * 2);
      ctx.fill();

      if (rimThickness > 0.8) {
        ctx.fillRect(Math.min(backX, faceX), centerY - R, Math.abs(faceX - backX), R * 2);
        // Subtle milled coin edge grooves visible as coin passes 90 deg
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
        ctx.lineWidth = Math.max(1, R * 0.015);
        for (let gy = -0.82; gy <= 0.82; gy += 0.2) {
          const yy = centerY + gy * R;
          ctx.beginPath();
          ctx.moveTo(Math.min(backX, faceX), yy);
          ctx.lineTo(Math.max(backX, faceX), yy);
          ctx.stroke();
        }
      }

      // Active visible coin face (Front vs Back in 360 rotation)
      const faceGrad = ctx.createLinearGradient(faceX - faceRx, centerY - R, faceX + faceRx, centerY + R);
      if (facingFront) {
        faceGrad.addColorStop(0, '#fef9c3');
        faceGrad.addColorStop(0.3, '#fde047');
        faceGrad.addColorStop(0.65, '#f59e0b');
        faceGrad.addColorStop(1, '#92400e');
      } else {
        faceGrad.addColorStop(0, '#fef08a');
        faceGrad.addColorStop(0.35, '#fbbf24');
        faceGrad.addColorStop(0.7, '#d97706');
        faceGrad.addColorStop(1, '#78350f');
      }
      ctx.fillStyle = faceGrad;
      ctx.beginPath();
      ctx.ellipse(faceX, centerY, faceRx, R, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer coin specular edge stroke
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = Math.max(1.5, R * 0.045);
      ctx.beginPath();
      ctx.ellipse(faceX, centerY, faceRx, R, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner embossed recessed ring
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = Math.max(2, R * 0.075);
      ctx.beginPath();
      ctx.ellipse(faceX, centerY, faceRx * 0.86, R * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Highlight bevel
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, R * 0.04);
      ctx.beginPath();
      ctx.ellipse(faceX, centerY, faceRx * 0.92, R * 0.92, 0, Math.PI * 0.9, Math.PI * 1.75);
      ctx.stroke();

      // Render front or back artwork with POSITIVE absCos horizontal foreshortening (text NEVER reverses!)
      if (absCos > 0.14) {
        if (facingFront) {
          const classicImg = imageCache.get('./images/skins/classic_matthew.png');
          if (classicImg && classicImg.complete && classicImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(faceX, centerY - R * 0.04, faceRx * 0.62, R * 0.62, 0, 0, Math.PI * 2);
            ctx.clip();
            ctx.translate(faceX, centerY - R * 0.04);
            ctx.scale(absCos, 1);
            const faceSize = R * 1.24;
            ctx.globalAlpha = alpha * 0.96;
            ctx.drawImage(classicImg, -faceSize * 0.5, -faceSize * 0.5, faceSize, faceSize);
            ctx.fillStyle = 'rgba(253, 224, 71, 0.14)';
            ctx.beginPath();
            ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          ctx.save();
          ctx.translate(faceX, centerY);
          ctx.scale(absCos, 1);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const topFontSize = Math.max(9, Math.round(R * 0.155));
          ctx.font = `900 ${topFontSize}px "Fredoka", "Outfit", system-ui, sans-serif`;
          ctx.lineWidth = Math.max(2, R * 0.035);
          ctx.strokeStyle = '#451a03';
          ctx.strokeText('MATTHEW', 0, -R * 0.72);
          ctx.fillStyle = '#fef9c3';
          ctx.fillText('MATTHEW', 0, -R * 0.72);

          const ribW = R * 1.56;
          const ribH = R * 0.28;
          const ribY = R * 0.62;
          const ribGrad = ctx.createLinearGradient(-ribW * 0.5, ribY - ribH * 0.5, ribW * 0.5, ribY + ribH * 0.5);
          ribGrad.addColorStop(0, '#78350f');
          ribGrad.addColorStop(0.5, '#1e1b4b');
          ribGrad.addColorStop(1, '#78350f');
          ctx.fillStyle = ribGrad;
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = Math.max(1.5, R * 0.03);
          ctx.beginPath();
          ctx.roundRect(-ribW * 0.5, ribY - ribH * 0.5, ribW, ribH, R * 0.09);
          ctx.fill();
          ctx.stroke();

          const botFontSize = Math.max(8, Math.round(R * 0.145));
          ctx.font = `900 ${botFontSize}px "Fredoka", "Outfit", system-ui, sans-serif`;
          ctx.fillStyle = '#fde047';
          ctx.fillText('SHOP TOKEN', 0, ribY + R * 0.01);
          ctx.restore();
        } else {
          // Back Face of 360-degree coin: Royal VIP Seal & "ALL SKINS FREE" (upright, never reversed!)
          ctx.save();
          ctx.translate(faceX, centerY);
          ctx.scale(absCos, 1);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Inner dark indigo emblem disc
          ctx.fillStyle = '#1e1b4b';
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = Math.max(1.5, R * 0.035);
          ctx.beginPath();
          ctx.arc(0, -R * 0.04, R * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Glowing center prism gem on reverse side
          ctx.fillStyle = '#67e8f9';
          ctx.beginPath();
          ctx.moveTo(0, -R * 0.38);
          ctx.lineTo(R * 0.26, -R * 0.04);
          ctx.lineTo(0, R * 0.3);
          ctx.lineTo(-R * 0.26, -R * 0.04);
          ctx.closePath();
          ctx.fill();

          const topFontSize = Math.max(9, Math.round(R * 0.15));
          ctx.font = `900 ${topFontSize}px "Fredoka", "Outfit", system-ui, sans-serif`;
          ctx.lineWidth = Math.max(2, R * 0.035);
          ctx.strokeStyle = '#451a03';
          ctx.strokeText('1 IN 1,000', 0, -R * 0.72);
          ctx.fillStyle = '#fef9c3';
          ctx.fillText('1 IN 1,000', 0, -R * 0.72);

          const ribW = R * 1.56;
          const ribH = R * 0.28;
          const ribY = R * 0.62;
          ctx.fillStyle = '#312e81';
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = Math.max(1.5, R * 0.03);
          ctx.beginPath();
          ctx.roundRect(-ribW * 0.5, ribY - ribH * 0.5, ribW, ribH, R * 0.09);
          ctx.fill();
          ctx.stroke();

          const botFontSize = Math.max(7.5, Math.round(R * 0.125));
          ctx.font = `900 ${botFontSize}px "Fredoka", "Outfit", system-ui, sans-serif`;
          ctx.fillStyle = '#fde047';
          ctx.fillText('ALL SKINS FREE', 0, ribY + R * 0.01);
          ctx.restore();
        }
      }

      ctx.restore();
    };

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;
      const elapsed = now - startTime;

      if (elapsed >= totalDuration && !holdAtEnd) {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
        }
        return;
      }

      if (elapsed >= totalDuration && holdAtEnd && !reachedEndRef.current) {
        reachedEndRef.current = true;
        onReachedEndRef.current?.();
      }

      // Find active scene (clamped to final segment if holdAtEnd)
      let segIdx = scenes.length - 1;
      let segStart = totalDuration - scenes[scenes.length - 1].durationMs;
      if (elapsed < totalDuration) {
        segIdx = 0;
        segStart = 0;
        for (let i = 0; i < cumulativeEnd.length; i++) {
          if (elapsed < cumulativeEnd[i]) {
            segIdx = i;
            break;
          }
          segStart = cumulativeEnd[i];
        }
      }

      const seg = scenes[segIdx];
      if (enteredIdx !== segIdx) {
        enteredIdx = segIdx;
        seg.onEnter?.();
      }

      const rawSegElapsed = elapsed - segStart;
      const clampedSegElapsed = holdAtEnd && elapsed >= totalDuration ? seg.durationMs : rawSegElapsed;
      const t = Math.min(1, Math.max(0, clampedSegElapsed / seg.durationMs));
      const eT = easeInOut(t);

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Fullscreen 100% edge-to-edge viewport without black letterbox bars
      const barHeight = 0;
      const cy = vh * 0.52;
      const cx = vw * 0.5;
      const fov = Math.min(vw, vh) * 0.78;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, vw, vh);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, barHeight, vw, vh - barHeight * 2);
      ctx.clip();

      // Interpolate 3D camera (polar orbit or keyframed motion + gentle idle breath when held)
      const idleDrift = holdAtEnd && elapsed >= totalDuration ? Math.sin(now * 0.0011) * 0.14 : 0;
      const shakeMag = elapsed >= totalDuration ? 0 : lerp(seg.cameraStart.shake || 0, seg.cameraEnd.shake || 0, eT);
      const shakeX = shakeMag > 0 ? Math.sin(now * 0.055) * shakeMag : 0;
      const shakeY = shakeMag > 0 ? Math.cos(now * 0.071) * shakeMag * 0.7 : 0;

      let camX = lerp(seg.cameraStart.x, seg.cameraEnd.x, eT) + shakeX + idleDrift;
      let camY = lerp(seg.cameraStart.y, seg.cameraEnd.y, eT) + shakeY;
      let camZ = lerp(seg.cameraStart.z, seg.cameraEnd.z, eT);
      let camYaw = lerp(seg.cameraStart.yaw || 0, seg.cameraEnd.yaw || 0, eT);
      let camPitch = lerp(seg.cameraStart.pitch || 0, seg.cameraEnd.pitch || 0, eT);

      if (seg.cameraOrbit) {
        const orb = seg.cameraOrbit;
        const holdOrbitBias = holdAtEnd && elapsed >= totalDuration ? Math.sin(now * 0.0007) * 0.22 : 0;
        const angle = lerp(orb.startAngle, orb.endAngle, eT) + holdOrbitBias;
        const targetX = orb.centerX ?? 0;
        const targetZ = orb.centerZ;
        const targetY = orb.lookAtY ?? 0.6;
        camX = targetX + Math.sin(angle) * orb.radius + shakeX;
        camZ = targetZ - Math.cos(angle) * orb.radius;
        camY = lerp(orb.startY ?? seg.cameraStart.y, orb.endY ?? seg.cameraEnd.y, eT) + shakeY;
        camYaw = Math.atan2(targetX - camX, targetZ - camZ);
        const horizDist = Math.max(0.5, Math.hypot(targetX - camX, targetZ - camZ));
        camPitch = Math.atan2(targetY - camY, horizDist);
      }

      const horizonY = Math.max(barHeight + 20, Math.min(vh - 20, cy + camPitch * fov * 0.85));
      const skyGrad = ctx.createLinearGradient(0, barHeight, 0, horizonY);
      skyGrad.addColorStop(0, seg.skyTop);
      skyGrad.addColorStop(1, seg.skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, barHeight, vw, Math.max(1, horizonY - barHeight));

      if (seg.auroraColor) {
        ctx.save();
        ctx.globalAlpha = 0.38 + Math.sin(now * 0.0022) * 0.12;
        const aurGrad = ctx.createLinearGradient(0, barHeight, vw, horizonY);
        aurGrad.addColorStop(0, 'transparent');
        aurGrad.addColorStop(0.5, seg.auroraColor);
        aurGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = aurGrad;
        ctx.fillRect(0, barHeight + 10, vw, (horizonY - barHeight) * 0.72);
        ctx.restore();
      }

      // Unique backdrop overlays so cutscenes look completely distinct
      if (seg.backdropStyle === 'vortex') {
        ctx.save();
        const ringCount = 9;
        for (let i = 0; i < ringCount; i++) {
          const rp = ((i / ringCount) + now * 0.00045) % 1;
          const rr = Math.pow(rp, 1.7) * Math.max(vw, vh) * 0.75;
          ctx.globalAlpha = (1 - rp) * 0.38;
          ctx.strokeStyle = i % 2 === 0 ? seg.horizonGlow : seg.auroraColor || '#38bdf8';
          ctx.lineWidth = 2 + rp * 5;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, now * 0.002 + i, now * 0.002 + i + Math.PI * 1.45);
          ctx.stroke();
        }
        ctx.restore();
      } else if (seg.backdropStyle === 'starfield') {
        ctx.save();
        for (let i = 0; i < 65; i++) {
          const sx = ((i * 197.3 + now * 0.015 * ((i % 3) + 1)) % vw);
          const sy = ((i * 113.7 + now * 0.025) % vh);
          const sr = (i % 3) + 1;
          ctx.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(now * 0.003 + i));
          ctx.fillStyle = i % 4 === 0 ? '#fde047' : '#e0f2fe';
          ctx.fillRect(sx, sy, sr, sr);
        }
        ctx.restore();
      } else if (seg.backdropStyle === 'inferno' || seg.backdropStyle === 'blizzard') {
        ctx.save();
        const col = seg.backdropStyle === 'inferno' ? 'rgba(251,146,60,0.32)' : 'rgba(186,230,253,0.28)';
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        for (let i = 0; i < 24; i++) {
          const rx = ((i * 97 + now * (seg.backdropStyle === 'inferno' ? 0.08 : 0.25)) % (vw + 160)) - 80;
          const ry = ((i * 63 + now * (seg.backdropStyle === 'inferno' ? -0.18 : 0.14)) % vh + vh) % vh;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + (seg.backdropStyle === 'inferno' ? 12 : -45), ry + (seg.backdropStyle === 'inferno' ? -28 : 18));
          ctx.stroke();
        }
        ctx.restore();
      }

      const gndGrad = ctx.createLinearGradient(0, horizonY, 0, vh - barHeight);
      gndGrad.addColorStop(0, seg.groundFar);
      gndGrad.addColorStop(1, seg.groundNear);
      ctx.fillStyle = gndGrad;
      ctx.fillRect(0, horizonY - 2, vw, vh - barHeight - horizonY + 4);

      if (seg.spotlights) {
        ctx.save();
        for (let i = -1; i <= 1; i += 2) {
          const sweep = Math.sin(now * 0.002 + i) * vw * 0.18;
          ctx.fillStyle = 'rgba(253,224,71,0.09)';
          ctx.beginPath();
          ctx.moveTo(cx + i * vw * 0.35, vh);
          ctx.lineTo(cx + sweep - 55, 0);
          ctx.lineTo(cx + sweep + 55, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      if (seg.speedLines) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 26; i++) {
          const ang = (i / 26) * Math.PI * 2 + now * 0.0006;
          const r0 = Math.min(vw, vh) * 0.26;
          const r1 = Math.max(vw, vh) * 0.72;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
          ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.strokeStyle = 'rgba(186,230,253,0.09)';
      ctx.lineWidth = 1;
      for (let gz = Math.floor(camZ) + 1; gz <= Math.floor(camZ) + 46; gz += 2.5) {
        const pL = project(-36, 0, gz, camX, camY, camZ, camYaw, camPitch, cx, cy, fov);
        const pR = project(36, 0, gz, camX, camY, camZ, camYaw, camPitch, cx, cy, fov);
        if (pL && pR) {
          ctx.beginPath();
          ctx.moveTo(pL.sx, pL.sy);
          ctx.lineTo(pR.sx, pR.sy);
          ctx.stroke();
        }
      }

      const hGlow = ctx.createRadialGradient(cx, horizonY, 10, cx, horizonY, vw * 0.55);
      hGlow.addColorStop(0, seg.horizonGlow);
      hGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = hGlow;
      ctx.fillRect(0, barHeight, vw, vh - barHeight * 2);

      ctx.fillStyle = 'rgba(2,6,23,0.45)';
      ctx.beginPath();
      ctx.moveTo(0, horizonY + 4);
      for (let i = -8; i <= 8; i++) {
        const mx = cx + (i * 190 - camYaw * 480) - camX * 14;
        const mh = ((Math.abs(i * 37) % 5) + 2) * (vh * 0.032);
        ctx.lineTo(mx, horizonY - mh);
      }
      ctx.lineTo(vw, horizonY + 4);
      ctx.closePath();
      ctx.fill();

      if (seg.lightningFlash && elapsed < totalDuration && Math.sin(now * 0.017) > 0.92) {
        ctx.fillStyle = 'rgba(224,242,254,0.22)';
        ctx.fillRect(0, barHeight, vw, vh - barHeight * 2);
      }

      // Live animation clock continues smoothly even when holding at end (so 3D token & pets keep spinning!)
      const sec = clampedSegElapsed / 1000;
      const liveClock = elapsed / 1000;
      const drawQueue: { fz: number; run: () => void }[] = [];

      for (const ent of seg.entities) {
        const wx = ent.x + (ent.vx || 0) * sec;
        const bob = ent.bobAmp ? Math.sin(liveClock * (ent.bobSpeed || 3) + wx) * ent.bobAmp : 0;
        const wy = ent.y + (ent.vy || 0) * sec + bob;
        const wz = ent.z + (ent.vz || 0) * sec;

        const proj = project(wx, wy, wz, camX, camY, camZ, camYaw, camPitch, cx, cy, fov);
        if (!proj || proj.fz > 65) continue;

        const fogAlpha = Math.max(0, Math.min(1, 1 - (proj.fz - 36) / 28));
        const finalAlpha = (ent.alpha ?? 1) * fogAlpha;
        if (finalAlpha <= 0.02) continue;

        drawQueue.push({
          fz: proj.fz,
          run: () => {
            const s = proj.scale * ent.scale;
            if (ent.kind === 'pine') {
              drawPine3D(proj.sx, proj.sy, s, finalAlpha);
            } else if (ent.kind === 'fence') {
              drawFence3D(proj.sx, proj.sy, s, finalAlpha);
            } else if (ent.kind === 'crystal') {
              drawCrystal3D(proj.sx, proj.sy, s, finalAlpha, ent.tintColor || '#67e8f9');
            } else if (ent.kind === 'token3d') {
              drawToken3D(proj.sx, proj.sy, s, finalAlpha, liveClock * (ent.vr ?? 2.3));
            } else if (ent.kind === 'pillar') {
              ctx.save();
              ctx.globalAlpha = finalAlpha;
              const pw = s * 0.95;
              const ph = s * 4.5;
              const pg = ctx.createLinearGradient(proj.sx - pw * 0.5, 0, proj.sx + pw * 0.5, 0);
              pg.addColorStop(0, '#0f172a');
              pg.addColorStop(0.5, '#334155');
              pg.addColorStop(1, '#020617');
              ctx.fillStyle = pg;
              ctx.fillRect(proj.sx - pw * 0.5, proj.sy - ph, pw, ph);
              ctx.restore();
            } else if (ent.kind === 'eyes') {
              ctx.save();
              ctx.globalAlpha = finalAlpha * (0.75 + 0.25 * Math.sin(now * 0.01 + wx));
              const er = Math.max(2.5, s * 0.08);
              const gap = er * 3.4;
              ctx.fillStyle = 'rgba(244,63,94,0.32)';
              ctx.beginPath();
              ctx.arc(proj.sx - gap * 0.5, proj.sy - s * 1.1, er * 3.2, 0, Math.PI * 2);
              ctx.arc(proj.sx + gap * 0.5, proj.sy - s * 1.1, er * 3.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#fb7185';
              ctx.beginPath();
              ctx.ellipse(proj.sx - gap * 0.5, proj.sy - s * 1.1, er * 1.4, er * 0.85, 0, 0, Math.PI * 2);
              ctx.ellipse(proj.sx + gap * 0.5, proj.sy - s * 1.1, er * 1.4, er * 0.85, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            } else if (ent.kind === 'coin') {
              ctx.save();
              ctx.globalAlpha = finalAlpha;
              const r = Math.max(3, s * 0.28);
              ctx.fillStyle = '#fde047';
              ctx.beginPath();
              ctx.ellipse(proj.sx, proj.sy - r, r * (0.65 + 0.35 * Math.cos(liveClock * 5 + wx)), r, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            } else if (ent.kind === 'gem') {
              ctx.save();
              ctx.globalAlpha = finalAlpha;
              const r = Math.max(4, s * 0.34);
              ctx.fillStyle = '#67e8f9';
              ctx.beginPath();
              ctx.moveTo(proj.sx, proj.sy - r * 2.2);
              ctx.lineTo(proj.sx + r, proj.sy - r);
              ctx.lineTo(proj.sx, proj.sy);
              ctx.lineTo(proj.sx - r, proj.sy - r);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            } else if (ent.kind === 'sprite' && ent.frames && ent.frames.length > 0) {
              const fps = ent.fps || 8;
              const frameIdx = Math.floor(liveClock * fps) % ent.frames.length;
              const src = ent.frames[frameIdx];
              const img = imageCache.get(src);
              if (!img || !img.complete || img.naturalWidth === 0) return;

              const drawH = s * 1.85;
              const aspect = img.naturalWidth / img.naturalHeight;
              const drawW = drawH * aspect;

              ctx.save();
              ctx.globalAlpha = finalAlpha;
              const groundProj = project(wx, 0, wz, camX, camY, camZ, camYaw, camPitch, cx, cy, fov);
              if (groundProj && wy < 1.2) {
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.beginPath();
                ctx.ellipse(
                  groundProj.sx,
                  groundProj.sy,
                  drawW * 0.36,
                  Math.max(2, drawH * 0.085),
                  0,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
              }

              if (ent.glowColor) {
                const sg = ctx.createRadialGradient(proj.sx, proj.sy - drawH * 0.5, drawW * 0.1, proj.sx, proj.sy - drawH * 0.5, drawW * 0.85);
                sg.addColorStop(0, `${ent.glowColor.replace(/[\d.]+\)$/, '0.45)')}`);
                sg.addColorStop(1, 'transparent');
                ctx.fillStyle = sg;
                ctx.beginPath();
                ctx.arc(proj.sx, proj.sy - drawH * 0.5, drawW * 0.85, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.translate(proj.sx, proj.sy - drawH * 0.5);
              if (ent.rotation || ent.vr) {
                ctx.rotate((ent.rotation || 0) + (ent.vr || 0) * sec);
              }
              if (ent.flip) ctx.scale(-1, 1);
              ctx.drawImage(img, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
              ctx.restore();
            }
          },
        });
      }

      const snowCount = Math.min(85, seg.snowCount ?? 75);
      const snowVz = seg.snowVz ?? -4.5;
      for (let i = 0; i < snowCount; i++) {
        const pt = particles[i % particles.length];
        pt.x += pt.driftX * dt;
        pt.y += pt.driftY * dt;
        pt.z += snowVz * dt;
        if (pt.z < camZ + 0.3) pt.z = camZ + 32 + (i % 10);
        if (pt.z > camZ + 44) pt.z = camZ + 1.5;
        if (pt.y < 0.05) pt.y = 8.5 + (i % 4);
        if (pt.x < camX - 18) pt.x = camX + 18;
        if (pt.x > camX + 18) pt.x = camX - 18;

        const pProj = project(pt.x, pt.y, pt.z, camX, camY, camZ, camYaw, camPitch, cx, cy, fov);
        if (!pProj) continue;
        drawQueue.push({
          fz: pProj.fz,
          run: () => {
            const rad = Math.min(8, Math.max(1.2, (pt.size * pProj.scale) / 55));
            ctx.fillStyle = seg.snowColor || 'rgba(224,242,254,0.82)';
            ctx.beginPath();
            ctx.arc(pProj.sx, pProj.sy, rad, 0, Math.PI * 2);
            ctx.fill();
          },
        });
      }

      drawQueue.sort((a, b) => b.fz - a.fz);
      for (const item of drawQueue) item.run();

      if (seg.radialBurstAtMs !== undefined && clampedSegElapsed >= seg.radialBurstAtMs) {
        const bProg = Math.min(1, (clampedSegElapsed - seg.radialBurstAtMs) / 750);
        if (bProg < 1) {
          ctx.save();
          ctx.globalAlpha = (1 - bProg) * 0.85;
          ctx.strokeStyle = seg.radialBurstColor || '#67e8f9';
          ctx.lineWidth = Math.max(2, (1 - bProg) * 18);
          ctx.beginPath();
          ctx.arc(cx, cy, bProg * vw * 0.72, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const vig = ctx.createRadialGradient(cx, cy, vw * 0.18, cx, cy, vw * 0.68);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(0,0,0,0.68)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, barHeight, vw, vh - barHeight * 2);

      // Scene Fade-In & Fade-Out-to-Black transitions (NEVER fade out at the end when holdAtEnd is true!)
      const fadeInMs = seg.fadeInMs ?? 450;
      const isFinalHeld = holdAtEnd && segIdx === scenes.length - 1;
      const fadeOutMs = isFinalHeld ? 0 : (seg.fadeOutMs ?? 450);
      let fadeAlpha = 0;
      if (clampedSegElapsed < fadeInMs) {
        fadeAlpha = Math.max(fadeAlpha, 1 - clampedSegElapsed / fadeInMs);
      }
      if (fadeOutMs > 0 && seg.durationMs - clampedSegElapsed < fadeOutMs) {
        fadeAlpha = Math.max(fadeAlpha, 1 - (seg.durationMs - clampedSegElapsed) / fadeOutMs);
      }
      if (fadeAlpha > 0) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, Math.max(0, fadeAlpha))})`;
        ctx.fillRect(0, barHeight, vw, vh - barHeight * 2);
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [scenes, holdAtEnd]);

  return (
    <div className={`fixed inset-0 ${zIndexClass} bg-black overflow-hidden select-none pointer-events-auto`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
