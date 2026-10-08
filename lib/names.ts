// How a person is called in Studio. Their own name when they set it (Account), else one made from
// their email: "juan.rodriguez" → "Juan Rodriguez", "jrodriguez" → "J. Rodriguez".
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

export function nameFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? '').replace(/\d+/g, '');
  const words = local.split(/[._-]+/).filter(Boolean);
  if (words.length > 1) return words.map(cap).join(' ');
  const w = words[0] ?? '';
  // One word, first initial then surname (the common company pattern).
  return w.length > 3 ? `${w.charAt(0).toUpperCase()}. ${cap(w.slice(1))}` : cap(w);
}

export function displayName(fullName: string | null | undefined, email: string | null | undefined): string {
  const local = email?.split('@')[0] ?? '';
  const own = fullName?.trim();
  // A name equal to the email's first part was filled in automatically: the nicer one is used.
  if (own && own.toLowerCase() !== local.toLowerCase()) return own;
  return email ? nameFromEmail(email) : own || 'Studio';
}

// The first name, for tight places (the sidebar); an initial alone ("J.") keeps the surname.
export function firstName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  return /^\p{L}\.?$/u.test(first ?? '') && rest.length ? `${first} ${rest[0]}` : first ?? name;
}
