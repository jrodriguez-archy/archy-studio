// The editor's server calls and the small pure helpers it keys its state with.
import type { libraryAction as LibraryCall, prepareAction as PrepareCall, saveDraftAction as DraftCall } from '@/app/(app)/canvas/actions';
import { cleanEdits } from '@/lib/canvas-shared';
import type { Snap } from '@/lib/canvas-sync';

// Canvas's light server calls, side by side (server actions would run one at a time): /api/canvas/live.
async function live(kind: string, args: unknown[]) {
  const r = await fetch('/api/canvas/live', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, args }) });
  // The same answers the actions gave: signed out, or any failure, comes back as { ok: false, error }.
  if (r.status === 401) return { ok: false, error: 'Sign in again.' };
  return r.json().catch(() => ({ ok: false, error: 'Something went wrong. Try again.' }));
}
export const prepareAction = (...a: Parameters<typeof PrepareCall>): ReturnType<typeof PrepareCall> => live('prepare', a);
export const saveDraftAction = (...a: Parameters<typeof DraftCall>): ReturnType<typeof DraftCall> => live('draft', a);
export const libraryAction = (): ReturnType<typeof LibraryCall> => live('library', []);

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const cleanSnap = (s: Snap) => ({ slots: s.slots, edits: cleanEdits(s.edits) });
// Key order ignored: a draft read back from the database (jsonb) compares equal to the one sent.
export const canon = (v: unknown) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
export const luminance = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
export const planKeyOf = (s: Snap) => JSON.stringify([s.slots, Object.values(s.edits).flatMap((e) => [e.image, e.icon]).filter(Boolean).sort()]);
