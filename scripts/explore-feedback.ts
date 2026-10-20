// Lessons from review, Claude's side: what Design corrected on explorations (Canvas versions saved by an
// admin, each change named by its layer; review comments on exploration items when the board has them),
// and proposing lessons from it for an admin to approve in Admin › Lessons.
//
//   … npx tsx scripts/explore-feedback.ts [--since 2026-10-01] [--brand archy]   list the corrections
//   … npx tsx scripts/explore-feedback.ts --propose lessons.json                    propose lessons
//
// lessons.json: [{ "title", "body", "applies_when", "examples": [{ "before": <render id>, "after": <render id> }], "source" }]
// A lesson is a principle with its reason, never a pixel value: the examples carry the specifics.
import { readFile } from 'node:fs/promises';
import type { Edits } from '../lib/canvas-shared';
import { layerNames } from '../lib/compose';
import { proposeLesson, type LessonInput } from '../lib/lessons';
import { supabaseAdmin } from '../lib/supabase/admin';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };

// One edit in words: "Headline: fontSize 96 → 140, moved (0, -40)".
function describe(edits: Edits, before: Edits, names: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [node, e] of Object.entries(edits)) {
    const was = before[node] ?? {};
    if (JSON.stringify(was) === JSON.stringify(e)) continue;
    const name = node.startsWith(':') ? node : names[node] ?? node;
    const parts: string[] = [];
    if (e.text !== undefined && e.text !== was.text) parts.push(`text "${e.text}"`);
    if (e.html !== undefined && e.html !== was.html) parts.push('rich text changed');
    if (e.hidden !== undefined && e.hidden !== was.hidden) parts.push(e.hidden ? 'hidden' : 'shown');
    if (e.image && e.image !== was.image) parts.push(`image ${e.image}`);
    if (e.icon && e.icon !== was.icon) parts.push(`icon ${e.icon}`);
    for (const [k, v] of Object.entries(e.style ?? {})) if ((was.style as Record<string, unknown> | undefined)?.[k] !== v) parts.push(`${k} ${(was.style as Record<string, unknown> | undefined)?.[k] ?? '(as drawn)'} → ${v}`);
    if (e.box && JSON.stringify(e.box) !== JSON.stringify(was.box)) parts.push(`box ${JSON.stringify(e.box)}`);
    if (e.layout && JSON.stringify(e.layout) !== JSON.stringify(was.layout)) parts.push(`layout ${JSON.stringify(e.layout)}`);
    if (e.crop && JSON.stringify(e.crop) !== JSON.stringify(was.crop)) parts.push('photo reframed');
    if (e.colors && JSON.stringify(e.colors) !== JSON.stringify(was.colors)) parts.push(`colours ${JSON.stringify(e.colors)}`);
    if (!parts.length && node.startsWith(':')) parts.push(JSON.stringify(e));
    if (parts.length) out.push(`${name}: ${parts.join(', ')}`);
  }
  return out;
}

async function main() {
  const db = supabaseAdmin();
  const file = arg('propose');
  if (file) {
    const list = JSON.parse(await readFile(file, 'utf8')) as LessonInput[];
    for (const l of list) console.log('proposed', await proposeLesson(l, (arg('brand') as 'archy' | 'doc') ?? 'archy'), l.title);
    process.exit(0);
  }
  const since = arg('since') ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const brand = arg('brand') ?? 'archy';
  const { data: admins } = await db.from('profiles').select('id').eq('is_admin', true);
  const adminIds = (admins ?? []).map((a) => a.id);
  // Versions saved in Canvas from an exploration, by an admin: the correction is the edits on top of
  // the same HTML (the parent's edits are what was there before).
  const { data: versions } = await db.from('renders').select('id, parent_id, user_id, format, set_title, html, edits, created_at')
    .eq('template', 'exploration').eq('brand', brand).not('parent_id', 'is', null).in('user_id', adminIds).gte('created_at', since).order('created_at');
  const parents = new Map(((await db.from('renders').select('id, edits, user_id').in('id', (versions ?? []).map((v) => v.parent_id))).data ?? []).map((p) => [p.id, p]));
  console.log(`# Canvas corrections since ${since} (${versions?.length ?? 0})\n`);
  for (const v of versions ?? []) {
    const lines = describe((v.edits ?? {}) as Edits, (parents.get(v.parent_id)?.edits ?? {}) as Edits, layerNames(v.html ?? ''));
    if (!lines.length) continue;
    console.log(`## ${v.set_title ?? 'Exploration'} · ${v.format} (before ${v.parent_id} → after ${v.id})\n- ${lines.join('\n- ')}\n`);
  }
  // Review comments on exploration items (the review board's exploration rounds), when there are any.
  const { data: items, error } = await db.from('review_items').select('id, render_id, format, case').eq('kind', 'exploration').gte('created_at', since);
  if (!error && items?.length) {
    const { data: comments } = await db.from('review_comments').select('id, item_id, body, x, y').in('item_id', items.map((i) => i.id)).order('created_at');
    const byId = new Map(items.map((i) => [i.id, i]));
    console.log(`# Review comments (${comments?.length ?? 0})\n`);
    for (const c of comments ?? []) {
      const it = byId.get(c.item_id)!;
      console.log(`- ${c.body}\n    on: ${it.case} · ${it.format} (render ${it.render_id})${c.x != null ? ` @ (${Math.round(c.x * 100)}%, ${Math.round(c.y! * 100)}%)` : ''}`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
