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
  /** Only on the THEME entry: brand colour swaps for the whole piece, hex → var(--color-*). */
  theme?: Record<string, string>;
  hidden?: boolean;
  box?: { dx?: number; dy?: number; width?: number; height?: number; scale?: number };
  style?: { color?: string; backgroundColor?: string; fontSize?: number; fontWeight?: number; opacity?: number };
};
export type Edits = Record<string, NodeEdit>;
// The piece-level entry of Edits (not a layer).
export const THEME = ':theme';

// Everything the page needs to draw one piece: the template file, the fill for fit.js and the
// resolved URLs of edited images.
export type FillPlan = {
  template: string;
  format: string;
  variant: string | null;
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
    const theme = Object.fromEntries(Object.entries(e.theme ?? {}).filter(([, v]) => v));
    if (Object.keys(theme).length) n.theme = theme;
    if (e.hidden) n.hidden = true;
    if (Object.keys(box).length) n.box = box;
    if (Object.keys(style).length) n.style = style;
    if (Object.keys(n).length) out[id] = n;
  }
  return out;
}
