import { describe, expect, it } from 'vitest';
import { linkKey } from '@/lib/keep-image';

const key = (s: string) => linkKey(new URL(s));

describe('linkKey', () => {
  it('tells Drive files apart', () => {
    expect(key('https://drive.google.com/uc?export=download&id=A')).not.toBe(key('https://drive.google.com/uc?export=download&id=B'));
    expect(key('https://drive.usercontent.google.com/download?id=A&export=view')).not.toBe(key('https://drive.usercontent.google.com/download?id=B&export=view'));
  });
  it('keeps one file however long its signature lasts', () => {
    expect(key('https://bucket.s3.amazonaws.com/a.png?X-Amz-Signature=1&X-Amz-Expires=60')).toBe(key('https://bucket.s3.amazonaws.com/a.png?X-Amz-Signature=2&X-Amz-Expires=3600'));
    expect(key('https://x.supabase.co/storage/v1/object/sign/a.png?token=abc')).toBe(key('https://x.supabase.co/storage/v1/object/sign/a.png?token=def'));
    expect(key('https://example.com/a.png?b=2&a=1')).toBe(key('https://example.com/a.png?a=1&b=2'));
    expect(key('https://example.com/a.png')).toBe('link:https://example.com/a.png');
  });
});
