import { describe, expect, it } from 'vitest';
import { matchTemplates } from '@/lib/match';

// photos_to_ask_for: every essential photo the formats to be rendered draw, cover photos only for the cover.
// Photos never block eligibility (a placeholder holds their place).
const brief = ['event-name', 'city', 'venue', 'date', 'time', 'booth', 'speaker'];
const photosOf = async (purpose?: string, formats?: string[]) =>
  Object.fromEntries((await matchTemplates(brief, purpose, 'archy', formats)).map((m) => [m.template, m]));

describe('match_templates photos_to_ask_for', () => {
  it('social formats ask only for the photos they draw, never the cover ground', async () => {
    const m = await photosOf();
    expect(m['night-out-scorecard'].photos).toEqual([]);
    expect(m['night-out-illustration'].photos).toEqual([]);
    expect(m['booth-icon-list'].photos).toEqual([]);
    expect(m['speaker-invite'].photos).toEqual(['speaker-photo']);
    expect(m['night-out-venue'].photos).toEqual(['venue-photo']);
  });

  it('the cover asks for its own ground and guest photos', async () => {
    const m = await photosOf('event-cover');
    expect(m['night-out-scorecard'].photos.sort()).toEqual(['ground-photo', 'venue-photo']);
    expect(m['night-out-illustration'].photos.sort()).toEqual(['ground-photo', 'guest-photo']);
    expect(m['booth-icon-list'].photos).toEqual(['ground-photo']);
    expect(m['speaker-invite'].photos.sort()).toEqual(['ground-photo', 'speaker-photo']);
  });

  it('social formats plus the cover ask for both, and photos never block', async () => {
    const m = await photosOf(undefined, ['post', 'cover']);
    expect(m['night-out-illustration'].photos.sort()).toEqual(['ground-photo', 'guest-photo']);
    expect(m['speaker-invite'].photos.sort()).toEqual(['ground-photo', 'speaker-photo']);
    for (const t of ['night-out-scorecard', 'night-out-illustration', 'booth-icon-list', 'speaker-invite']) expect(m[t].eligible).toBe(true);
  });

  it('a photo the brief has is not asked for; a city photo serves as the ground', async () => {
    const m = Object.fromEntries((await matchTemplates([...brief, 'city-photo'], 'event-cover')).map((x) => [x.template, x]));
    expect(m['booth-icon-list'].photos).toEqual([]);
    expect(m['booth-invite-photo'].photos).toEqual([]);
  });
});
