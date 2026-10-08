'use client';

import { useLayoutEffect, useRef, useState } from 'react';

// Canvas side panels can be made a little wider or narrower by dragging their inner edge (double-click
// puts them back). The width is remembered in this browser; the page works the same without storage.
// While dragging, only the panel's own element changes width (nothing re-renders); the width is kept
// when the drag ends.
export function useSideWidth(key: string, initial: number, min: number, max: number) {
  const [width, setWidth] = useState(initial);
  const ref = useRef<HTMLElement | null>(null);
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)));
  // Before the first paint, so the panel does not jump.
  useLayoutEffect(() => {
    try { const v = Number(localStorage.getItem(key)); if (v) setWidth(clamp(v)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (w: number, keep: boolean) => {
    const c = clamp(w);
    if (!keep) { if (ref.current) ref.current.style.width = `${c}px`; return; }
    setWidth(c);
    try { localStorage.setItem(key, String(c)); } catch {}
  };
  return { width, ref, set, reset: () => set(initial, true) };
}

// The edge to drag: a thin line that turns Archy blue on hover and while dragging.
export function ResizeHandle({ side, width, onWidth, onReset }: { side: 'left' | 'right'; width: number; onWidth: (w: number, keep: boolean) => void; onReset: () => void }) {
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
      className={`group absolute top-0 bottom-0 z-20 w-2 cursor-col-resize ${side === 'left' ? '-right-1' : '-left-1'}`}
    >
      <span className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${dragging ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/60'}`} />
    </div>
  );
}
