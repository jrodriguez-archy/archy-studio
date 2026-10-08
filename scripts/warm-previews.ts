// Renders every catalog preview that is not stored yet (each template format, and each design × theme, current version), so
// nobody waits for one in /templates or Canvas. Run after changing or adding templates:
//
//   set -a; source .env.local; set +a; NODE_OPTIONS=--conditions=react-server npx tsx scripts/warm-previews.ts
import { catalog } from '../lib/catalog';
import { previewKey } from '../lib/previews';
import { render } from '../lib/renderer';
import { previewExists, previewUrl } from '../lib/renders';

async function main() {
  const jobs: { template: string; format: string; design?: string; theme?: string; key: string }[] = [];
  for (const { manifest } of await catalog()) {
    // Every design × theme of templates that offer several (the base formats are the default one).
    const combos = [undefined, ...Object.values(manifest.combos ?? {})];
    for (const c of combos) {
      for (const format of Object.keys(c?.formats ?? manifest.formats)) {
        const key = await previewKey(manifest.id, format, c?.design, c?.theme);
        if (key && !(await previewExists(key))) jobs.push({ template: manifest.id, format, design: c?.design, theme: c?.theme, key });
      }
    }
  }
  console.log(`${jobs.length} previews to render`);
  let done = 0;
  const queue = [...jobs];
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      try {
        await previewUrl(j.key, async () => (await render({ template: j.template, format: j.format, design: j.design, theme: j.theme, slots: {}, fillDefaults: true })).png);
        done++;
        process.stdout.write('.');
      } catch (e) {
        console.error(`\n${j.key}: ${(e as Error).message}`);
      }
    }
  }));
  console.log(`\n${done} rendered.`);
  process.exit(0);
}

main();
