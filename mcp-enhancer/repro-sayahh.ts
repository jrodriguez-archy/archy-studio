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
// Stories: the subline on the plain blue floor under the mouth (large text: 3:1 is enough) needs no scrim.
{
  const html = '<div data-name="Photo" data-image="asset:bd8d751b" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; background-size: cover; background-position: 50% 50%"></div><div data-name="Headline" style="position: absolute; left: 105px; top: 625px; width: 870px; font: 600 172px/180px var(--font-heading); letter-spacing: var(--tracking-tight); color: var(--color-white); text-align: center">Say<br>Ahhh.</div><div data-name="Content" style="position: absolute; left: 105px; top: 1400px; width: 870px; display: flex; flex-direction: column; align-items: center; gap: 56px"><div data-name="Subline" style="font: 500 46px/58px var(--font-body); color: var(--color-white); text-align: center">Then say goodbye to<br>outdated dental software.</div><div data-piece="logo" data-name="Logo Archy" style="width: 230px"></div></div>';
  const comp = await compose({ html, width: 1080, height: 1920, brand: 'archy' });
  const r = await renderComposition({ page: comp.page, images: comp.images, width: 1080, height: 1920, checks: await checksFor(1080, 1920, 'archy') });
  console.log('floor', JSON.stringify([...comp.problems, ...r.report.errors.map((e) => e.message)]));
  if (out) await fs.writeFile(`${out}/sayahh-floor.png`, r.png);
}
// Stories: a subline whose second line runs over the lower teeth is refused (it passed before: the
// teeth were under a tenth of its box). Square (big mouth): no "room to grow" for a headline set in the mouth.
for (const [name, w, h, html] of [
  ['teeth-subline', 1080, 1920, '<div data-name="Photo" data-image="asset:bd8d751b" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; background-size: cover; background-position: 50% 50%"></div><div data-piece="logo" data-name="Logo Archy" style="position: absolute; left: 430px; top: 250px; width: 220px"></div><div data-name="Message" style="position: absolute; left: 105px; top: 640px; width: 870px; display: flex; flex-direction: column; align-items: center; gap: 22px"><div data-name="Headline" style="font: 600 156px/168px var(--font-heading); letter-spacing: var(--tracking-tight); color: var(--color-white); text-align: center">Say<br>Ahhh.</div><div data-name="Subline" style="font: 500 38px/46px var(--font-body); color: var(--color-white); text-align: center">Then say goodbye to<br>outdated dental software.</div></div>'],
  ['big-mouth', 1080, 1080, '<div data-name="Photo" data-image="asset:30fc8b3f" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1080px; background-size: cover; background-position: 50% 50%"></div><div data-piece="logo" data-name="Logo Archy" style="position: absolute; left: 105px; top: 105px; width: 200px"></div><div data-name="Message" style="position: absolute; left: 305px; top: 406px; width: 470px; display: flex; flex-direction: column; align-items: center; gap: 12px"><div data-name="Headline" style="font: 600 112px/120px var(--font-heading); letter-spacing: var(--tracking-tight); color: var(--color-white); text-align: center">Say<br>Ahhh.</div><div data-name="Subline" style="font: 500 24px/29px var(--font-body); color: var(--color-white); text-align: center">Then say goodbye to<br>outdated dental software.</div></div>'],
  ['big-mouth-post', 1080, 1350, '<div data-name="Photo" data-image="asset:8c4b14fa" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1350px; background-size: cover; background-position: 50% 50%"></div><div data-piece="logo" data-name="Logo Archy" style="position: absolute; left: 105px; top: 105px; width: 200px"></div><div data-name="Message" style="position: absolute; left: 305px; top: 376px; width: 470px; display: flex; flex-direction: column; align-items: center; gap: 10px"><div data-name="Headline" style="font: 600 116px/124px var(--font-heading); letter-spacing: var(--tracking-tight); color: var(--color-white); text-align: center">Say<br>Ahhh.</div><div data-name="Subline" style="font: 500 24px/29px var(--font-body); color: var(--color-white); text-align: center">Then say goodbye to<br>outdated dental software.</div></div>'],
  ['big-mouth-stories', 1080, 1920, '<div data-name="Photo" data-image="asset:01d3f19a" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; background-size: cover; background-position: 50% 50%"></div><div data-piece="logo" data-name="Logo Archy" style="position: absolute; left: 105px; top: 260px; width: 210px"></div><div data-name="Message" style="position: absolute; left: 290px; top: 680px; width: 500px; display: flex; flex-direction: column; align-items: center; gap: 26px"><div data-name="Headline" style="font: 600 156px/168px var(--font-heading); letter-spacing: var(--tracking-tight); color: var(--color-white); text-align: center">Say<br>Ahhh.</div><div data-name="Subline" style="font: 500 34px/42px var(--font-body); color: var(--color-white); text-align: center">Then say goodbye<br>to outdated<br>dental software.</div></div>'],
] as const) {
  const comp = await compose({ html, width: w, height: h, brand: 'archy' });
  const r = await renderComposition({ page: comp.page, images: comp.images, width: w, height: h, checks: await checksFor(w, h, 'archy') });
  console.log(name, 'errors', JSON.stringify(r.report.errors.map((e) => `${e.layer}: ${e.code}`)), 'warnings', JSON.stringify(r.report.warnings.map((e) => `${e.layer}: ${e.code}`)));
  if (out) await fs.writeFile(`${out}/sayahh-${name}.png`, r.png);
}
const fresh = crypto.randomUUID();
console.log('fresh set kept:', (await keepSet(fresh, null)) === fresh);
process.exit(0);
