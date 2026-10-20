import { describe, expect, it } from 'vitest';
import { pickExplorations, type ExplorationRow } from '../lib/explore-round';

const row = (id: string, set: string | null, format: string, at: string, parent: string | null = null): ExplorationRow =>
  ({ id, set_id: set, set_title: null, format, storage_path: `${id}.png`, width: 1080, height: 1350, user_id: null, parent_id: parent, created_at: at });

describe('pickExplorations', () => {
  it('keeps the newest render of each format in each set, newest set first', () => {
    const picked = pickExplorations([
      row('a1', 'A', 'post', '2026-10-01T10:00:00Z'), row('a2', 'A', 'post', '2026-10-01T11:00:00Z'), row('a3', 'A', 'stories', '2026-10-01T10:30:00Z'),
      row('b1', 'B', 'post', '2026-10-02T09:00:00Z'), row('solo', null, 'post', '2026-09-30T09:00:00Z'),
    ], new Set());
    expect(picked.map((r) => r.id)).toEqual(['b1', 'a2', 'a3', 'solo']);
  });

  it('leaves out renders already in a round and the Canvas corrections of those', () => {
    const picked = pickExplorations([
      row('a1', 'A', 'post', '2026-10-01T10:00:00Z'), row('fix', 'A', 'post', '2026-10-03T10:00:00Z', 'a1'), row('a3', 'A', 'stories', '2026-10-01T10:30:00Z'),
    ], new Set(['a1']));
    expect(picked.map((r) => r.id)).toEqual(['a3']);
  });
});
