// A new Template review round: every template × format × case rendered with the production engine and
// stored for an admin to evaluate in Studio (Admin → Template review).
//
//   set -a; source .env.local; set +a; NODE_OPTIONS=--conditions=react-server npx tsx scripts/review-round.ts [--templates a,b] [--note "..."]
//
// With --templates only those are rendered again; the rest of the round is carried over from the last
// one. A design whose inputs and engine did not change keeps its image and status (approved stays
// approved), so each round only asks about what changed.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { catalog } from '../lib/catalog';
import { render } from '../lib/renderer';
import { storeFiles } from '../lib/renders';
import { supabaseAdmin } from '../lib/supabase/admin';
import { casesFor, shorter } from './review-cases';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const only = arg('templates')?.split(',').map((s) => s.trim()).filter(Boolean);
const note = arg('note') ?? null;

type Prev = { id: string; template: string; format: string; case: string; status: string; storage_path: string; width: number; height: number; report: unknown; slots: unknown; edits: unknown; fingerprint: string | null };

async function main() {
  const db = supabaseAdmin();
  const ROOT = process.cwd();
  const engine = (await Promise.all(['fit.js', 'edits.js', 'components.js'].map((f) => readFile(path.join(ROOT, 'scripts', f), 'utf8')))).join('\n');
  const { data: last } = await db.from('review_rounds').select('id, number').order('number', { ascending: false }).limit(1).maybeSingle();
  const prev = new Map<string, Prev>();
  if (last) {
    const { data } = await db.from('review_items').select('id, template, format, case, status, storage_path, width, height, report, slots, edits, fingerprint').eq('round_id', last.id);
    for (const p of (data ?? []) as Prev[]) prev.set(`${p.template}|${p.format}|${p.case}`, p);
  }
  const number = (last?.number ?? 0) + 1;
  const { data: round, error } = await db.from('review_rounds').insert({ number, note }).select('id').single();
  if (error) throw new Error(error.message);
  console.log(`Round ${number}${note ? `: ${note}` : ''}`);

  const items = await catalog();
  const jobs: (() => Promise<void>)[] = [];
  let rendered = 0, carried = 0, failed = 0;
  for (const [index, { manifest, config }] of items.entries()) {
    const id = manifest.id;
    const formats = Object.keys(manifest.formats);
    const touch = !only || only.includes(id);
    const files = await Promise.all(['manifest.json', 'rules.json', 'template.config.json', ...formats.map((f) => `${f}.html`)]
      .map((f) => readFile(path.join(ROOT, 'templates', id, f), 'utf8').catch(() => '')));
    for (const format of formats) {
      for (const c of await casesFor(manifest, config, format, { themes: format === formats[0], index })) {
        const key = `${id}|${format}|${c.case}`;
        const before = prev.get(key);
        const fingerprint = createHash('sha1').update([engine, ...files, JSON.stringify(c.slots), JSON.stringify(c.edits)].join('\u0000')).digest('hex');
        const base = { round_id: round.id, template: id, format, case: c.case, slots: c.slots, edits: c.edits, prev_item_id: before?.id ?? null, fingerprint };
        // Unchanged (or not asked for): same image, same status.
        if (before && (!touch || before.fingerprint === fingerprint)) {
          jobs.push(async () => {
            await db.from('review_items').insert({ ...base, slots: before.slots, edits: before.edits, fingerprint: before.fingerprint, storage_path: before.storage_path, width: before.width, height: before.height, report: before.report, status: before.status });
            carried++;
          });
          continue;
        }
        if (!touch) continue;
        jobs.push(async () => {
          try {
            let slots = { ...c.slots };
            let out = await render({ template: id, format, slots, edits: c.edits, fillDefaults: true, inspect: true, scale: 2 });
            // Copy that does not fit is written shorter, as Claude would (same facts), and the long case is
            // shown at the template's real limit. What still does not fit is a finding about the template.
            const trimmed: string[] = [];
            const tried = new Set<string>();
            for (let tries = 0; !out.report.ok && tries < 6; tries++) {
              let changed = false;
              for (const e of out.report.errors) {
                const v = e.slot ? slots[e.slot] : null;
                if (!e.slot || typeof v !== 'string') continue;
                let next = shorter(e.slot, v).find((x) => !tried.has(`${e.slot}:${x}`));
                if (!next && c.case === 'long' && e.maxLength) {
                  const words = v.replace(/\s+/g, ' ').split(' ');
                  while (words.length > 1 && words.join(' ').length > e.maxLength) words.pop();
                  next = words.join(' ').replace(/[,:;–-]$/, '');
                }
                if (next && next !== v) { tried.add(`${e.slot}:${next}`); slots = { ...slots, [e.slot]: next }; trimmed.push(`${e.slot}: “${next.replace(/\n/g, ' ')}”`); changed = true; }
              }
              if (!changed) break;
              out = await render({ template: id, format, slots, edits: c.edits, fillDefaults: true, inspect: true, scale: 2 });
            }
            const storage = `review/r${number}/${id}/${format}-${c.case.replace(':', '-')}.png`;
            await storeFiles(storage, out.png, true);
            const report = { ok: out.report.ok, errors: out.report.errors, fill: out.report.fill ?? null, review: out.inspected?.review.map((r) => ({ title: r.title, level: r.level })) ?? [], trimmed };
            await db.from('review_items').insert({ ...base, slots, storage_path: storage, width: out.width, height: out.height, report, status: 'pending' });
            rendered++;
            process.stdout.write('.');
          } catch (e) {
            failed++;
            console.error(`\n${key}: ${(e as Error).message}`);
          }
        });
      }
    }
  }
  // A few at a time on the shared browser.
  const queue = [...jobs];
  await Promise.all(Array.from({ length: 3 }, async () => { for (let j = queue.shift(); j; j = queue.shift()) await j(); }));
  console.log(`\nRound ${number}: ${rendered} rendered, ${carried} carried over, ${failed} failed.`);
  process.exit(0);
}

main();
