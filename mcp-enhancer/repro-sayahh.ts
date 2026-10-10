// Repro (Say Ahhh exploration): copy inside the mouth's calm dark interior needs no scrim, copy touching
// the teeth still does; a set id from an all-refused answer is kept.
import fs from 'node:fs/promises';
import { compose, checksFor } from '../lib/compose';
import { renderComposition } from '../lib/renderer';
import { keepSet } from '../lib/renders';
const out = process.argv[2];
const photo = '<div data-name="Photo" data-image="asset:84331df5" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1080px; background-size: 125%; background-position: 50% 50%"></div>';
const content = (top: number) => `<div data-name="Content" style="position: absolute; left: 190px; top: ${top}px; width: 700px; display: flex; flex-direction: column; align-items: center; gap: 48px"><div style="display: flex; flex-direction: column; align-items: center; gap: 16px"><div data-name="Headline" style="font: 600 120px/128px var(--font-heading); letter-spacing: var(--tracking-tight); color: var(--color-white); text-align: center; white-space: nowrap">Say Ahhh.</div><div data-name="Subline" style="font: 500 36px/46px var(--font-body); color: var(--color-blue-tint-100); text-align: center">Then say goodbye to<br>outdated dental software.</div></div><div data-piece="logo" data-name="Logo Archy" style="width: 220px"></div></div>`;
for (const [name, top] of [['inside', 362], ['on-teeth', 200]] as const) {
  const comp = await compose({ html: photo + content(top), width: 1080, height: 1080, brand: 'archy' });
  const r = await renderComposition({ page: comp.page, images: comp.images, width: 1080, height: 1080, checks: await checksFor(1080, 1080, 'archy') });
  console.log(name, JSON.stringify([...comp.problems, ...r.report.errors.map((e) => e.message)]));
  if (out) await fs.writeFile(`${out}/sayahh-${name}.png`, r.png);
}
const fresh = crypto.randomUUID();
console.log('fresh set kept:', (await keepSet(fresh, null)) === fresh);
process.exit(0);
