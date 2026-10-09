// Repro: renders without photos never stop; placeholders take the photos' place (see lib/placeholders.ts).
import fs from 'node:fs/promises';
import { render } from '../lib/renderer';
import { photoPlaceholder, placeholderNote } from '../lib/placeholders';
import { loadConfig, loadManifest } from '../lib/templates';
import { matchTemplates } from '../lib/match';
const out = process.argv[2], userId = process.argv[3] ?? null;
const brief = { headline: "Dinner's On Us,\nPhoenix Dentists", subhead: 'Pull up a chair. Good food, good drinks, and zero agenda.', city: 'Phoenix, AZ', venue: 'The Henry - Arcadia', date: 'Thu, Oct 22', time: '6:00 – 9:00 PM', cta: 'Save Me a Seat' };
console.log('match (no photos):', JSON.stringify((await matchTemplates(['event-name', 'city', 'venue', 'date', 'time'], 'hosted-evening')).map((m) => [m.template, m.eligible, m.photos])));
for (const [template, format, extra] of [['night-out-venue', 'post', { perks: 'Seated dinner, drinks & good company' }], ['night-out-illustration', 'cover', {}], ['speaker-invite', 'post', { 'speaker-name': 'Dr. Ana Ruiz', datetime: 'Oct 22, 6:00 PM', 'speaker-role': 'Practice Owner' }]] as const) {
  const m = await loadManifest(template), c = await loadConfig(template);
  const slots: Record<string, string | null> = Object.fromEntries(Object.entries({ ...brief, ...extra }).filter(([k]) => m.slots[k]));
  const ph = [];
  for (const [k, s] of Object.entries(m.slots)) {
    if (s.type !== 'image' || slots[k] || (c.optional ?? []).includes(k)) continue;
    if (s.perFormat && !(format in s.perFormat)) continue;
    const from = c.derive?.[k]?.from; if (from && m.slots[from]?.type === 'image') continue;
    ph.push(await photoPlaceholder({ slot: k, fact: c.facts?.[k] ?? null, slots, purpose: c.purpose, userId }));
  }
  for (const p of ph) slots[p.slot] = p.value;
  try {
    const r = await render({ template, format, slots });
    console.log(template, format, r.report.ok, r.report.errors.map((e) => e.message), '\n ', placeholderNote(ph));
    await fs.writeFile(`${out}/ph-${template}-${format}.png`, r.png);
  } catch (e) { console.log(template, format, 'ERROR', (e as Error).message); }
}
process.exit(0);
