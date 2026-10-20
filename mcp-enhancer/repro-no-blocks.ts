// Repro (team usage, 2026-10-20): nothing holds a design back. A copy-led exploration (a ~56 px paragraph
// as the hero) only gets notes; a template missing its date prints "[Date]"; copy too long is set smaller.
import fs from 'node:fs/promises';
import { compose, checksFor } from '../lib/compose';
import { render, renderComposition } from '../lib/renderer';
const out = process.argv[2];
{
  const html = '<div data-name="Ground" style="position: absolute; inset: 0; background: var(--color-royal-blue-500)"></div><div data-name="Content" style="position: absolute; left: 90px; top: 90px; width: 900px; display: flex; flex-direction: column; gap: 40px"><div data-name="Kicker" style="font: 600 64px/70px var(--font-heading); color: var(--color-white)">Monday,<br>8:02 AM.</div><div data-name="Monologue" style="font: 500 56px/68px var(--font-body); color: var(--color-white)">the EOBs are in. how many? all of them. who\'s posting them? my biller. by hand? line by line. how long? the whole morning.</div></div><div data-piece="logo" data-name="Logo Archy" style="position: absolute; right: 90px; bottom: 90px; width: 220px"></div>';
  const comp = await compose({ html, width: 1080, height: 1080, brand: 'archy' });
  const r = await renderComposition({ page: comp.page, images: comp.images, width: 1080, height: 1080, checks: await checksFor(1080, 1080, 'archy') });
  console.log('monologue errors', JSON.stringify(r.report.errors.map((e) => e.code)), 'warnings', JSON.stringify(r.report.warnings.map((e) => `${e.code}: ${e.message.slice(0, 90)}`)));
  if (out) await fs.writeFile(`${out}/monologue.png`, r.png);
}
{
  const r = await render({ template: 'night-out-venue', format: 'post', slots: { headline: 'A Free Night Out For Phoenix Dentists', city: 'Phoenix, AZ', venue: 'The Henry' }, scale: 1 });
  console.log('missing date → slots', JSON.stringify({ date: r.slots.date, time: r.slots.time }), 'ok', r.report.ok);
  if (out) await fs.writeFile(`${out}/missing-date.png`, r.png);
}
{
  const long = { headline: 'An Unforgettable Evening of Dinner, Drinks and Conversation for Every Dentist in the Greater Phoenix Metropolitan Area', city: 'Phoenix, AZ', venue: 'The Henry', date: 'Oct 22', time: '6 – 9 PM' };
  const n = await render({ template: 'night-out-venue', format: 'post', slots: long, scale: 1 });
  const s = await render({ template: 'night-out-venue', format: 'post', slots: long, smallerText: true, scale: 1 });
  console.log('long copy normal ok', n.report.ok, '| smaller ok', s.report.ok);
  if (out) await fs.writeFile(`${out}/long-smaller.png`, s.png);
}
process.exit(0);
