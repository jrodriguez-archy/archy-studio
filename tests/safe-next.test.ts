import { describe, expect, it } from 'vitest';
import { safeNext } from '@/lib/safe-next';

describe('safeNext', () => {
  it('keeps paths of this app', () => {
    for (const ok of ['/', '/canvas/abc?latest=1', '/oauth/consent?authorization_id=x', '/templates?t=booth-icon-list#top']) expect(safeNext(ok)).toBe(ok);
  });
  it('never sends anyone to another site', () => {
    for (const bad of ['//evil.com', '/\\evil.com', '/\\/evil.com', '/\t/evil.com', '/\n/evil.com', 'https://evil.com', 'evil.com', 'javascript:alert(1)', '', null, undefined]) expect(safeNext(bad as string)).toBe('/');
  });
});
