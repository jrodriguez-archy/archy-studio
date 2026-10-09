import { listTemplates, loadConfig } from './templates';

// Facts a brief can bring. Copy (headlines, subheads, CTAs) is written from the brief, so it is not a fact.
export const FACTS = [
  'event-name', 'city', 'venue', 'date', 'time', 'booth', 'city-photo', 'venue-photo', 'ground-photo', 'guest-photo',
  'speaker', 'speaker-photo', 'speaker-role', 'speaker-company', 'partner-logo',
  'person', 'person-title', 'person-photo', 'ad-photo',
] as const;

export const PURPOSES = ['booth-invite', 'reminder', 'hosted-evening', 'speaker-invite', 'event-cover', 'spotlight', 'photo-claim'] as const;

// A city or venue photo can also serve as a cover's ground photo.
// `event-cover` is not a template's own purpose: it asks for the event page cover format of any template that has one.
const SATISFIES: Record<string, string[]> = { 'ground-photo': ['ground-photo', 'city-photo', 'venue-photo'] };

export type Match = {
  template: string;
  title: string;
  purpose: string;
  eligible: boolean;
  missing: string[];      // essential facts the brief does not have
  shows: string[];        // provided facts this template puts on the piece
  unused: string[];       // provided facts this template has no place for
  score: number;
};

export async function matchTemplates(provided: string[], purpose?: string): Promise<Match[]> {
  const have = new Set(provided);
  const has = (fact: string) => (SATISFIES[fact] ?? [fact]).some((f) => have.has(f));
  const out: Match[] = [];
  for (const m of await listTemplates()) {
    const c = await loadConfig(m.id);
    const cover = purpose === 'event-cover';
    if (cover ? !m.formats.cover : purpose && c.purpose !== purpose) continue;
    const facts = c.facts ?? {};
    const factOf = (slot: string) => facts[slot] ?? null;
    // The cover adds its own content (its ground photo) to the template's essentials.
    const essential = [...(c.essential ?? []), ...(cover ? c.coverEssential ?? [] : [])];
    const essentialFacts = [...new Set(essential.map(factOf).filter((f): f is string => !!f))];
    const allFacts = new Set([...essential, ...(c.optional ?? [])].map(factOf).filter((f): f is string => !!f));
    const missing = essentialFacts.filter((f) => !has(f));
    const shows = provided.filter((f) => allFacts.has(f) || [...allFacts].some((a) => SATISFIES[a]?.includes(f)));
    const unused = provided.filter((f) => !shows.includes(f));
    // Use as much of the brief as possible; leaving facts out costs a little.
    const score = shows.length - 0.5 * unused.length - 2 * missing.length;
    out.push({ template: m.id, title: c.title, purpose: cover ? 'event-cover' : c.purpose ?? '', eligible: missing.length === 0, missing, shows, unused, score });
  }
  return out.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
}

// The facts a set of slot values represents (to suggest alternatives when a render is refused).
export async function factsFromSlots(template: string, slots: Record<string, string | null>): Promise<string[]> {
  const c = await loadConfig(template);
  const facts = c.facts ?? {};
  return [...new Set(Object.entries(slots).filter(([, v]) => v).map(([k]) => facts[k]).filter((f): f is string => !!f))];
}
