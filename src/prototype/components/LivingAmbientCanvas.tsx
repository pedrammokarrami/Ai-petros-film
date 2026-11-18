import React, { useEffect, useRef } from 'react';
import { djAudioController } from '../djAudioEngine';

export type AmbientThemeId =
  | 'universe'
  | 'cafe'
  | 'concert'
  | 'party'
  | 'audiobook'
  | 'podcast'
  | 'discover'
  | 'search'
  | 'library'
  | 'settings';

interface ThemePalette {
  primary: string;
  secondary: string;
  tertiary: string;
  particleRgb: string;
}

const THEME_PALETTES: Record<AmbientThemeId, ThemePalette> = {
  universe: {
    primary: 'rgba(245, 185, 66, 0.22)',
    secondary: 'rgba(0, 240, 255, 0.12)',
    tertiary: 'rgba(139, 92, 246, 0.14)',
    particleRgb: '245, 185, 66'
  },
  cafe: {
    primary: 'rgba(245, 185, 66, 0.28)',
    secondary: 'rgba(251, 146, 60, 0.16)',
    tertiary: 'rgba(180, 120, 48, 0.14)',
    particleRgb: '245, 185, 66'
  },
  concert: {
    primary: 'rgba(217, 70, 239, 0.26)',
    secondary: 'rgba(168, 85, 247, 0.18)',
    tertiary: 'rgba(56, 189, 248, 0.14)',
    particleRgb: '232, 121, 249'
  },
  party: {
    primary: 'rgba(0, 240, 255, 0.26)',
    secondary: 'rgba(255, 42, 133, 0.18)',
    tertiary: 'rgba(59, 130, 246, 0.16)',
    particleRgb: '0, 240, 255'
  },
  audiobook: {
    primary: 'rgba(234, 179, 8, 0.22)',
    secondary: 'rgba(217, 119, 6, 0.15)',
    tertiary: 'rgba(94, 65, 30, 0.18)',
    particleRgb: '251, 191, 36'
  },
  podcast: {
    primary: 'rgba(139, 92, 246, 0.24)',
    secondary: 'rgba(56, 189, 248, 0.18)',
    tertiary: 'rgba(245, 185, 66, 0.1)',
    particleRgb: '167, 139, 250'
  },
  discover: {
    primary: 'rgba(245, 185, 66, 0.24)',
    secondary: 'rgba(249, 115, 22, 0.14)',
    tertiary: 'rgba(56, 189, 248, 0.12)',
    particleRgb: '245, 185, 66'
  },
  search: {
    primary: 'rgba(56, 189, 248, 0.2)',
    secondary: 'rgba(168, 85, 247, 0.16)',
    tertiary: 'rgba(245, 185, 66, 0.14)',
    particleRgb: '56, 189, 248'
  },
  library: {
    primary: 'rgba(217, 119, 6, 0.2)',
    secondary: 'rgba(168, 85, 247, 0.14)',
    tertiary: 'rgba(16, 185, 129, 0.12)',
    particleRgb: '245, 185, 66'
  },
  settings: {
    primary: 'rgba(148, 163, 184, 0.16)',
    secondary: 'rgba(245, 185, 66, 0.14)',
    tertiary: 'rgba(56, 189, 248, 0.1)',
    particleRgb: '226, 232, 240'
  }
};

interface ParticleNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
}

interface RippleWave {
  x: number;
  y: number;
  age: number;
}

interface LivingAmbientCanvasProps {
  themeId: AmbientThemeId;
  reducedMotion?: boolean;
}

export function LivingAmbientCanvas({
  themeId,
  reducedMotion = false
}: LivingAmbientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const palette = THEME_PALETTES[themeId] || THEME_PALETTES.universe;
  const paletteRef = useRef(palette);
  paletteRef.current = palette;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const count = width < 640 ? 28 : 48;
    const particles: ParticleNode[] = Array.from({ length: count }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.24,
      vy: -0.08 - Math.random() * 0.22,
      radius: 1.1 + (idx % 3) * 0.85,
      alpha: 0.18 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2
    }));

    const ripples: RippleWave[] = [];
    const pointer = { x: -9999, y: -9999, active: false };

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      if (!reducedMotion) {
        ripples.push({ x: e.clientX, y: e.clientY, age: 0 });
        if (ripples.length > 4) ripples.shift();
      }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });

    let rafId = 0;
    let lastDraw = 0;

    const renderFrame = (now: number) => {
      rafId = requestAnimationFrame(renderFrame);
      if (document.hidden) return;
      if (now - lastDraw < 30) return; // ~33fps keeps battery cool alongside WebGL rooms
      lastDraw = now;

      ctx.clearRect(0, 0, width, height);

      // Sample live audio bass spectrum cleanly without breaking if silent
      const spectrum = djAudioController.getDeckSpectrum('A');
      let bassEnergy = 0;
      if (spectrum && spectrum.length > 4) {
        const sum = spectrum[0] + spectrum[1] + spectrum[2] + spectrum[3];
        bassEnergy = sum / (4 * 255);
      }

      const rgb = paletteRef.current.particleRgb;
      const tSec = now * 0.001;

      // Touch-responsive volumetric wave ripples
      for (let r = ripples.length - 1; r >= 0; r--) {
        const rip = ripples[r];
        rip.age += 0.025;
        if (rip.age >= 1) {
          ripples.splice(r, 1);
          continue;
        }
        const radius = 14 + rip.age * 165;
        const opacity = (1 - rip.age) * 0.24;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb}, ${opacity.toFixed(3)})`;
        ctx.lineWidth = 1.4 * (1 - rip.age * 0.5);
        ctx.stroke();
      }

      // Floating luminous light particles reactive to music & touch
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!reducedMotion) {
          p.x += p.vx * (1 + bassEnergy * 1.4);
          p.y += p.vy * (1 + bassEnergy * 1.6);

          // Soft magnetic repulsion near active touch/cursor
          if (pointer.active) {
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > 1 && distSq < 18000) {
              const force = (1 - distSq / 18000) * 0.45;
              p.x += (dx / Math.sqrt(distSq)) * force;
              p.y += (dy / Math.sqrt(distSq)) * force;
            }
          }

          if (p.y < -16) p.y = height + 16;
          if (p.x < -16) p.x = width + 16;
          if (p.x > width + 16) p.x = -16;
        }

        const pulse = 0.72 + 0.28 * Math.sin(tSec * 1.6 + p.phase) + bassEnergy * 0.55;
        const rSize = p.radius * (0.9 + bassEnergy * 0.65);
        const alpha = Math.min(0.85, p.alpha * pulse);

        ctx.beginPath();
        ctx.arc(p.x, p.y, rSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }
    };

    if (reducedMotion) {
      renderFrame(performance.now());
      cancelAnimationFrame(rafId);
    } else {
      rafId = requestAnimationFrame(renderFrame);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#05060B]"
    >
      {/* Volumetric Ambient Light Clouds (Fluid Theme Transitions) */}
      <div
        className={`absolute -top-[18%] -start-[12%] h-[58vw] w-[58vw] min-h-[340px] min-w-[340px] max-h-[720px] max-w-[720px] rounded-full blur-[110px] transition-colors duration-1000 ${
          reducedMotion ? '' : 'ambient-orb-drift'
        }`}
        style={{ backgroundColor: palette.primary }}
      />
      <div
        className={`absolute top-[28%] -end-[15%] h-[52vw] w-[52vw] min-h-[300px] min-w-[300px] max-h-[640px] max-w-[640px] rounded-full blur-[120px] transition-colors duration-1000 ${
          reducedMotion ? '' : 'ambient-orb-drift'
        }`}
        style={{ backgroundColor: palette.secondary, animationDelay: '-6s' }}
      />
      <div
        className="absolute -bottom-[20%] start-[22%] h-[48vw] w-[48vw] min-h-[280px] min-w-[280px] max-h-[600px] max-w-[600px] rounded-full blur-[125px] transition-colors duration-1000"
        style={{ backgroundColor: palette.tertiary }}
      />

      {/* Interactive Volumetric Light Particles & Touch Ripples */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-85" />

      {/* Ultra-subtle atmospheric vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,transparent_25%,rgba(4,5,10,0.68)_100%)]" />
    </div>
  );
}
