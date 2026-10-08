// Template review, Claude's side: the open comments of the latest round (by template, with the spot
// marked), and resolving them once fixed.
//
//   … npx tsx scripts/review-feedback.ts                      list open comments (latest round)
//   … npx tsx scripts/review-feedback.ts --pins <dir>         also save each commented image with its pins drawn
//   … npx tsx scripts/review-feedback.ts --resolve <id,id> --note "fit.js: …"
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { supabaseAdmin } from '../lib/supabase/admin';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const db = supabaseAdmin();
  const resolve = arg('resolve');
  if (resolve) {
    const ids = resolve.split(',').map((s) => s.trim());
    const { error } = await db.from('review_comments').update({ resolved_at: new Date().toISOString(), resolution: arg('note') ?? 'Fixed' }).in('id', ids);
    if (error) throw new Error(error.message);
    console.log(`Resolved ${ids.length}.`);
    process.exit(0);
  }
  const { data: round } = await db.from('review_rounds').select('id, number').order('number', { ascending: false }).limit(1).single();
  const { data: items } = await db.from('review_items').select('id, template, format, case, status, storage_path, width, height').eq('round_id', round!.id);
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  const { data: comments } = await db.from('review_comments').select('id, item_id, body, x, y, created_at').in('item_id', [...byId.keys()]).is('resolved_at', null).order('created_at');
  const counts = (items ?? []).reduce((a, i) => ({ ...a, [i.status]: (a[i.status] ?? 0) + 1 }), {} as Record<string, number>);
  console.log(`Round ${round!.number}: ${JSON.stringify(counts)} · ${comments?.length ?? 0} open comments\n`);
  const pins = arg('pins');
  if (pins) await mkdir(pins, { recursive: true });
  const groups = new Map<string, NonNullable<typeof comments>>();
  for (const c of comments ?? []) { const it = byId.get(c.item_id)!; const k = it.template; groups.set(k, [...(groups.get(k) ?? []), c]); }
  for (const [template, list] of groups) {
    console.log(`## ${template}`);
    // The same comment on several formats (written once with "Same for…", or pasted) is one finding.
    const same = new Map<string, typeof list>();
    for (const c of list) same.set(c.body.trim(), [...(same.get(c.body.trim()) ?? []), c]);
    for (const [body, group] of same) {
      const where = group.map((c) => { const it = byId.get(c.item_id)!; return `${it.format} · ${it.case}${c.x != null ? ` @ (${Math.round(c.x * 100)}%, ${Math.round(c.y! * 100)}%)` : ''}`; });
      console.log(`- ${body}\n    on: ${where.join('; ')}\n    ids: ${group.map((c) => c.id).join(',')}`);
    }
    if (pins) {
      for (const itemId of new Set(list.map((c) => c.item_id))) {
        const it = byId.get(itemId)!;
        const { data: f } = await db.storage.from('renders').download(it.storage_path);
        if (!f) continue;
        const img = sharp(Buffer.from(await f.arrayBuffer()));
        const { width = it.width, height = it.height } = await img.metadata();
        const marks = list.filter((c) => c.item_id === itemId && c.x != null).map((c, n) =>
          `<g><circle cx="${c.x! * width}" cy="${c.y! * height}" r="${width / 40}" fill="#F2385A" stroke="white" stroke-width="${width / 300}"/><text x="${c.x! * width}" y="${c.y! * height + width / 110}" font-size="${width / 32}" font-family="sans-serif" font-weight="700" fill="white" text-anchor="middle">${n + 1}</text></g>`).join('');
        const out = await img.composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${marks}</svg>`) }]).png().toBuffer();
        await writeFile(path.join(pins, `${it.template}-${it.format}-${it.case.replace(':', '-')}.png`), out);
      }
    }
    console.log('');
  }
  process.exit(0);
}

main();
