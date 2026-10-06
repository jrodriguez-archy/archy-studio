import 'server-only';
import { listTemplates, loadConfig, type Manifest, type TemplateConfig } from './templates';

// Top-level groups, in catalog order. New ones (social, decks...) are added here as templates arrive.
export const CATEGORY_LABEL: Record<string, string> = { events: 'Events', ads: 'Ads' };

export const PURPOSE_LABEL: Record<string, string> = {
  'booth-invite': 'Booth invite',
  reminder: 'Day-before reminder',
  'hosted-evening': 'Hosted evening',
  'speaker-invite': 'Speaker invite',
  'event-cover': 'Event page cover',
  spotlight: 'Person spotlight',
};

// The catalog's two levels: big categories (where a template comes from) and, inside each, what the
// piece is for. Add a category here and give its templates that category and purpose in their config.
export const TAXONOMY: { key: string; label: string; description: string; purposes: string[] }[] = [
  { key: 'events', label: 'Events', description: 'Trade shows, booths, talks and evenings Archy hosts.', purposes: ['booth-invite', 'reminder', 'hosted-evening', 'speaker-invite'] },
  { key: 'ads', label: 'Ads', description: 'Paid social and person-led ads.', purposes: ['spotlight'] },
];

// Section titles on the Templates page.
export const PURPOSE_PLURAL: Record<string, string> = {
  'booth-invite': 'Booth invites', reminder: 'Day-before reminders', 'hosted-evening': 'Hosted evenings',
  'speaker-invite': 'Speaker invites', 'event-cover': 'Event page covers', spotlight: 'Spotlights',
};

export const FACT_LABEL: Record<string, string> = {
  'event-name': 'Event name', city: 'City', venue: 'Venue', date: 'Date', time: 'Time', booth: 'Booth',
  'city-photo': 'City photo', 'venue-photo': 'Venue photo', 'ground-photo': 'City or venue photo', 'guest-photo': 'Guests photo',
  speaker: 'Speaker name', 'speaker-photo': 'Speaker photo', 'speaker-role': 'Speaker role', 'speaker-company': 'Speaker company',
  offer: 'Offer', 'offer-logo': 'Offer logo', 'partner-logo': 'Partner logo',
  person: 'Name', 'person-title': 'Title', 'person-photo': 'Photo (cutout)',
};

export type CatalogItem = { manifest: Manifest; config: TemplateConfig; formats: string[]; needs: string[]; extras: string[] };

// What a template needs from a brief (essential facts) and what it can also show (optional facts).
export async function catalog(): Promise<CatalogItem[]> {
  const items = await Promise.all((await listTemplates()).map(async (manifest) => {
    const config = await loadConfig(manifest.id);
    const fact = (s: string) => config.facts?.[s] ?? null;
    const needs = [...new Set((config.essential ?? []).map(fact).filter((f): f is string => !!f))];
    const extras = [...new Set((config.optional ?? []).map(fact).filter((f): f is string => !!f && !needs.includes(f)))];
    return { manifest, config, formats: Object.keys(manifest.formats), needs, extras };
  }));
  const cats = Object.keys(CATEGORY_LABEL);
  const order = Object.keys(PURPOSE_LABEL);
  return items.sort((a, b) => cats.indexOf(a.config.category ?? '') - cats.indexOf(b.config.category ?? '') || order.indexOf(a.config.purpose ?? '') - order.indexOf(b.config.purpose ?? '') || a.config.title.localeCompare(b.config.title));
}

export const titleOf = async (id: string) => {
  try { return (await loadConfig(id)).title; } catch { return id; }
};
