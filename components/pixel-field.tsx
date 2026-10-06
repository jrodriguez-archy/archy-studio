'use client';

import { useEffect, useRef } from 'react';
import { ShaderMount } from '@paper-design/shaders';
import { archyPixelShader, fieldRange, TOKENS, TRAIL } from '@/lib/shaders/archy-pixel';

type Props = {
  /** Cell size in CSS px. */
  cell?: number;
  /** Radius of the blue cursor field, CSS px. */
  radius?: number;
  /** Seconds per blob orbit (the brand video loop is 8 s at speed 1). */
  loop?: number;
  /** Peak strength of the blue field (1 = solid royal blue at the centre). */
  intensity?: number;
  /** Shown when WebGL is not available. */
  fallback?: string;
};

// Archy Pixel Gradient (Pure White) live on the GPU, with a trail of Archy-blue pixels following the pointer.
export function PixelField({ cell = 2, radius = 120, loop = 48, intensity = 0.45, fallback = '/textures/pure-white-pixel-subtle.png' }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(pointer: fine)').matches;

    const empty = Array.from({ length: TRAIL }, () => [-9999, -9999, 0]);
    let mount: ShaderMount;
    try {
      mount = new ShaderMount(el, archyPixelShader, {
        u_cell: cell, u_loop: loop, u_range: fieldRange(el.clientWidth || 1440, el.clientHeight || 900),
        // Ground: white to neutral-lightest, spread wide (gamma 1.6, floor 0.3 so no area is flat white), 8 steps, Bayer + 55% noise: an even fine grain.
        u_gamma: 1.6, u_steps: 8, u_noise: 0.55, u_floor: 0.3, u_base: TOKENS.white, u_front: TOKENS.neutralLightest,
        u_trail: empty, u_radius: radius, u_glow: 0,
        u_b1: TOKENS.blueTint200, u_b2: TOKENS.blueTint300, u_b3: TOKENS.skyBlue400, u_b4: TOKENS.royalBlue500,
      }, undefined, still ? 0 : 1, 0, 1);
    } catch {
      el.style.background = `#fff url(${fallback}) center / auto no-repeat`;
      return;
    }
    // ShaderMount logs (does not throw) when the program fails to link: fall back to the static texture.
    const gl = mount.canvasElement.getContext('webgl2');
    if (!gl || !gl.getParameter(gl.CURRENT_PROGRAM)) {
      mount.dispose();
      el.style.background = `#fff url(${fallback}) center / auto no-repeat`;
      return;
    }
    mount.canvasElement.style.imageRendering = 'pixelated';

    const onResize = () => mount.setUniforms({ u_range: fieldRange(el.clientWidth, el.clientHeight) });
    addEventListener('resize', onResize);
    if (still || !fine) return () => { removeEventListener('resize', onResize); mount.dispose(); };

    // Pointer: eased head + a trail of past positions that fade out.
    const target = { x: -9999, y: -9999 };
    const head = { x: -9999, y: -9999 };
    const trail: { x: number; y: number; at: number }[] = [];
    let glow = 0, lastMove = 0, inside = false, raf = 0, lastPush = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
      if (head.x < -999) { head.x = target.x; head.y = target.y; }
      lastMove = performance.now();
      inside = true;
    };
    const onLeave = () => { inside = false; };
    addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);

    const tick = (now: number) => {
      // Lags behind the pointer (slower follow), so the blue trails with a little offset.
      head.x += (target.x - head.x) * 0.06;
      head.y += (target.y - head.y) * 0.06;
      // Only while the pointer moves: it lights up, then dissolves away (~0.6 s) once it stops.
      const active = inside && now - lastMove < 160;
      glow += ((active ? intensity : 0) - glow) * (active ? 0.08 : 0.035);
      if (now - lastPush > 28 && head.x > -999) {
        trail.unshift({ x: head.x, y: head.y, at: now });
        trail.length = Math.min(trail.length, TRAIL);
        lastPush = now;
      }
      const pts = Array.from({ length: TRAIL }, (_, i) => {
        const p = trail[i];
        if (!p) return [-9999, -9999, 0];
        const w = i === 0 ? 1 : Math.exp(-(now - p.at) / 380);
        return [p.x, p.y, w];
      });
      pts[0] = [head.x, head.y, 1];
      mount.setUniforms({ u_trail: pts, u_glow: glow });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      mount.dispose();
    };
  }, [cell, radius, loop, intensity, fallback]);

  return <div ref={host} aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-white" />;
}
