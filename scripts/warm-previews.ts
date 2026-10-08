// Renders every catalog preview that is not stored yet (each template format, current version), so
// nobody waits for one in /templates or Canvas. Run after changing or adding templates:
//
//   set -a; source .env.local; set +a; NODE_OPTIONS=--conditions=react-server npx tsx scripts/warm-previews.ts
import { catalog } from '../lib/catalog';
import { previewKey } from '../lib/previews';
import { render } from '../lib/renderer';
import { previewExists, previewUrl } from '../lib/renders';

async function main() {
  const jobs: { template: string; format: string; key: string }[] = [];
  for (const { manifest } of await catalog()) {
    for (const format of Object.keys(manifest.formats)) {
      const key = await previewKey(manifest.id, format);
      if (key && !(await previewExists(key))) jobs.push({ template: manifest.id, format, key });
    }
  }
  console.log(`${jobs.length} previews to render`);
  let done = 0;
  const queue = [...jobs];
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      try {
        await previewUrl(j.key, async () => (await render({ template: j.template, format: j.format, slots: {}, fillDefaults: true })).png);
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
