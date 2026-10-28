import type { Brand } from './brands';
import { listTemplates, loadConfig } from './templates';

// Facts a brief can bring. Copy (headlines, subheads, CTAs) is written from the brief, so it is not a fact.
export const FACTS = [
  'event-name', 'city', 'venue', 'date', 'time', 'booth', 'city-photo', 'venue-photo', 'ground-photo', 'guest-photo',
  'speaker', 'speaker-photo', 'speaker-role', 'speaker-company', 'partner-logo',
  'person', 'person-title', 'person-photo', 'ad-photo', 'stat', 'object-photo',
] as const;

export const PURPOSES = ['booth-invite', 'reminder', 'hosted-evening', 'speaker-invite', 'event-cover', 'spotlight', 'photo-claim', 'claim', 'stat', 'list', 'explainer', 'scroll-stopper', 'faculty', 'event'] as const;

// Facts and purposes only DOC templates use: people without DOC never see them.
const DOC_FACTS: readonly string[] = ['stat', 'object-photo'];
const DOC_PURPOSES: readonly string[] = ['claim', 'stat', 'list', 'explainer', 'scroll-stopper', 'faculty', 'event'];
export const factsFor = (withDoc: boolean) => (withDoc ? FACTS : FACTS.filter((f) => !DOC_FACTS.includes(f))) as unknown as typeof FACTS;
export const purposesFor = (withDoc: boolean) => (withDoc ? PURPOSES : PURPOSES.filter((p) => !DOC_PURPOSES.includes(p))) as unknown as typeof PURPOSES;

// A city or venue photo can also serve as a cover's ground photo.
// `event-cover` is not a template's own purpose: it asks for the event page cover format of any template that has one.
const SATISFIES: Record<string, string[]> = { 'ground-photo': ['ground-photo', 'city-photo', 'venue-photo'] };

export type Match = {
  template: string;
  title: string;
  purpose: string;
  eligible: boolean;
  missing: string[];      // essential facts the brief does not have (never a photo: a placeholder holds its place)
  photos: string[];       // photos the requested formats draw that the brief does not have yet (placeholders until they come)
  shows: string[];        // provided facts this template puts on the piece
  unused: string[];       // provided facts this template has no place for
  score: number;
};

// Only within one brand: an Archy brief never gets a DOC template, and the other way round.
// `formats`: the ones that will be rendered (default as render: the cover alone for `event-cover`, else
// every social format); the photos to ask for are the ones those formats draw.
export async function matchTemplates(provided: string[], purpose?: string, brand: Brand = 'archy', formats?: string[]): Promise<Match[]> {
  const have = new Set(provided);
  const has = (fact: string) => (SATISFIES[fact] ?? [fact]).some((f) => have.has(f));
  const out: Match[] = [];
  for (const m of await listTemplates(brand)) {
    const c = await loadConfig(m.id);
    const cover = purpose === 'event-cover';
    if (cover ? !m.formats.cover : purpose && c.purpose !== purpose) continue;
    const facts = c.facts ?? {};
    const factOf = (slot: string) => facts[slot] ?? null;
    // The cover adds its own content (its ground photo) to the template's essentials.
    const essential = [...(c.essential ?? []), ...(cover ? c.coverEssential ?? [] : [])];
    const essentialFacts = [...new Set(essential.map(factOf).filter((f): f is string => !!f))];
    const allFacts = new Set([...essential, ...(c.optional ?? [])].map(factOf).filter((f): f is string => !!f));
    // A missing photo never makes a template ineligible: it goes out with a placeholder and the real
    // photo is asked for. Real photos still count in `shows`, so they win when the brief has them.
    const missing = essentialFacts.filter((f) => !has(f) && !/-photo$/.test(f));
    // The photos are the ones render would hold with placeholders: every essential image slot the
    // requested formats draw (a cover's own ground or guest photo only when the cover is made). A photo
    // made from another (the cover's ground from the city photo) is asked for as that one.
    const optional = new Set(c.optional ?? []);
    const wanted = formats?.length ? formats : cover ? ['cover'] : Object.keys(m.formats).filter((f) => f !== 'cover');
    const draws = (k: string) => !m.slots[k].perFormat || Object.keys(m.slots[k].perFormat!).some((key) => wanted.some((f) => key === f || key.startsWith(`${f}--`)));
    const photoSlots = Object.keys(m.slots).filter((k) => m.slots[k].type === 'image' && !optional.has(k) && draws(k)).map((k) => {
      const from = c.derive?.[k]?.from;
      return from && m.slots[from]?.type === 'image' ? from : k;
    });
    const photos = [...new Set(photoSlots.map(factOf))].filter((f): f is string => !!f && /-photo$/.test(f) && !has(f));
    const shows = provided.filter((f) => allFacts.has(f) || [...allFacts].some((a) => SATISFIES[a]?.includes(f)));
    const unused = provided.filter((f) => !shows.includes(f));
    // Use as much of the brief as possible; leaving facts out costs a little.
    const score = shows.length - 0.5 * unused.length - 2 * missing.length;
    out.push({ template: m.id, title: c.title, purpose: cover ? 'event-cover' : c.purpose ?? '', eligible: missing.length === 0, missing, photos, shows, unused, score });
  }
  return out.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
}

// The facts a set of slot values represents (to suggest alternatives when a render is refused).
export async function factsFromSlots(template: string, slots: Record<string, string | null>): Promise<string[]> {
  const c = await loadConfig(template);
  const facts = c.facts ?? {};
  return [...new Set(Object.entries(slots).filter(([, v]) => v).map(([k]) => facts[k]).filter((f): f is string => !!f))];
}
