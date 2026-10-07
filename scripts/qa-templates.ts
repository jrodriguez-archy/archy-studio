// Template QA: every template × format drawn with realistic, short and long copy (the cases of
// Template review). Reports how
// much of the design's footprint the content fills, what grew, what does not fit and what the Inspector
// says, and keeps the PNGs, so a template that looks wrong with real copy is caught before people see it.
//
//   set -a; source .env.local; set +a; NODE_OPTIONS=--conditions=react-server npx tsx scripts/qa-templates.ts [out-dir] [template…]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { catalog } from '../lib/catalog';
import { render } from '../lib/renderer';
import { casesFor } from './review-cases';

async function main() {
  const [outDir = path.join(process.cwd(), '.qa'), ...only] = process.argv.slice(2);
  await mkdir(outDir, { recursive: true });
  const items = (await catalog()).filter((i) => !only.length || only.includes(i.manifest.id));
  const rows: string[] = [];
  for (const [index, { manifest, config }] of items.entries()) {
    for (const format of Object.keys(manifest.formats)) {
      // The same realistic cases as Template review (scripts/review-cases.ts).
      for (const { case: name, slots } of await casesFor(manifest, config, format, { index })) {
        try {
          const out = await render({ template: manifest.id, format, slots, fillDefaults: true, inspect: true });
          const f = out.report.fill;
          const before = f ? Math.round((f.before / f.footprint) * 100) : null;
          const after = f ? Math.round(((f.after ?? f.before) / f.footprint) * 100) : null;
          const file = `${manifest.id}-${format}-${name}.png`;
          await writeFile(path.join(outDir, file), out.png);
          const warn = out.inspected?.review.filter((r) => r.level === 'warn').map((r) => r.title) ?? [];
          rows.push([
            manifest.id, format, name,
            f ? `${before}% → ${after}%` : 'n/a',
            f?.grew ? `${f.grew.slot} ×${f.grew.scale}` : '',
            f?.footer ? 'footer↓' : '',
            out.report.ok ? 'ok' : out.report.errors.map((e) => e.code + (e.slot ? `:${e.slot}` : '')).join(' '),
            warn.join('; '),
          ].join(' | '));
        } catch (e) {
          rows.push(`${manifest.id} | ${format} | ${name} | ERROR ${(e as Error).message}`);
        }
      }
    }
  }
  const table = ['template | format | case | content/footprint | grew | footer | fit | inspector', ...rows].join('\n');
  await writeFile(path.join(outDir, 'report.txt'), table);
  console.log(table);
  process.exit(0);
}

main();
