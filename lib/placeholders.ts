import 'server-only';
import crypto from 'node:crypto';
import { useAi } from './assets';
import { generateImage } from './generate';
import { supabaseAdmin } from './supabase/admin';

// Placeholder photos: a design never waits for a photo. A missing city, venue or guest photo is filled
// with a photo close to the brief (Unsplash, else one made with AI, else a neutral image), and the answer
// says which ones are placeholders so the real ones can be sent, uploaded to Assets or swapped in Canvas.
// A photo of a specific person (an AE, a speaker) is never a stand-in: a neutral silhouette holds its place.

// Neutral images in library/placeholders (the last resort, and every person's photo).
export const STATIC: Record<'scene' | 'person', string> = { scene: 'placeholder:scene', person: 'placeholder:person' };
const PERSON = new Set(['person-photo', 'speaker-photo']);
// A staged photo that is the idea of the piece (DOC's Object Photo) is never a stock stand-in: a neutral image.
const NEUTRAL = new Set(['object-photo']);
// Stored placeholders live apart from the team's images (never in Assets).
const DIR = 'placeholders';

export const isPhotoFact = (fact: string | null | undefined) => !!fact && /-photo$/.test(fact);
export const isPlaceholder = (v: string | null | undefined) => !!v && (v.startsWith('placeholder:') || v.startsWith(`upload:${DIR}/`));
export const staticPlaceholder = (fact: string | null | undefined) => (fact && PERSON.has(fact) ? STATIC.person : STATIC.scene);

// What to look for: the place and the kind of moment, from the facts the brief brought.
function queryFor(fact: string, slots: Record<string, string | null>, purpose?: string) {
  const city = slots.city?.split(',')[0].trim();
  const evening = purpose === 'hosted-evening';
  if (fact === 'guest-photo') return evening ? 'friends dinner toast restaurant' : 'people networking event';
  if (fact === 'venue-photo') return evening ? 'restaurant interior evening' : 'convention center hall';
  // A city or a cover's ground: the city when known.
  return city ? `${city} city skyline` : evening ? 'restaurant interior evening' : 'convention center hall';
}

export type Placeholder = { slot: string; value: string; source: 'unsplash' | 'ai' | 'neutral'; credit?: string; query?: string };

export async function photoPlaceholder(input: { slot: string; fact: string | null; slots: Record<string, string | null>; purpose?: string; userId?: string | null }): Promise<Placeholder> {
  const { slot, fact } = input;
  if (!fact || PERSON.has(fact) || NEUTRAL.has(fact)) return { slot, value: staticPlaceholder(fact), source: 'neutral' };
  const query = queryFor(fact, input.slots, input.purpose);
  const key = crypto.createHash('sha1').update(query).digest('hex').slice(0, 16);
  // The same search gives the same photo (stored once).
  const known = await stored(key);
  if (known) return { slot, value: `upload:${known.path}`, source: known.source, credit: known.credit, query };
  try {
    const u = await fromUnsplash(query);
    if (u) {
      const path = await store(key, 'unsplash', u.body);
      return { slot, value: `upload:${path}`, source: 'unsplash', credit: u.credit, query };
    }
  } catch { /* next source */ }
  try {
    if (input.userId && (await useAi(input.userId, 'generate'))) {
      const png = await generateImage(`A photo for a placeholder: ${query}.`, '4:5');
      const path = await store(key, 'ai', png);
      return { slot, value: `upload:${path}`, source: 'ai', query };
    }
  } catch { /* neutral */ }
  return { slot, value: STATIC.scene, source: 'neutral', query };
}

async function fromUnsplash(query: string): Promise<{ body: Buffer; credit: string } | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const headers = { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' };
  const res = await fetch(`https://api.unsplash.com/search/photos?${new URLSearchParams({ query, per_page: '5', content_filter: 'high' })}`, { headers });
  if (!res.ok) return null;
  const hit = (await res.json()).results?.[0] as { urls: { raw: string }; links: { download_location: string }; user: { name: string } } | undefined;
  if (!hit) return null;
  const img = await fetch(`${hit.urls.raw}&w=2000&q=80&fm=jpg`);
  if (!img.ok) return null;
  // Unsplash asks for a download to be counted when a photo is used.
  fetch(hit.links.download_location, { headers }).catch(() => {});
  return { body: Buffer.from(await img.arrayBuffer()), credit: `Photo by ${hit.user.name} on Unsplash` };
}

async function stored(key: string): Promise<{ path: string; source: 'unsplash' | 'ai'; credit?: string } | null> {
  const { data } = await supabaseAdmin().storage.from('uploads').list(DIR, { search: key, limit: 1 });
  const f = data?.[0];
  if (!f) return null;
  const meta = (f.metadata ?? {}) as { source?: string };
  return { path: `${DIR}/${f.name}`, source: f.name.includes('-ai') || meta.source === 'ai' ? 'ai' : 'unsplash' };
}

async function store(key: string, source: 'unsplash' | 'ai', body: Buffer): Promise<string> {
  const path = `${DIR}/${key}-${source}.${source === 'ai' ? 'png' : 'jpg'}`;
  const { error } = await supabaseAdmin().storage.from('uploads').upload(path, body, { contentType: source === 'ai' ? 'image/png' : 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

// One line for the answer: which photos are placeholders and how to replace them.
export function placeholderNote(list: Placeholder[]) {
  if (!list.length) return '';
  const what = list.map((p) => `${p.slot} (${p.source === 'unsplash' ? `Unsplash, "${p.query}"` : p.source === 'ai' ? `made with AI, "${p.query}"` : 'a neutral placeholder'})`).join(', ');
  return `Placeholder photos, not the real ones: ${what}. Tell the requester and ask for the real photos: an https link, an image uploaded in Studio → Assets (give its ID), or replaced by hand in Canvas. Render again with the same set when they arrive.`;
}
