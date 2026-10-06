import 'server-only';
import { listTemplates, loadConfig, type Manifest, type TemplateConfig } from './templates';

export const PURPOSE_LABEL: Record<string, string> = {
  'booth-invite': 'Booth invite',
  reminder: 'Day-before reminder',
  'hosted-evening': 'Hosted evening',
  'speaker-invite': 'Speaker invite',
  'event-cover': 'Event page cover',
  spotlight: 'Person spotlight',
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
  const order = Object.keys(PURPOSE_LABEL);
  return items.sort((a, b) => order.indexOf(a.config.purpose ?? '') - order.indexOf(b.config.purpose ?? '') || a.config.title.localeCompare(b.config.title));
}

export const titleOf = async (id: string) => {
  try { return (await loadConfig(id)).title; } catch { return id; }
};
