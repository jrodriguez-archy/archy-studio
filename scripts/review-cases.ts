// The example content for Template review (and the QA): new, realistic content for every template and
// format, never the template's own sample (a template always looks right with the copy it was designed
// with). Real dental meetings with their dates, venues, city photos and partner logos (test assets in
// uploads/review-assets, see docs/review-assets.md); people keep the template's photo with simulated names
// of different lengths. Copy is never redundant and short copy is a real short line.
//
//   realistic  every fact the template takes (one event)
//   short      short copy and no optional details (another event)
//   long       the longest plausible copy (another event; review-round trims it to the template's limit)
//   theme:*    the realistic case on each Canvas theme (main format only)
import { RECOLOR, type Edits, type Preset } from '../lib/canvas-shared';
import type { Manifest, TemplateConfig } from '../lib/templates';

export type ReviewCase = { case: string; slots: Record<string, string | null>; edits: Edits };
export const THEMES: Preset[] = ['dark', 'blue', 'sky', 'ice', 'light'];
const A = (f: string) => `upload:review-assets/${f}`;

type Facts = Record<string, string | null>;
// Trade shows (booth invites, countdowns, booth covers). The partner logo names the event, so the
// cover kicker is left out when there is one.
const SHOWS: { realistic: Facts; short: Facts; long: Facts }[] = [
  {
    realistic: {
      kicker: 'Yankee Dental Congress 2027', headline: 'Meet Archy at Yankee Dental Congress', 'headline-1': 'Meet Archy at', 'headline-2': 'Yankee Dental Congress',
      city: 'Boston, MA', venue: 'Boston Convention & Exhibition Center', date: 'January 28 – 30, 2027', booth: '412', photo: A('boston.jpg'), 'logo-partner': A('logo-yankee.svg'),
      offer: 'Win an Apple Watch', countdown: 'Tomorrow is the day',
    },
    short: { kicker: 'TDA Meeting 2026', headline: 'Howdy,\nSan Antonio', 'headline-1': 'Howdy,', 'headline-2': 'San Antonio', city: 'San Antonio, TX', date: 'May 7 – 9, 2026', booth: '219', photo: A('san-antonio.jpg'), offer: 'Free coffee', countdown: 'Tomorrow!' },
    long: {
      kicker: 'Greater New York Dental Meeting 2026', headline: 'Visit the Archy team at the Greater New York Dental Meeting', 'headline-1': 'Visit the Archy team at the', 'headline-2': 'Greater New York Dental Meeting',
      city: 'New York, NY', venue: 'Jacob K. Javits Convention Center, Level 1 Exhibit Hall', date: 'November 29 – December 1, 2026', booth: '5512', photo: A('new-york.jpg'), 'logo-partner': A('logo-gnydm.png'),
      offer: 'Enter to win AirPods Pro + a year of free coffee', countdown: 'Tomorrow we open the doors',
    },
  },
  {
    realistic: {
      kicker: 'Southwest Dental Conference 2026', headline: 'Find Archy at the Southwest Dental Conference', 'headline-1': 'Find Archy at the', 'headline-2': 'Southwest Dental Conference',
      city: 'Dallas, TX', venue: 'Hilton Anatole', date: 'August 21 – 22, 2026', booth: '88', photo: A('dallas.jpg'), 'logo-partner': null,
      offer: 'Win a Yeti cooler', countdown: 'See you tomorrow',
    },
    short: { kicker: 'Yankee Dental Congress', headline: 'Hello, Boston', 'headline-1': 'Hello,', 'headline-2': 'Boston', city: 'Boston, MA', date: 'Jan 28 – 30, 2027', booth: '412', photo: A('boston.jpg'), offer: 'Free swag', countdown: 'Tomorrow!' },
    long: {
      kicker: 'The Texas Dental Association Annual Meeting', headline: 'Come see the Archy team at the 2026 TDA Meeting in San Antonio', 'headline-1': 'Come see the Archy team at', 'headline-2': 'the 2026 TDA Meeting in San Antonio',
      city: 'San Antonio, TX', venue: 'Henry B. González Convention Center, Exhibit Hall C', date: 'May 7 – 9, 2026', booth: '2219', photo: A('san-antonio.jpg'), 'logo-partner': A('logo-tda.png'),
      offer: 'Spin the wheel to win a Theragun, AirPods or a Yeti', countdown: 'Tomorrow: come say hi',
    },
  },
  {
    realistic: {
      kicker: 'Greater New York Dental Meeting', headline: 'Join Archy at the Greater New York Dental Meeting', 'headline-1': 'Join Archy at the', 'headline-2': 'Greater New York Dental Meeting',
      city: 'New York, NY', venue: 'Jacob K. Javits Convention Center', date: 'November 29 – December 1, 2026', booth: '5512', photo: A('new-york.jpg'), 'logo-partner': A('logo-gnydm.png'),
      offer: 'Win a pair of Knicks tickets', countdown: 'Tomorrow is the day',
    },
    short: { kicker: 'Southwest Dental Conference', headline: 'Hello, Dallas', 'headline-1': 'Hello,', 'headline-2': 'Dallas', city: 'Dallas, TX', date: 'Aug 21 – 22, 2026', booth: '88', photo: A('dallas.jpg'), offer: 'Free tacos', countdown: 'Tomorrow!' },
    long: {
      kicker: 'Yankee Dental Congress 2027 · Massachusetts Dental Society', headline: 'Come meet the whole Archy team at the Yankee Dental Congress in Boston', 'headline-1': 'Come meet the whole Archy team', 'headline-2': 'at the Yankee Dental Congress',
      city: 'Boston, Massachusetts', venue: 'Boston Convention & Exhibition Center, South Hall', date: 'January 28 – 30, 2027', booth: '4120', photo: A('boston.jpg'), 'logo-partner': A('logo-yankee.svg'),
      offer: 'Book a demo and win a weekend for two at the Boston Harbor Hotel', countdown: 'Tomorrow: Boston, here we come',
    },
  },
  {
    realistic: {
      kicker: 'TDA Meeting 2026', headline: 'Come see Archy at the TDA Meeting', 'headline-1': 'Come see Archy at', 'headline-2': 'the TDA Meeting',
      city: 'San Antonio, TX', venue: 'Henry B. González Convention Center', date: 'May 7 – 9, 2026', booth: '219', photo: A('san-antonio.jpg'), 'logo-partner': A('logo-tda.png'),
      offer: 'Win Spurs tickets', countdown: 'Tomorrow is the day',
    },
    short: { kicker: 'Greater New York Dental Meeting', headline: 'See you in New York', 'headline-1': 'See you in', 'headline-2': 'New York', city: 'New York, NY', date: 'Nov 29 – Dec 1', booth: '5512', photo: A('new-york.jpg'), offer: 'Free bagels', countdown: 'Tomorrow!' },
    long: {
      kicker: 'Southwest Dental Conference 2026 · Dallas County Dental Society', headline: 'Find the Archy team at the 2026 Southwest Dental Conference in Dallas', 'headline-1': 'Find the Archy team at the', 'headline-2': '2026 Southwest Dental Conference',
      city: 'Dallas, Texas', venue: 'Hilton Anatole, Chantilly Ballroom Exhibit Hall', date: 'August 21 – 22, 2026', booth: '1088', photo: A('dallas.jpg'), 'logo-partner': null,
      offer: 'Stop by for a demo and a chance to win a Big Green Egg grill', countdown: 'Tomorrow: Dallas, let’s talk practice growth',
    },
  },
];

// Hosted evenings (Topgolf works in any city: its photos stay).
const NIGHTS = {
  realistic: {
    headline: 'A Free Night Out\nFor Las Vegas Dentists', 'headline-1': 'A Free Night Out', 'headline-2': 'For Las Vegas Dentists', short: '40 Vegas dentists.\nOne night out.',
    subhead: 'Golf bays, drinks and apps at Topgolf Las Vegas', city: 'Las Vegas, NV', venue: 'Topgolf Las Vegas', date: 'Thursday, March 5', time: '6:30 – 9:00 PM',
    cta: 'Save your spot', perks: 'Free golf, appetizers and drinks', kicker: 'Archy Night Out', photo: A('las-vegas.jpg'),
  },
  short: { headline: 'Drinks on us', 'headline-1': 'Drinks', 'headline-2': 'on us', short: 'One night out.', subhead: 'Golf and drinks, on us', city: 'Boston, MA', venue: 'Topgolf Canton', date: 'Friday, February 6', photo: A('boston.jpg') },
  long: {
    headline: 'An evening of golf, drinks and good company for New York dentists', 'headline-1': 'An evening of golf and drinks', 'headline-2': 'for New York dentists and their teams',
    short: '50 New York dentists.\nOne unforgettable night.', subhead: 'Climate-controlled golf bays, an open bar and chef-made appetizers at Topgolf Chelsea Piers, on us',
    city: 'New York, NY', venue: 'Topgolf at Chelsea Piers, Pier 59', date: 'December 2, 2026', time: '7:00 – 10:00 PM',
    cta: 'Reserve your bay now', perks: 'Free golf, an open bar, chef-made appetizers, prizes & great company', kicker: 'Archy Night Out · New York', photo: A('new-york.jpg'),
  },
};

// Speaker invites: the template's portrait (a woman), simulated names and talks of different lengths.
const TALKS = {
  realistic: {
    headline: 'Hiring and Keeping Great Front Office Teams', 'headline-1': 'Hiring and Keeping', 'headline-2': 'Great Front Office Teams',
    'speaker-name': 'Dr. Laura Bennett', 'speaker-role': 'Practice Growth Coach', 'speaker-company': 'Summit Dental Partners',
    city: 'San Francisco, CA', venue: 'The Battery', datetime: 'April 16, 2026 · 6:00 pm', 'footer-note': 'Know an office manager who should hear this? Forward this invite.', kicker: 'Archy Speaker Series', photo: A('san-francisco.jpg'),
  },
  short: { headline: 'Lead with Purpose', 'headline-1': 'Lead with', 'headline-2': 'Purpose', 'speaker-name': 'Ana Ruiz', datetime: 'May 7 · 6 pm' },
  long: {
    headline: 'How Great Practices Grow: Culture, Systems and the Patient Experience', 'headline-1': 'How Great Practices Grow:', 'headline-2': 'Culture, Systems and the Patient Experience',
    'speaker-name': 'Dr. Maria Castellanos-Whitfield', 'speaker-role': 'Founder and Chief Executive Officer', 'speaker-company': 'Castellanos Whitfield Dental Group',
    city: 'San Antonio, TX', venue: 'Hotel Emma at Pearl Brewery, Sternewirth Room', datetime: 'May 7, 2026 · 6:30 – 8:30 pm',
    'footer-note': 'Know a practice owner or office manager who should hear this talk? Share this invite with them today.', kicker: 'Archy Speaker Series · San Antonio', photo: A('san-antonio.jpg'),
  },
};

// AE spotlights: the template's portrait (a man), simulated names of different lengths.
const AES = {
  realistic: { 'ae-first-name': 'Michael.', 'ae-name': 'Michael Torres', 'ae-title': 'Account Executive', 'ae-location': 'BOSTON, MA' },
  short: { 'ae-first-name': 'Ben.' },
  long: { 'ae-first-name': 'Christopher.', 'ae-name': 'Christopher Montgomery-Hayes', 'ae-title': 'Senior Enterprise Account Executive', 'ae-location': 'SAN FRANCISCO BAY AREA, CA' },
};

type Kind = 'show' | 'countdown' | 'night' | 'talk' | 'ae';
const kindOf = (id: string): Kind =>
  id.startsWith('countdown') ? 'countdown' : /night-out/.test(id) ? 'night' : /speaker/.test(id) ? 'talk' : id.startsWith('ae-') ? 'ae' : 'show';

// The value of one slot for one case, in the template's own style (a booth sticker that prints BOOTH
// takes "#412"; a line that does not, "Booth #412").
function valueFor(manifest: Manifest, kind: Kind, slot: string, facts: Facts): string | null | undefined {
  const s = manifest.slots[slot];
  const def = s.default ?? '';
  if (s.type === 'image') {
    // City photos follow the event: a show's photo band, and the city behind every event cover.
    if (/^image-(photo|venue)$/.test(slot) && (kind === 'show' || kind === 'countdown') && facts.photo) return facts.photo;
    if (slot === 'image-venue' && manifest.id.startsWith('event-cover') && facts.photo) return facts.photo;
    return undefined; // people and venues keep the template's photo
  }
  if (s.type === 'logo') return slot === 'logo-partner' ? facts['logo-partner'] ?? null : null;
  if (slot === 'booth' && facts.booth) return /^booth/i.test(def) ? `Booth #${facts.booth}` : `#${facts.booth}`;
  if (slot === 'headline' && kind === 'countdown') return facts.countdown ?? undefined;
  if (slot === 'headline' && kind === 'night' && /dentists\./i.test(def)) return facts.short ?? undefined;
  if (slot === 'offer' && facts.offer) return def === def.toUpperCase() ? facts.offer.toUpperCase() : facts.offer;
  if (slot === 'kicker' && manifest.id.startsWith('event-cover')) return undefined; // the cover's own words stay (Template review)
  const v = facts[slot];
  return v === undefined ? undefined : v;
}

export async function casesFor(manifest: Manifest, config: TemplateConfig, format: string, opts: { themes?: boolean; index?: number } = {}): Promise<ReviewCase[]> {
  void format;
  const kind = kindOf(manifest.id);
  const optional = new Set(config.optional ?? []);
  const show = SHOWS[(opts.index ?? 0) % SHOWS.length];
  const pool = kind === 'night' ? NIGHTS : kind === 'talk' ? TALKS : kind === 'ae' ? AES : show;
  const build = (facts: Facts, dropOptional: boolean) => {
    const out: Record<string, string | null> = {};
    for (const slot of Object.keys(manifest.slots)) {
      if (dropOptional && optional.has(slot)) { out[slot] = null; continue; }
      const v = valueFor(manifest, kind, slot, facts);
      if (v !== undefined) out[slot] = v;
    }
    return out;
  };
  const realistic = build(pool.realistic, false);
  const out: ReviewCase[] = [
    { case: 'realistic', slots: realistic, edits: {} },
    { case: 'short', slots: build(pool.short, true), edits: {} },
    { case: 'long', slots: build(pool.long, false), edits: {} },
  ];
  if (opts.themes) for (const p of THEMES) out.push({ case: `theme:${p}`, slots: realistic, edits: { [RECOLOR]: { preset: p } } });
  return out;
}

// What Claude does when the engine refuses copy (MCP: "keep it to N characters"): the same facts,
// written shorter, in this order. review-round tries them before calling it a finding.
const MONTHS: [RegExp, string][] = [
  [/January/g, 'Jan'], [/February/g, 'Feb'], [/March/g, 'Mar'], [/April/g, 'Apr'], [/August/g, 'Aug'],
  [/September/g, 'Sep'], [/October/g, 'Oct'], [/November/g, 'Nov'], [/December/g, 'Dec'],
];
const ALT: Record<string, string[]> = {
  'Find Archy at the': ['Find Archy at', 'Meet Archy at'],
  'Come see Archy at': ['See Archy at', 'Meet Archy at'],
  'Join Archy at the': ['Join Archy at', 'Meet Archy at'],
  'Visit the Archy team at the': ['Visit Archy at', 'Meet Archy at'],
  'Come see the Archy team at': ['See Archy at', 'Meet Archy at'],
  'Come meet the whole Archy team': ['Meet the Archy team', 'Meet Archy at'],
  'Find the Archy team at the': ['Find Archy at', 'Meet Archy at'],
  'Southwest Dental Conference': ['Southwest Dental', 'SWDC 2026'],
  'Greater New York Dental Meeting': ['Greater NY Dental Meeting', 'GNYDM 2026'],
  'Yankee Dental Congress': ['Yankee Congress', 'Yankee 2027'],
  'the TDA Meeting': ['TDA Meeting'],
  'Find Archy at the Southwest Dental Conference': ['Find Archy at Southwest Dental', 'Meet Archy in Dallas'],
  'Join Archy at the Greater New York Dental Meeting': ['Join Archy at Greater NY Dental', 'Meet Archy in New York'],
  'Come see Archy at the TDA Meeting': ['See Archy at the TDA Meeting', 'Meet Archy at TDA'],
  'Come see Archy at': ['See Archy at', 'Meet Archy at'],
  'Visit the Archy team at the Greater New York Dental Meeting': ['Visit Archy at the Greater NY Dental Meeting', 'See you at GNYDM 2026'],
  'Come see the Archy team at the 2026 TDA Meeting in San Antonio': ['See the Archy team at the 2026 TDA Meeting', 'See Archy at TDA 2026'],
  'Come meet the whole Archy team at the Yankee Dental Congress in Boston': ['Meet the Archy team at Yankee Dental Congress', 'Meet Archy at Yankee 2027'],
  'Find the Archy team at the 2026 Southwest Dental Conference in Dallas': ['Find Archy at the Southwest Dental Conference', 'Find Archy at SWDC 2026'],
  'Visit the Archy team at the': ['Visit Archy at the', 'Visit Archy at'],
  'Greater New York Dental Meeting': ['Greater NY Dental Meeting', 'GNYDM 2026'],
  'Come see the Archy team at': ['See Archy at', 'Meet Archy at'],
  'the 2026 TDA Meeting in San Antonio': ['the 2026 TDA Meeting', 'TDA Meeting 2026'],
  'at the Yankee Dental Congress': ['Yankee Dental Congress', 'Yankee 2027'],
  '2026 Southwest Dental Conference': ['Southwest Dental 2026', 'SWDC 2026'],
  'An evening of golf, drinks and good company for New York dentists': ['Golf, drinks and good company for NY dentists', 'A night out for NY dentists'],
  'An evening of golf and drinks': ['An evening of golf', 'Golf and drinks'],
  'for New York dentists and their teams': ['for New York dentists', 'for NY dentists'],
  '50 New York dentists.\nOne unforgettable night.': ['50 NY dentists.\nOne great night.', '50 dentists.\nOne night out.'],
  'Climate-controlled golf bays, an open bar and chef-made appetizers at Topgolf Chelsea Piers, on us': ['Golf bays, an open bar and appetizers at Topgolf Chelsea Piers', 'Golf, drinks and apps, on us'],
  'Free golf, an open bar, chef-made appetizers, prizes & great company': ['Free golf, an open bar, appetizers and prizes', 'Free golf, drinks and apps'],
  'How Great Practices Grow: Culture, Systems and the Patient Experience': ['How Great Practices Grow: Culture and Systems', 'How Great Practices Grow'],
  'How Great Practices Grow:': ['How Great Practices', 'Great Practices'],
  'Culture, Systems and the Patient Experience': ['Culture and Systems', 'Culture, Grown'],
  'Know a practice owner or office manager who should hear this talk? Share this invite with them today.': ['Know someone who should hear this talk? Share this invite.', 'Share this invite.'],
  'Hotel Emma at Pearl Brewery, Sternewirth Room': ['Hotel Emma at Pearl', 'Hotel Emma'],
  'Founder and Chief Executive Officer': ['Founder and CEO', 'CEO'],
  'Castellanos Whitfield Dental Group': ['Castellanos Dental Group', 'Castellanos Dental'],
  'Dr. Maria Castellanos-Whitfield': ['Dr. Maria Castellanos'],
  'Spin the wheel to win a Theragun, AirPods or a Yeti': ['Spin to win a Theragun, AirPods or a Yeti', 'Spin the wheel to win'],
  'Stop by for a demo and a chance to win a Big Green Egg grill': ['Demo + a chance to win a Big Green Egg', 'Win a Big Green Egg'],
  'Book a demo and win a weekend for two at the Boston Harbor Hotel': ['Book a demo, win a Boston Harbor weekend', 'Win a Boston weekend'],
  'Enter to win AirPods Pro + a year of free coffee': ['Win AirPods Pro + free coffee', 'Win AirPods Pro'],
  'Tomorrow: Boston, here we come': ['Tomorrow: Boston!', 'Tomorrow!'],
  'Tomorrow: Dallas, let’s talk practice growth': ['Tomorrow: Dallas!', 'Tomorrow!'],
  'Tomorrow we open the doors': ['Tomorrow we open', 'Tomorrow!'],
  'Tomorrow: come say hi': ['Tomorrow: say hi', 'Tomorrow!'],
  'Senior Enterprise Account Executive': ['Senior Account Executive', 'Account Executive'],
  'SAN FRANCISCO BAY AREA, CA': ['SAN FRANCISCO, CA', 'SF BAY AREA'],
  'Meet Archy at Yankee Dental Congress': ['Meet Archy at Yankee', 'Meet Archy in Boston'],
  'Hiring and Keeping Great Front Office Teams': ['Hiring and Keeping Great Teams', 'Building Great Teams'],
  'Hiring and Keeping': ['Hiring and', 'Building'],
  'Great Front Office Teams': ['Great Teams'],
  'For Las Vegas Dentists': ['For Vegas Dentists'],
  'A Free Night Out\nFor Las Vegas Dentists': ['A Free Night Out\nFor Vegas Dentists'],
  'Southwest Dental Conference 2026': ['Southwest Dental Conference', 'SWDC 2026'],
  'Greater New York Dental Meeting 2026': ['Greater NY Dental Meeting', 'GNYDM 2026'],
  'Yankee Dental Congress 2027': ['Yankee Dental Congress', 'Yankee 2027'],
};
export function shorter(slot: string, value: string): string[] {
  const key = Object.keys(ALT).find((k) => k.toLowerCase() === value.toLowerCase());
  const upper = value === value.toUpperCase() && /[A-Z]/.test(value);
  const out: string[] = [...(key ? ALT[key].map((v) => (upper ? v.toUpperCase() : v)) : [])];
  if (slot === 'date' || slot === 'datetime') {
    let v = value.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), /, '').replace(/– (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), /, '– ');
    if (v !== value) out.push(v);
    for (const [re, abbr] of MONTHS) v = v.replace(re, abbr);
    out.push(v, v.replace(/,? 20\d\d/, ''));
  }
  if (slot === 'venue') {
    const cut = value.split(',')[0];
    out.push(cut, cut.replace('Convention & Exhibition Center', 'Convention Center').replace('Jacob K. Javits', 'Javits'));
  }
  if (slot === 'kicker') out.push(value.split(' · ')[0], value.split(' · ')[0].replace(/\s20\d\d$/, ''));
  if (slot === 'city') out.push(value.replace(/, (Massachusetts|Texas|Georgia)$/, (m) => ({ ', Massachusetts': ', MA', ', Texas': ', TX', ', Georgia': ', GA' } as Record<string, string>)[m]));
  return [...new Set(out)].filter((v) => v && v !== value);
}

// Every design × theme a template draws (one entry, the base formats, on single-design templates). `key`
// is null for the default; a review or QA item of another one is keyed `<format>--<design>--<theme>`.
export function combosOf(manifest: Manifest) {
  const base = { key: null as string | null, design: manifest.default?.design ?? null, theme: manifest.default?.theme ?? null, formats: manifest.formats };
  return [base, ...Object.entries(manifest.combos ?? {}).map(([key, c]) => ({ key, design: c.design as string | null, theme: c.theme as string | null, formats: c.formats }))];
}
export const comboFormat = (format: string, key: string | null) => (key ? `${format}--${key}` : format);
