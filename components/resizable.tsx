'use client';

import { useLayoutEffect, useRef, useState } from 'react';

// Side panels (the sidebar, Canvas's panels, the detail panel) can be made a little wider or narrower by
// dragging their inner edge (double-click puts them back). The width is remembered in this browser; the
// page works the same without storage. While dragging, only the element changes (nothing re-renders, no
// transition); the width is kept when the drag ends.
// `prop` is what the element's width is written to (a CSS variable for a grid or a breakpoint). With
// `cookie`, the width is kept in a cookie instead, so the server draws it on the first paint (`saved`).
export function useSideWidth(key: string, initial: number, min: number, max: number, opts: { prop?: string; cookie?: boolean; saved?: number } = {}) {
  const { prop = 'width', cookie = false } = opts;
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)));
  const [width, setWidth] = useState(opts.saved ? clamp(opts.saved) : initial);
  const ref = useRef<HTMLElement | null>(null);
  // Before the first paint, so the panel does not jump.
  useLayoutEffect(() => {
    if (cookie) return;
    try { const v = Number(localStorage.getItem(key)); if (v) setWidth(clamp(v)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (w: number, keep: boolean) => {
    const c = clamp(w);
    const el = ref.current;
    if (!keep) { if (el) { el.style.transition = 'none'; el.style.setProperty(prop, `${c}px`); } return; }
    if (el) el.style.removeProperty('transition');
    setWidth(c);
    if (cookie) document.cookie = `${key}=${c}; path=/; max-age=31536000; samesite=lax`;
    else try { localStorage.setItem(key, String(c)); } catch {}
  };
  return { width, ref, set, reset: () => set(initial, true) };
}

// The edge to drag: a thin line that shows in a soft blue grey on hover and while dragging. `inside` keeps it within
// the panel (for a panel that clips what sticks out, like the sidebar).
export function ResizeHandle({ side, width, onWidth, onReset, inside = false }: { side: 'left' | 'right'; width: number; onWidth: (w: number, keep: boolean) => void; onReset: () => void; inside?: boolean }) {
  const start = useRef<{ x: number; w: number; last: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  // The panel on the left grows to the right; the one on the right grows to the left.
  const next = (x: number) => start.current!.w + (side === 'left' ? x - start.current!.x : start.current!.x - x);
  // However the drag ends (released, cancelled, focus lost), it ends once and keeps the last width.
  const end = () => {
    if (!start.current) return;
    onWidth(start.current.last, true);
    start.current = null;
    setDragging(false);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize the panel"
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => { e.preventDefault(); start.current = { x: e.clientX, w: width, last: width }; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        if (!start.current) return;
        if (e.buttons === 0) { end(); return; }
        start.current.last = next(e.clientX);
        onWidth(start.current.last, false);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={onReset}
      className={`group absolute top-0 bottom-0 z-20 w-2 cursor-col-resize ${inside ? (side === 'left' ? 'right-0' : 'left-0') : side === 'left' ? '-right-1' : '-left-1'}`}
    >
      <span className={`absolute inset-y-0 w-px ${inside ? (side === 'left' ? 'right-0' : 'left-0') : 'left-1/2 -translate-x-1/2'} transition-colors ${dragging ? 'bg-[#B4C0D3]' : 'bg-transparent group-hover:bg-[#CDD5E1]'}`} />
    </div>
  );
}
