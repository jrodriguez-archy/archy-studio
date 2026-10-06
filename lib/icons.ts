import 'server-only';

// Hugeicons (free, Stroke Rounded): the icon set of the Archy templates. Read on the server only (the
// package holds thousands of icons). Icons are referenced by their export name, e.g. "Calendar03Icon".

type IconNode = [string, Record<string, string>][];
let all: Map<string, IconNode> | null = null;

async function icons() {
  if (all) return all;
  const mod = (await import('@hugeicons/core-free-icons')) as unknown as Record<string, IconNode>;
  const seen = new Set<string>();
  all = new Map();
  for (const [name, node] of Object.entries(mod)) {
    if (!name.endsWith('Icon') || !Array.isArray(node)) continue;
    const key = JSON.stringify(node);
    if (seen.has(key)) continue; // aliases of the same drawing
    seen.add(key);
    all.set(name, node);
  }
  return all;
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// The drawing only (no <svg> wrapper), stroked with currentColor so it takes the layer's colour.
export async function iconMarkup(name: string): Promise<string | null> {
  const node = (await icons()).get(name);
  if (!node) return null;
  return node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${kebab(k)}="${esc(String(v))}"`).join(' ')} />`).join('');
}

// "calendar" → Calendar01Icon, Calendar03Icon… Every word must match; shorter names first.
export async function searchIcons(q: string, limit = 60): Promise<{ name: string; label: string }[]> {
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const out: { name: string; label: string }[] = [];
  for (const name of (await icons()).keys()) {
    const label = name.slice(0, -4).replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();
    if (words.every((w) => label.includes(w))) out.push({ name, label });
  }
  return out.sort((a, b) => a.label.length - b.label.length).slice(0, limit);
}

// The icons the templates already use, offered first.
export const SUGGESTED = [
  'Calendar03Icon', 'Clock01Icon', 'Location01Icon', 'UserGroupIcon', 'Settings01Icon', 'ArrowRight02Icon',
  'ArrowUpRight01Icon', 'Ticket01Icon', 'GiftIcon', 'StarIcon', 'Mail01Icon', 'Call02Icon',
  'Globe02Icon', 'Tick02Icon', 'SparklesIcon', 'Coffee01Icon', 'DrinkIcon', 'Restaurant01Icon',
  'Building03Icon', 'Store01Icon', 'DentalToothIcon', 'Calendar01Icon', 'Megaphone01Icon', 'Analytics01Icon',
];
