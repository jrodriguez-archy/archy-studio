'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

/** Sent when the canvas takes a touch over (a second finger, a pinch): a Stage drops what it had started. */
export const GESTURE_EVENT = 'canvas:gesture';

type Pt = { x: number; y: number };

// The canvas viewport, like design tools: the wheel or two fingers pan, pinch or ⌘/Ctrl + wheel zoom
// towards the pointer, space (or the hand tool) + drag pans, ⌘+ / ⌘− / ⌘0 (fit) / ⌘1 (100%). On touch,
// one finger on the empty canvas pans, two fingers pan and pinch anywhere.
//
// Pan and zoom live in refs and are written straight to the layer's transform: a wheel tick or a finger
// never re-renders the editor. The boards are laid out at `zoom` (React state); while a zoom is under way
// the layer is scaled by CSS, and `zoom` catches up once it settles (one render per gesture).
export function useViewport(width: number, height: number, { onTap }: { onTap?: () => void } = {}) {
  const area = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const committed = useRef(0.5);
  committed.current = zoom;
  const view = useRef<{ zoom: number; pan: Pt }>({ zoom: 0.5, pan: { x: 0, y: 0 } });
  const fitted = useRef(true);
  const [space, setSpace] = useState(false);
  const [hand, setHand] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const dragging = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const listeners = useRef(new Set<() => void>());
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  const paint = useCallback(() => {
    const l = layer.current;
    const { zoom: z, pan } = view.current;
    const k = z / committed.current;
    if (l) l.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0)${Math.abs(k - 1) > 1e-4 ? ` scale(${k})` : ''}`;
  }, []);
  // The boards drawn at the new zoom: the layer drops its CSS scale in the same frame.
  useLayoutEffect(paint, [zoom, paint]);

  const settle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    setZoom(view.current.zoom);
  }, []);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  // `when`: 'now' lays the boards out at once (a button, a key, fit); 'later' after the gesture rests.
  const set = useCallback((z: number, pan: Pt, when: 'now' | 'later') => {
    const zoomed = z !== view.current.zoom;
    view.current = { zoom: z, pan };
    paint();
    if (zoomed) listeners.current.forEach((f) => f());
    if (when === 'now') settle();
    else if (zoomed) {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(settle, 160);
    }
  }, [paint, settle]);
  const panBy = useCallback((dx: number, dy: number) => {
    const { zoom: z, pan } = view.current;
    fitted.current = false;
    set(z, { x: pan.x + dx, y: pan.y + dy }, 'later');
  }, [set]);

  // Frame a part of the content (an artboard), or all of it.
  const frame = useCallback((b: { x: number; y: number; w: number; h: number }, keep = true) => {
    const el = area.current;
    if (!el) return;
    const { width: W, height: H } = el.getBoundingClientRect();
    const z = Math.max(0.05, Math.min((W - 96) / b.w, (H - 140) / b.h, 1));
    fitted.current = keep;
    set(z, { x: (W - b.w * z) / 2 - b.x * z, y: (H - b.h * z) / 2 - b.y * z + 4 }, 'now');
  }, [set]);
  const fit = useCallback(() => frame({ x: 0, y: 0, w: width, h: height }), [frame, width, height]);

  // Zoom keeping the point under `at` (area px) in place; the centre when not given.
  const zoomTo = useCallback((z: number, at?: Pt, when: 'now' | 'later' = 'now') => {
    const el = area.current;
    if (!el) return;
    const { width: W, height: H } = el.getBoundingClientRect();
    const p = at ?? { x: W / 2, y: H / 2 };
    const { zoom: z0, pan: p0 } = view.current;
    const z1 = Math.min(8, Math.max(0.05, z));
    fitted.current = false;
    set(z1, { x: p.x - ((p.x - p0.x) * z1) / z0, y: p.y - ((p.y - p0.y) * z1) / z0 }, when);
  }, [set]);
  const zoomBy = useCallback((k: number) => zoomTo(view.current.zoom * k), [zoomTo]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (fitted.current) fit(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch arrives as ctrl + wheel.
        zoomTo(view.current.zoom * Math.exp(-e.deltaY * (e.ctrlKey && !e.metaKey ? 0.01 : 0.004)), { x: e.clientX - r.left, y: e.clientY - r.top }, 'later');
      } else {
        panBy(-(e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX), -(e.shiftKey && !e.deltaX ? 0 : e.deltaY));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo, panBy]);

  // Touch: one finger on the empty canvas pans (a tap clears the selection), two fingers pan and pinch
  // anywhere, over the design too (what the first finger started there is dropped).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const touches = new Map<number, Pt>();
    let pinch: { d0: number; c0: Pt; z0: number; p0: Pt } | null = null;
    let one: { id: number; x: number; y: number; px: number; py: number; moved: boolean } | null = null;
    let pinched = false; // fingers stay down after a pinch: nothing more until all are lifted
    const local = (p: Pt): Pt => { const r = el.getBoundingClientRect(); return { x: p.x - r.left, y: p.y - r.top }; };
    const pair = () => {
      const [a, b] = [...touches.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, c: local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) };
    };
    const startPinch = () => {
      const { d, c } = pair();
      pinch = { d0: d, c0: c, z0: view.current.zoom, p0: { ...view.current.pan } };
      one = null;
      pinched = true;
      window.dispatchEvent(new CustomEvent(GESTURE_EVENT));
    };
    const empty = (t: EventTarget | null) => !(t as Element)?.closest?.('[data-stage], [data-toolbar], [data-board-label], [data-panel], button, a, input');
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { startPinch(); e.stopPropagation(); e.preventDefault(); return; }
      if (touches.size > 2) { e.stopPropagation(); return; }
      if (empty(e.target)) {
        one = { id: e.pointerId, x: e.clientX, y: e.clientY, px: view.current.pan.x, py: view.current.pan.y, moved: false };
        e.preventDefault();
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size >= 2) {
        e.stopPropagation();
        const { d, c } = pair(), { d0, c0, z0, p0 } = pinch;
        const z = Math.min(8, Math.max(0.05, z0 * (d / d0)));
        // The design point under the fingers' first centre follows the centre as it moves.
        fitted.current = false;
        set(z, { x: c.x - ((c0.x - p0.x) * z) / z0, y: c.y - ((c0.y - p0.y) * z) / z0 }, 'later');
        return;
      }
      if (pinched) { e.stopPropagation(); return; }
      if (one?.id === e.pointerId) {
        const dx = e.clientX - one.x, dy = e.clientY - one.y;
        if (!one.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        one.moved = true;
        fitted.current = false;
        set(view.current.zoom, { x: one.px + dx, y: one.py + dy }, 'later');
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !touches.delete(e.pointerId)) return;
      if (pinch && touches.size < 2) { pinch = null; settle(); }
      if (pinched) e.stopPropagation();
      if (one?.id === e.pointerId) { if (!one.moved && e.type === 'pointerup') tapRef.current?.(); one = null; }
      if (!touches.size) pinched = false;
    };
    // Safari's own page pinch.
    const gesture = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move, true);
    el.addEventListener('pointerup', up, true);
    el.addEventListener('pointercancel', up, true);
    el.addEventListener('gesturestart', gesture);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      el.removeEventListener('pointermove', move, true);
      el.removeEventListener('pointerup', up, true);
      el.removeEventListener('pointercancel', up, true);
      el.removeEventListener('gesturestart', gesture);
    };
  }, [set, settle]);

  useEffect(() => {
    const typing = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('input, textarea, [contenteditable]');
    // Space on a focused button presses it (not the hand).
    const pressable = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('button, [role=button], [role=menuitem], [role=radio], select, a');
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.code === 'Space' && !e.repeat && !pressable(e.target)) { e.preventDefault(); setSpace(true); }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomBy(1.25); }
      else if (e.key === '-') { e.preventDefault(); zoomBy(1 / 1.25); }
      else if (e.key === '0') { e.preventDefault(); fit(); }
      else if (e.key === '1') { e.preventDefault(); zoomTo(1); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false); };
    // Space let go in another window (⌘-Tab while holding it): the hand does not stay on.
    const away = () => { setSpace(false); dragging.current = null; setGrabbing(false); };
    const hidden = () => { if (document.visibilityState === 'hidden') away(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', away);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', away); document.removeEventListener('visibilitychange', hidden); };
  }, [fit, zoomTo, zoomBy]);

  const panning = space || hand;
  // Pointer handlers for the area: drag to pan with the hand (or the middle button).
  const handlers = useMemo(() => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (!(panning || e.button === 1) || e.pointerType === 'touch') return;
      e.preventDefault();
      dragging.current = { x: e.clientX, y: e.clientY, px: view.current.pan.x, py: view.current.pan.y };
      setGrabbing(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = dragging.current;
      if (!d) return;
      fitted.current = false;
      set(view.current.zoom, { x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }, 'later');
    },
    onPointerUp: () => { dragging.current = null; setGrabbing(false); },
    onPointerCancel: () => { dragging.current = null; setGrabbing(false); },
  }), [panning, set]);

  // The zoom as it moves (for a label), without re-rendering whoever holds the viewport.
  const subscribe = useCallback((f: () => void) => { listeners.current.add(f); return () => { listeners.current.delete(f); }; }, []);
  const liveZoom = useCallback(() => view.current.zoom, []);

  return { area, layer, zoom, fit, frame, zoomTo, zoomBy, panning, hand, setHand, handlers, grabbing, subscribe, liveZoom };
}

export type Viewport = ReturnType<typeof useViewport>;

/** The zoom as it moves, for a label: only the component using it re-renders. */
export function useLiveZoom(vp: Pick<Viewport, 'subscribe' | 'liveZoom'>) {
  return useSyncExternalStore(vp.subscribe, vp.liveZoom, () => 0.5);
}
