import 'server-only';
import { currentBrand } from './brand';
import type { Brand } from './brands';
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
  'photo-claim': 'Photo ad',
  claim: 'Claim and CTA',
  stat: 'One number',
  'save-the-date': 'Save the date',
};

// The catalog's two levels: big categories (where a template comes from) and, inside each, what the
// piece is for. Add a category here and give its templates that category and purpose in their config.
// Each brand has its own categories (keys can repeat across brands).
export const TAXONOMY: { brand: Brand; key: string; label: string; description: string; purposes: string[] }[] = [
  { brand: 'archy', key: 'events', label: 'Events', description: 'Trade shows, booths, talks and evenings Archy hosts.', purposes: ['booth-invite', 'reminder', 'hosted-evening', 'speaker-invite'] },
  { brand: 'archy', key: 'ads', label: 'Ads', description: 'Paid social: person-led and photo-led ads.', purposes: ['spotlight', 'photo-claim'] },
  { brand: 'doc', key: 'ads', label: 'Ads', description: 'DOC paid social in five themes: the three tracks, Dark and Light.', purposes: ['claim', 'stat', 'save-the-date'] },
];

// Section titles on the Templates page.
export const PURPOSE_PLURAL: Record<string, string> = {
  'booth-invite': 'Booth invites', reminder: 'Day-before reminders', 'hosted-evening': 'Hosted evenings',
  'speaker-invite': 'Speaker invites', 'event-cover': 'Event page covers', spotlight: 'Spotlights', 'photo-claim': 'Photo ads',
  claim: 'Claims', stat: 'Numbers', 'save-the-date': 'Save the dates',
};

export const FACT_LABEL: Record<string, string> = {
  'event-name': 'Event name', city: 'City', venue: 'Venue', date: 'Date', time: 'Time', booth: 'Booth',
  'city-photo': 'City photo', 'venue-photo': 'Venue photo', 'ground-photo': 'City or venue photo', 'guest-photo': 'Guests photo',
  speaker: 'Speaker name', 'speaker-photo': 'Speaker photo', 'speaker-role': 'Speaker role', 'speaker-company': 'Speaker company',
  'partner-logo': 'Partner logo',
  person: 'Name', 'person-title': 'Title', 'person-photo': 'Photo (cutout)', 'ad-photo': 'Ad photo (a scene)',
  stat: 'Figure (a real number)',
};

export type CatalogItem = { manifest: Manifest; config: TemplateConfig; formats: string[]; needs: string[]; extras: string[] };

// What a template needs from a brief (essential facts) and what it can also show (optional facts).
// One brand's templates (the one the person works in, by default), or 'all'.
export async function catalog(brand?: Brand | 'all'): Promise<CatalogItem[]> {
  const b = brand === 'all' ? undefined : brand ?? (await currentBrand());
  const items = await Promise.all((await listTemplates(b)).map(async (manifest) => {
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
