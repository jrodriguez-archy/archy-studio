// Canvas shapes shared by the server (renderer, actions) and the editor in the browser.

// A hand edit on one layer of a piece (keyed by its data-node). Slot copy and slot images are not
// edits: they change the slot, so the template's fit rules keep applying.
export type NodeEdit = {
  /** New copy for a text layer that is not a slot. */
  text?: string;
  /** New image for a layer that is not a slot: asset:<id> or upload:<path>. */
  image?: string;
  /** Another Hugeicons icon for an icon layer (export name, e.g. "Calendar03Icon"). */
  icon?: string;
  /** Only on the RECOLOR entry: the piece redrawn on a Dark, Blue, Ice or Light ground (scripts/edits.js). */
  preset?: Preset;
  hidden?: boolean;
  /** Only on the LEFT_OUT entry: what hidden optional details held (slot → value), to bring them back. */
  slots?: Record<string, string>;
  /** A partner logo in one colour (its shape, in the design's colour) or in its own colours. */
  colors?: 'one' | 'original';
  box?: { dx?: number; dy?: number; width?: number; height?: number; scale?: number };
  style?: { color?: string; backgroundColor?: string; fontSize?: number; fontWeight?: number; opacity?: number };
  /** A group's layout (it is a flex frame from Paper): spread packed or space-between, gap, placement. */
  layout?: Layout;
  /** A photo reframed inside its frame: x, y as CSS background-position % (0–100), zoom over "fill the frame"
   * (1 = cover). `src` is the size of the photo it was made for ("1600x900"): another photo starts from the automatic framing. Per format. */
  crop?: Crop;
};
export type Crop = { x: number; y: number; zoom: number; src?: string };

/** How a slot photo sits in its frame, asked for by name (Claude's render): the point of the photo (0–100 %
 * across and down) kept at the frame's centre as far as the photo allows, and the zoom (1 = covers the frame;
 * below 1 the photo is smaller than its frame). */
export type Framing = { focusX?: number; focusY?: number; zoom?: number };

/** Where a photo sits in its window (px, relative to the photo layer, as edits.js __setCrop draws it). */
export type PhotoFit = { W: { x: number; y: number; w: number; h: number }; iw: number; ih: number; bw: number; bh: number; px: number; py: number };
/** "Generate content around": the pixels to paint on each side of the photo, and the framing for the result. */
export type Outpaint = { expand: { top: number; right: number; bottom: number; left: number }; cropFor: (w: number, h: number) => Crop };

/** A photo smaller than its frame: what to paint around it to fill the frame (null when it already fills it). */
export function outpaintFor(f: PhotoFit): Outpaint | null {
  // The empty bands of the frame (artboard px), in the photo's own pixels: a hair more, so no seam shows.
  const gap = { left: Math.max(0, f.px - f.W.x), right: Math.max(0, f.W.x + f.W.w - (f.px + f.bw)), top: Math.max(0, f.py - f.W.y), bottom: Math.max(0, f.W.y + f.W.h - (f.py + f.bh)) };
  const s = f.iw / f.bw;
  const px = (g: number) => (g > 0.5 ? Math.ceil(g * s) + 2 : 0);
  const expand = { top: px(gap.top), right: px(gap.right), bottom: px(gap.bottom), left: px(gap.left) };
  if (!expand.top && !expand.right && !expand.bottom && !expand.left) return null;
  return {
    expand,
    // The result framed so the photo stays exactly where it was and the new edges reach the frame.
    cropFor: (rw, rh) => {
      const nbw = f.bw * (f.iw + expand.left + expand.right) / f.iw, nbh = f.bh * (f.ih + expand.top + expand.bottom) / f.ih;
      const nx = f.px - expand.left / s, ny = f.py - expand.top / s;
      const zoom = (nbw / rw) / Math.max(f.W.w / rw, f.W.h / rh);
      const pct = (p: number, room: number) => (Math.abs(room) < 0.5 ? 50 : Math.max(0, Math.min(100, (p / room) * 100)));
      return { x: +pct(nx - f.W.x, f.W.w - nbw).toFixed(2), y: +pct(ny - f.W.y, f.W.h - nbh).toFixed(2), zoom: +Math.max(0.2, Math.min(5, zoom)).toFixed(3), src: `${rw}x${rh}` };
    },
  };
}
export type Layout = { distribute?: 'packed' | 'space-between'; gap?: number; position?: 'start' | 'center' | 'end'; align?: 'start' | 'center' | 'end' };
export type Edits = Record<string, NodeEdit>;
export type Preset = 'dark' | 'blue' | 'sky' | 'ice' | 'light';
// The piece-level entry of Edits (not a layer): a recolour preset. Not a template theme (a template's
// themes are separate artboards, chosen at render). The stored key keeps its first name, ':theme', so
// pieces saved before the rename still open recoloured.
export const RECOLOR = ':theme';
// The piece-level entry that keeps what hidden details held (the eye hides; the bin removes).
export const LEFT_OUT = ':out';

// Everything the page needs to draw one piece: the template file, the fill for fit.js and the
// resolved URLs of edited images.
export type FillPlan = {
  template: string;
  format: string;
  /** The design and theme drawn (null on templates that offer only one). */
  design: string | null;
  theme: string | null;
  variant: string | null;
  /** Image slots holding a placeholder photo until the real one comes. */
  placeholders?: string[];
  slots: Record<string, string | null>;
  /** Path of the template HTML under the file root (templates/<id>/<file>.html). */
  html: string;
  width: number;
  height: number;
  fill: { format: string; formats: string[]; values: Record<string, string | null>; rules: unknown; limits: unknown };
  imageUrls: Record<string, string>;
  /** Inner SVG markup of the icons placed by hand, by name. */
  iconSvgs: Record<string, string>;
};

export type RenderReport = {
  format: string;
  ok: boolean;
  slots: Record<string, { status: string; scale?: number; wrapped?: boolean; groupWrapped?: boolean; lines?: number; fontSize?: number }>;
  errors: { slot?: string; node?: string; code: string; message?: string; maxLength?: number; reason?: string }[];
  /** How the content filled the design's room (fit.js balance): its lead text grown, the footer sent down. */
  fill?: { footprint: number; before: number; after?: number; grew?: { slot: string; scale: number }; footer?: string; gap?: number };
  /** px the column started lower to stay clear of a decoration above it (a detail left out at the top). */
  clearedTop?: number;
};

// Edits with nothing left in them are dropped, so a restored layer leaves no trace.
export function cleanEdits(edits: Edits): Edits {
  const out: Edits = {};
  for (const [id, e] of Object.entries(edits)) {
    const box = Object.fromEntries(Object.entries(e.box ?? {}).filter(([k, v]) => v != null && !(k === 'scale' ? v === 1 : (k === 'dx' || k === 'dy') && v === 0)));
    const style = Object.fromEntries(Object.entries(e.style ?? {}).filter(([, v]) => v != null && v !== ''));
    const n: NodeEdit = {};
    if (e.text != null) n.text = e.text;
    if (e.image) n.image = e.image;
    if (e.icon) n.icon = e.icon;
    if (e.preset) n.preset = e.preset;
    if (e.hidden) n.hidden = true;
    if (e.colors === 'one' || e.colors === 'original') n.colors = e.colors;
    const kept = Object.fromEntries(Object.entries(e.slots ?? {}).filter(([, v]) => typeof v === 'string' && v));
    if (Object.keys(kept).length) n.slots = kept;
    if (Object.keys(box).length) n.box = box;
    if (Object.keys(style).length) n.style = style;
    const layout = Object.fromEntries(Object.entries(e.layout ?? {}).filter(([, v]) => v != null));
    if (Object.keys(layout).length) n.layout = layout;
    if (e.crop && Number.isFinite(e.crop.x) && Number.isFinite(e.crop.y) && Number.isFinite(e.crop.zoom)) n.crop = { x: e.crop.x, y: e.crop.y, zoom: e.crop.zoom, ...(e.crop.src ? { src: e.crop.src } : {}) };
    if (Object.keys(n).length) out[id] = n;
  }
  return out;
}

// A design suggestion from the Inspector (components.js __review): never a block.
export type Suggestion = {
  id: string; level: 'warn' | 'tip'; title: string; detail: string;
  /** An exact nudge back into line. */
  fix?: { dx: number; dy: number };
  /** Undo the hand edit that caused it (back to the design's value): fields like 'box.width', 'style.color'. */
  revert?: { id: string; fields: string[]; label: string };
  /** The revert is safe to apply without asking (Fix all does it): a size forced below the design… */
  auto?: boolean;
};
