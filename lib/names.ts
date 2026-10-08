// How a person is called in Studio. Their own name when they set it (Account), else one made from
// their email: "juan.rodriguez" → "Juan Rodriguez", "jrodriguez" → "J. Rodriguez".
// "o'brien" → "O'Brien".
const cap = (w: string) => w.toLowerCase().replace(/(^|['’])\p{L}/gu, (m) => m.toUpperCase());

export function nameFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? '').replace(/\+.*/, '').replace(/\d+/g, '');
  const words = local.split(/[._-]+/).filter(Boolean);
  // "j.rodriguez": an initial keeps its period.
  if (words.length > 1) return words.map((w) => (w.length === 1 ? `${w.toUpperCase()}.` : cap(w))).join(' ');
  const w = words[0] ?? '';
  // One word, first initial then surname (the common company pattern).
  return w.length > 3 && !/['’]/.test(w) ? `${w.charAt(0).toUpperCase()}. ${cap(w.slice(1))}` : cap(w);
}

export function displayName(fullName: string | null | undefined, email: string | null | undefined): string {
  const local = email?.split('@')[0] ?? '';
  const own = fullName?.trim();
  // A name equal to the email's first part was filled in automatically: the nicer one is used.
  if (own && own.toLowerCase() !== local.toLowerCase()) return own;
  return (email && nameFromEmail(email)) || own || 'Studio';
}

// The first name, for tight places (the sidebar); an initial alone ("J.") keeps the surname.
export function firstName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  return /^\p{L}\.?$/u.test(first ?? '') && rest.length ? `${first} ${rest[0]}` : first ?? name;
}
