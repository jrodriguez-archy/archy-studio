'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// The canvas viewport, like design tools: the wheel or two fingers pan, pinch or ⌘/Ctrl + wheel zoom
// towards the pointer, space (or the hand tool) + drag pans, ⌘+ / ⌘− / ⌘0 (fit) / ⌘1 (100%).
export function useViewport(width: number, height: number) {
  const area = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fitted, setFitted] = useState(true);
  const [space, setSpace] = useState(false);
  const [hand, setHand] = useState(false);
  const view = useRef({ zoom, pan });
  view.current = { zoom, pan };
  const dragging = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const fit = useCallback(() => {
    const el = area.current;
    if (!el) return;
    const { width: W, height: H } = el.getBoundingClientRect();
    const z = Math.max(0.05, Math.min((W - 96) / width, (H - 120) / height, 1));
    setZoom(z);
    setPan({ x: (W - width * z) / 2, y: (H - height * z) / 2 - 12 });
    setFitted(true);
  }, [width, height]);

  // Zoom keeping the point under `at` (area px) in place; the centre when not given.
  const zoomTo = useCallback((z: number, at?: { x: number; y: number }) => {
    const el = area.current;
    if (!el) return;
    const { width: W, height: H } = el.getBoundingClientRect();
    const p = at ?? { x: W / 2, y: H / 2 };
    const { zoom: z0, pan: p0 } = view.current;
    const z1 = Math.min(8, Math.max(0.05, z));
    setZoom(z1);
    setPan({ x: p.x - ((p.x - p0.x) * z1) / z0, y: p.y - ((p.y - p0.y) * z1) / z0 });
    setFitted(false);
  }, []);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (fitted) fit(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, fitted]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch arrives as ctrl + wheel.
        zoomTo(view.current.zoom * Math.exp(-e.deltaY * (e.ctrlKey && !e.metaKey ? 0.01 : 0.004)), { x: e.clientX - r.left, y: e.clientY - r.top });
      } else {
        setPan((p) => ({ x: p.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX), y: p.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) }));
        setFitted(false);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  useEffect(() => {
    const typing = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('input, textarea, [contenteditable]');
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); setSpace(true); }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomTo(view.current.zoom * 1.25); }
      else if (e.key === '-') { e.preventDefault(); zoomTo(view.current.zoom / 1.25); }
      else if (e.key === '0') { e.preventDefault(); fit(); }
      else if (e.key === '1') { e.preventDefault(); zoomTo(1); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [fit, zoomTo]);

  const panning = space || hand;
  // Pointer handlers for the area: drag to pan with the hand (or the middle button).
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!(panning || e.button === 1)) return;
      e.preventDefault();
      dragging.current = { x: e.clientX, y: e.clientY, px: view.current.pan.x, py: view.current.pan.y };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = dragging.current;
      if (!d) return;
      setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
      setFitted(false);
    },
    onPointerUp: () => { dragging.current = null; },
  };

  return { area, zoom, pan, fit, zoomTo, panning, hand, setHand, handlers, grabbing: !!dragging.current };
}
