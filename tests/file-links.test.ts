import { afterEach, describe, expect, it, vi } from 'vitest';
import { directFileLink, directFileOk } from '@/lib/file-links';

const parts = (link: string) => { const u = new URL(link); return [u.searchParams.get('exp'), u.searchParams.get('sig')] as const; };

describe('file links', () => {
  afterEach(() => { delete process.env.FILE_LINK_SECRET; delete process.env.SUPABASE_SECRET_KEY; vi.useRealTimers(); });
  it('signs with its own secret and keeps links made before it working', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    process.env.SUPABASE_SECRET_KEY = 'legacy';
    const old = parts(directFileLink('https://s', 'abc'));
    process.env.FILE_LINK_SECRET = 'own';
    const now = parts(directFileLink('https://s', 'abc'));
    expect(now[1]).not.toBe(old[1]);
    expect(directFileOk('abc', ...now)).toBe(true);
    expect(directFileOk('abc', ...old)).toBe(true);
    expect(directFileOk('other', ...now)).toBe(false);
  });
  it('stops taking links signed the old way once they would all have expired', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    process.env.SUPABASE_SECRET_KEY = 'legacy';
    const late = parts(directFileLink('https://s', 'abc')); // exp after the cutoff
    expect(directFileOk('abc', ...late)).toBe(true); // no own secret yet: still the key that signs
    process.env.FILE_LINK_SECRET = 'own';
    expect(directFileOk('abc', ...late)).toBe(false);
  });
  it('refuses expired and forged links', () => {
    process.env.FILE_LINK_SECRET = 'own';
    const [exp, sig] = parts(directFileLink('https://s', 'abc'));
    expect(directFileOk('abc', '1000', sig)).toBe(false);
    expect(directFileOk('abc', exp, 'forged')).toBe(false);
  });
});
