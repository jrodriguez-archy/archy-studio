'use client';

import { useEffect, useRef } from 'react';
import { ShaderMount } from '@paper-design/shaders';
import { archyPixelShader, fieldRange, RIPPLES, TOKENS, TRAIL } from '@/lib/shaders/archy-pixel';

type Props = {
  /** Cell size in CSS px. */
  cell?: number;
  /** Radius of the blue cursor field, CSS px. */
  radius?: number;
  /** Seconds per blob orbit (the brand video loop is 8 s at speed 1). */
  loop?: number;
  /** Peak strength of the blue field (1 = solid royal blue at the centre). */
  intensity?: number;
  /** How long a trail point lives, ms. */
  life?: number;
  /** Shown when WebGL is not available. */
  fallback?: string;
};

const SPACING = 10; // px between trail points when slow; grows with speed (up to 60) so fast moves keep a long ribbon
const STIFFNESS = 80;
const RIPPLE_MS = 1200; // a click wave's duration
const RIPPLE_SIZE = 200; // px it grows // spring that pulls the head toward the pointer (critically damped)

// Archy Pixel Gradient (Pure White) live on the GPU, with a trail of Archy-blue pixels following the pointer.
export function PixelField({ cell = 2, radius = 110, loop = 48, intensity = 0.75, life = 2600, fallback = '/textures/pure-white-pixel-subtle.png' }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(pointer: fine)').matches;

    const empty = Array.from({ length: TRAIL }, () => [-9999, -9999, 0, 0]);
    let mount: ShaderMount;
    try {
      mount = new ShaderMount(el, archyPixelShader, {
        u_cell: cell, u_loop: loop, u_range: fieldRange(el.clientWidth || 1440, el.clientHeight || 900),
        // Ground: white to neutral-lightest, spread wide (gamma 1.6, floor 0.3 so no area is flat white), 8 steps, Bayer + 55% noise: an even fine grain.
        u_gamma: 1.6, u_steps: 8, u_noise: 0.55, u_floor: 0.3, u_base: TOKENS.white, u_front: TOKENS.neutralLightest,
        u_trail: empty, u_radius: radius, u_intensity: intensity, u_spread: 0.35, u_wobble: 0.18,
        u_ripples: Array.from({ length: RIPPLES }, () => [0, 0, 0, 0]), u_rippleSize: RIPPLE_SIZE,
        u_t1: TOKENS.blueTint100, u_t2: TOKENS.blueTint200, u_t3: TOKENS.blueTint300,
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

    // Pointer: a spring-eased head that drops points along its path; each point fades on its own,
    // so the blue dissolves from the tail when the pointer stops instead of switching off.
    const target = { x: -9999, y: -9999 };
    const head = { x: -9999, y: -9999, vx: 0, vy: 0 };
    const points: { x: number; y: number; born: number; strength: number }[] = [];
    const anchor = { x: -9999, y: -9999 }; // where the last point was dropped
    let lastMove = 0, inside = false, raf = 0, prev = performance.now(), speed = 0, halo = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
      if (head.x < -999) { head.x = target.x; head.y = target.y; }
      lastMove = performance.now();
      inside = true;
    };
    const onLeave = () => { inside = false; };
    const ripples: { x: number; y: number; at: number }[] = [];
    const onDown = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ripples.unshift({ x: e.clientX - r.left, y: e.clientY - r.top, at: performance.now() });
      ripples.length = Math.min(ripples.length, RIPPLES);
    };
    addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove);
    document.addEventListener('pointerleave', onLeave);

    const tick = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      if (head.x > -999) {
        // Critically damped spring: smooth inertia at any refresh rate.
        const damp = 2 * Math.sqrt(STIFFNESS);
        head.vx += (STIFFNESS * (target.x - head.x) - damp * head.vx) * dt;
        head.vy += (STIFFNESS * (target.y - head.y) - damp * head.vy) * dt;
        head.x += head.vx * dt;
        head.y += head.vy * dt;
        speed += (Math.hypot(head.vx, head.vy) - speed) * Math.min(1, dt * 8);

        const moving = inside && now - lastMove < 120;
        // Halo at the head: rises quickly while moving, lingers and fades over ~1.5 s when still.
        halo += ((moving ? 1 : 0) - halo) * (1 - Math.exp(-dt / (moving ? 0.12 : 0.8)));

        // Drop points every SPACING px along the path (several on a fast frame), stronger when faster.
        if (inside) {
          if (anchor.x < -999) { anchor.x = head.x; anchor.y = head.y; }
          let d = Math.hypot(head.x - anchor.x, head.y - anchor.y);
          const strength = Math.min(1, 0.6 + speed / 1500);
          const step = Math.min(60, Math.max(SPACING, speed * 0.06));
          // Weight by spacing so a slow, dense trail is as light as a fast, sparse one.
          const w = strength * Math.min(1, step / (radius * 0.4));
          while (d >= step) {
            const k = step / d;
            anchor.x += (head.x - anchor.x) * k;
            anchor.y += (head.y - anchor.y) * k;
            points.unshift({ x: anchor.x, y: anchor.y, born: now, strength: w });
            d -= step;
          }
          points.length = Math.min(points.length, TRAIL - 1);
        }
      }
      while (points.length && now - points[points.length - 1].born > life) points.pop();

      const pts = Array.from({ length: TRAIL }, () => [-9999, -9999, 0, 0]);
      pts[0] = [head.x, head.y, halo * 0.8, 0];
      points.forEach((p, i) => {
        const age = Math.min(1, (now - p.born) / life);
        // Ease out: holds most of its strength at first, then dissolves (no sudden drop).
        pts[i + 1] = [p.x, p.y, p.strength * (1 - age * age) * (1 - age), age];
      });
      while (ripples.length && now - ripples[ripples.length - 1].at > RIPPLE_MS) ripples.pop();
      const waves = Array.from({ length: RIPPLES }, (_, i) => {
        const w = ripples[i];
        return w ? [w.x, w.y, Math.min(1, (now - w.at) / RIPPLE_MS), 1] : [0, 0, 0, 0];
      });
      mount.setUniforms({ u_trail: pts, u_ripples: waves });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerleave', onLeave);
      mount.dispose();
    };
  }, [cell, radius, loop, intensity, life, fallback]);

  return <div ref={host} aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-white" />;
}
