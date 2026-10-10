// Gallery shapes shared by the server loader and the client grid.

export type Piece = {
  id: string; set_id: string; template: string; title: string; format: string; width: number; height: number; scale: number;
  slots: Record<string, string | null>; created_at: string;
  user_id: string | null; author: string; project_id: string | null; thumb?: string; large?: string; file?: string;
  set_title?: string | null; archived_at?: string | null; edited_at?: string | null;
  /** Design and theme, on templates that offer several (null: the default). */
  design?: string | null; theme?: string | null;
};

// Everything made from one brief: its formats, retries and options, shown as one stacked card.
// Without a brand, the server uses the one the person is working in.
export type PieceFilter = { userId?: string; projectId?: string; formats?: string[]; archived?: boolean; brand?: 'archy' | 'doc' };
// A gallery view shows the newest PAGE designs first; older ones load as the person scrolls.
export const PAGE = 120;

export type PieceSet = {
  id: string; title: string; pieces: Piece[]; lead: Piece; templates: string[];
  created_at: string; author: string; user_id: string | null; project_id: string | null;
  archived_at: string | null;
};

// Gallery types: Square counts as a feed post.
export const TYPES = [
  { key: 'post', label: 'Post', formats: ['post', 'square'] },
  { key: 'story', label: 'Story', formats: ['stories'] },
  { key: 'og', label: 'OG', formats: ['og'] },
  { key: 'cover', label: 'Cover', formats: ['cover'] },
];

const FORMAT_ORDER = ['post', 'square', 'stories', 'og', 'cover'];
const rankFormat = (f: string) => { const i = FORMAT_ORDER.indexOf(f); return i < 0 ? 99 : i; };

// Explorations: designs Claude composed in the brand kit for a brief no template covers (lib/compose.ts).
export const isExploration = (template: string) => template === 'exploration';

const FORMAT_LABELS: Record<string, string> = { og: 'OG', 'linkedin-banner': 'LinkedIn banner', 'linkedin-post': 'LinkedIn post' };
export const formatLabel = (f: string) => FORMAT_LABELS[f] ?? (f[0].toUpperCase() + f.slice(1)).replace(/-/g, ' ');

// "speaker-name" → "Speaker name"
export const humanize = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/-/g, ' ');

// "CHICAGO MIDWINTER MEETING 2027" → "Chicago Midwinter Meeting 2027"; other text unchanged.
const tidy = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);

// A set's name from its brief: the event, the person or the headline.
export function titleFromSlots(s: Record<string, string | null>): string | null {
  const headline = [s.headline, s['headline-1'] && s['headline-2'] ? `${s['headline-1']} ${s['headline-2']}` : s['headline-1']].find((h) => h && h.length <= 60);
  const name = s['event-name'] || s.kicker || s['speaker-name'] || s.name || headline || s.city;
  return name ? tidy(name.replace(/\s+/g, ' ').trim()) : null;
}

// Group pieces (newest first) into sets, newest set first. Inside a set: by template, then format order.
// With a type filter, only sets that have that type are kept and that format leads the card.
export function groupSets(pieces: Piece[], leadFormats?: string[]): PieceSet[] {
  const by = new Map<string, Piece[]>();
  for (const p of pieces) by.set(p.set_id, [...(by.get(p.set_id) ?? []), p]);
  const sets: PieceSet[] = [];
  for (const [id, list] of by) {
    if (leadFormats && !list.some((p) => leadFormats.includes(p.format))) continue;
    const templates = [...new Set(list.map((p) => p.template))];
    const sorted = [...list].sort((a, b) => templates.indexOf(a.template) - templates.indexOf(b.template) || rankFormat(a.format) - rankFormat(b.format) || b.created_at.localeCompare(a.created_at));
    // One piece per template+design+theme+format: the newest (a retry replaces the earlier render in the
    // stack; options in other designs or themes stay).
    const seen = new Set<string>();
    const unique = sorted.filter((p) => { const k = `${p.template}:${p.design ?? ''}:${p.theme ?? ''}:${p.format}`; if (seen.has(k)) return false; seen.add(k); return true; });
    const lead = (leadFormats && unique.find((p) => leadFormats.includes(p.format))) || unique[0];
    sets.push({
      id, pieces: unique, lead, templates,
      title: list.find((p) => p.set_title)?.set_title ?? titleFromSlots(lead.slots) ?? lead.title,
      created_at: list.reduce((m, p) => (p.created_at > m ? p.created_at : m), list[0].created_at),
      author: lead.author, user_id: list.every((p) => p.user_id === lead.user_id) ? lead.user_id : null, project_id: list.find((p) => p.project_id)?.project_id ?? null,
      archived_at: list.find((p) => p.archived_at)?.archived_at ?? null,
    });
  }
  return sets.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// Who can move, rename, archive and delete a set: whoever made it, the owner of its project, admins.
export function canManageSet(set: PieceSet, me: { id: string; is_admin: boolean }, projects: { id: string; owner_id?: string }[]) {
  return me.is_admin || set.user_id === me.id || (!!set.project_id && projects.find((p) => p.id === set.project_id)?.owner_id === me.id);
}
