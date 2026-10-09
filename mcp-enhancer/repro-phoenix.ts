// Repro 2026-10-08-phoenix-dinner: the Square headline came out on 3 lines and was reported ready.
import fs from 'node:fs/promises';
import { render } from '../lib/renderer';
const slots = { headline: 'A Free Night Out\nFor Phoenix Dentists', subhead: null, city: 'Phoenix, AZ', venue: 'The Henry - Arcadia', date: 'Thursday, October 22', time: '6:00 – 9:00 PM', cta: 'Save Me a Seat' };
for (const format of ['square', 'stories', 'og']) {
  const out = await render({ template: 'night-out-illustration', format, slots });
  console.log(format, out.report.ok, JSON.stringify(out.report.slots.headline), out.report.errors.map((e) => e.message));
  if (!out.report.ok) { const small = await render({ template: 'night-out-illustration', format, slots, smallerText: true }); console.log('  smaller text →', small.report.ok, JSON.stringify(small.report.slots.headline)); await fs.writeFile(`${process.argv[2]}/phoenix-${format}-smaller.png`, small.png); }
  await fs.writeFile(`${process.argv[2]}/phoenix-${format}.png`, out.png);
}
process.exit(0);
