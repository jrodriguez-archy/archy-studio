// Smart guides: while a component moves or is resized, its edges and centre snap to the artboard's and
// to the other components' (Figma-like), and the lines it snapped to are drawn.

export type Box = { x: number; y: number; w: number; h: number };
export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number };

type Edge = 'start' | 'center' | 'end';
const pos = (b: Box, axis: 'x' | 'y', e: Edge) => {
  const p = axis === 'x' ? b.x : b.y, s = axis === 'x' ? b.w : b.h;
  return e === 'start' ? p : e === 'center' ? p + s / 2 : p + s;
};

// Which edges of the moving box follow the pointer on each axis, for a move or a resize handle.
export function movingEdges(handle: string): { x: Edge[]; y: Edge[] } {
  if (handle === 'move') return { x: ['start', 'center', 'end'], y: ['start', 'center', 'end'] };
  return {
    x: handle.includes('w') ? ['start'] : handle.includes('e') ? ['end'] : [],
    y: handle.includes('n') ? ['start'] : handle.includes('s') ? ['end'] : [],
  };
}

// The correction to add to the pointer delta so the closest moving edge lands on a target, and the guides.
export function snap(moving: Box, edges: { x: Edge[]; y: Edge[] }, targets: Box[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const out = { dx: 0, dy: 0, guides: [] as Guide[] };
  for (const axis of ['x', 'y'] as const) {
    let best: { d: number; at: number } | null = null;
    for (const e of edges[axis]) {
      const p = pos(moving, axis, e);
      for (const t of targets) for (const te of ['start', 'center', 'end'] as Edge[]) {
        const at = pos(t, axis, te);
        const d = at - p;
        if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at };
      }
    }
    if (!best) continue;
    if (axis === 'x') out.dx = best.d; else out.dy = best.d;
    // The line runs across every box that shares that edge, including the moved one.
    const snapped = { ...moving, x: moving.x + out.dx, y: moving.y + out.dy };
    const along = [snapped, ...targets.filter((t) => (['start', 'center', 'end'] as Edge[]).some((te) => Math.abs(pos(t, axis, te) - best!.at) < 0.5))];
    const from = Math.min(...along.map((b) => (axis === 'x' ? b.y : b.x)));
    const to = Math.max(...along.map((b) => (axis === 'x' ? b.y + b.h : b.x + b.w)));
    out.guides.push({ axis, at: best.at, from, to });
  }
  return out;
}
