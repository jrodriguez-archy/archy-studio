import 'server-only';
import { brandOf, type Brand } from './brands';
import { thumbUrl } from './images';
import { supabaseAdmin, supabaseConfigured } from './supabase/admin';

// Lessons from review: Claude proposes them from Juan's comments and Canvas corrections on explorations;
// an admin edits and approves them (Admin › Lessons), and get_brand_kit sends every approved one from
// then on. Principles with their reason, never pixel values: the examples carry the specifics.

export const LESSON_STATUSES = ['proposed', 'approved', 'retired'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];
export const LESSON_LABEL: Record<LessonStatus, string> = { proposed: 'Proposed', approved: 'Approved', retired: 'Retired' };

const ID = /^[0-9a-f-]{36}$/i;
type Example = { before?: string; after?: string };
export type LessonInput = { title: string; body: string; applies_when?: string | null; examples?: Example[]; source?: string | null };

export async function proposeLesson(input: LessonInput, brand: Brand = 'archy', by: string | null = null) {
  const { data, error } = await supabaseAdmin().from('explore_lessons').insert({
    brand, title: input.title.trim(), body: input.body.trim(), applies_when: input.applies_when?.trim() || null,
    examples: (input.examples ?? []).filter((e) => [e.before, e.after].every((x) => !x || ID.test(x))), source: input.source ?? null, created_by: by,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateLesson(id: string, patch: { title?: string; body?: string; applies_when?: string | null; status?: LessonStatus }, by: string) {
  if (!ID.test(id)) throw new Error('Unknown lesson.');
  if (patch.status && !LESSON_STATUSES.includes(patch.status)) throw new Error('Unknown status.');
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title?.trim()) row.title = patch.title.trim();
  if (patch.body?.trim()) row.body = patch.body.trim();
  if (patch.applies_when !== undefined) row.applies_when = patch.applies_when?.trim() || null;
  if (patch.status) { row.status = patch.status; if (patch.status === 'approved') row.approved_by = by; }
  const { error } = await supabaseAdmin().from('explore_lessons').update(row).eq('id', id);
  if (error) throw new Error(error.message);
  learned.clear();
}

export type Lesson = {
  id: string; title: string; body: string; appliesWhen: string | null; status: LessonStatus; source: string | null; updatedAt: string;
  examples: { before: string | null; after: string | null; width: number; height: number }[];
};

export async function listLessons(brand: Brand, status: LessonStatus): Promise<Lesson[]> {
  const db = supabaseAdmin();
  const { data } = await db.from('explore_lessons').select('id, title, body, applies_when, status, source, examples, updated_at')
    .eq('brand', brand).eq('status', status).order('updated_at', { ascending: false }).limit(200);
  const rows = data ?? [];
  const ids = [...new Set(rows.flatMap((r) => (r.examples as Example[]).flatMap((e) => [e.before, e.after]).filter((x): x is string => !!x && ID.test(x))))];
  const { data: renders } = ids.length ? await db.from('renders').select('id, storage_path, width, height').in('id', ids) : { data: [] };
  const byId = new Map((renders ?? []).map((r) => [r.id as string, r]));
  return rows.map((r) => ({
    id: r.id, title: r.title, body: r.body, appliesWhen: r.applies_when, status: r.status as LessonStatus, source: r.source, updatedAt: r.updated_at,
    examples: (r.examples as Example[]).map((e) => {
      const b = e.before ? byId.get(e.before) : undefined, a = e.after ? byId.get(e.after) : undefined;
      return { before: b ? thumbUrl(b.storage_path) : null, after: a ? thumbUrl(a.storage_path) : null, width: (a ?? b)?.width ?? 1080, height: (a ?? b)?.height ?? 1350 };
    }).filter((e) => e.before || e.after),
  }));
}

// The approved lessons as the brand kit's last section, read at call time (kept a minute per server, and
// dropped at once when an admin changes one on this server).
const learned = new Map<Brand, { text: string; until: number }>();
export async function learnedSection(brand: Brand): Promise<string> {
  if (!supabaseConfigured()) return '';
  const hit = learned.get(brand);
  if (hit && hit.until > Date.now()) return hit.text;
  const { data, error } = await supabaseAdmin().from('explore_lessons').select('title, body, applies_when').eq('brand', brandOf(brand)).eq('status', 'approved').order('created_at');
  if (error) return hit?.text ?? '';
  const text = data?.length
    ? `## Learned from review\n\nWhat Design corrected in earlier explorations, as principles. They weigh like the guides above, and the newest refine the older ones.\n\n${data.map((l) => `- **${l.title}**${l.applies_when ? ` (${l.applies_when})` : ''}: ${l.body}`).join('\n')}\n`
    : '';
  learned.set(brand, { text, until: Date.now() + 60_000 });
  return text;
}
