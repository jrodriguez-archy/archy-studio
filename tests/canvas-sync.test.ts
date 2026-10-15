import { describe, expect, it } from 'vitest';
import { cleanEdits, RECOLOR } from '@/lib/canvas-shared';
import { boothLike, carried, follow, mergeOnto, splitHeadline, type Keys, type Snap } from '@/lib/canvas-sync';

const snap = (slots: Snap['slots'] = {}, edits: Snap['edits'] = {}): Snap => ({ slots, edits });

describe('cleanEdits', () => {
  it('keeps typed rich copy', () => {
    expect(cleanEdits({ a: { text: 'Hi there', html: 'Hi <b>there</b>' } })).toEqual({ a: { text: 'Hi there', html: 'Hi <b>there</b>' } });
  });
  it('drops empty moves and styles', () => {
    expect(cleanEdits({ a: { box: { dx: 0, dy: 0, scale: 1 }, style: { color: '' } } })).toEqual({});
  });
});

describe('mergeOnto', () => {
  it('lays what changed since the base over the newer draft', () => {
    const base = snap({ headline: 'Old' }, { x1: { text: 'a' } });
    const theirs = snap({ headline: 'Old', subline: 'Theirs' }, { x1: { text: 'a' }, x2: { hidden: true } });
    const mine = snap({ headline: 'Mine' }, { x1: { text: 'b' } });
    expect(mergeOnto(theirs, base, mine)).toEqual(snap({ headline: 'Mine', subline: 'Theirs' }, { x1: { text: 'b' }, x2: { hidden: true } }));
  });
  it('removes an edit that mine took away', () => {
    const base = snap({}, { x1: { hidden: true } });
    expect(mergeOnto(snap({}, { x1: { hidden: true }, x3: { text: 'k' } }), base, snap({}, {})).edits).toEqual({ x3: { text: 'k' } });
  });
  it('changes nothing when mine is the base', () => {
    const theirs = snap({ a: '1' }, { x: { text: 't' } });
    expect(mergeOnto(theirs, snap({ a: '0' }), snap({ a: '0' }))).toEqual(theirs);
  });
});

describe('follow', () => {
  const src: Keys = { root: { key: ':root' }, s1: { key: 'name:Headline#1', fontSize: 80 }, s2: { key: 'own:s2:1' } };
  const dst: Keys = { root: { key: ':root' }, d1: { key: 'name:Headline#1', fontSize: 40 }, d2: { key: 'own:d2:2' } };
  it('follows a named layer, its size in proportion within the target range', () => {
    const out = follow(snap(), snap({}, { s1: { text: 'New', style: { fontSize: 88 } } }), snap(), src, dst);
    expect(out.edits.d1).toEqual({ text: 'New', style: { fontSize: 44 } });
  });
  it('never follows an unnamed layer to another format', () => {
    const out = follow(snap(), snap({}, { s2: { text: 'x' } }), snap(), src, dst);
    expect(out.edits).toEqual({});
  });
  it('carries the recolour and rich copy', () => {
    const out = follow(snap(), snap({}, { [RECOLOR]: { preset: 'dark' }, s1: { html: 'A <b>B</b>', text: 'A B' } }), snap(), src, dst);
    expect(out.edits[RECOLOR]).toEqual({ preset: 'dark' });
    expect(out.edits.d1).toEqual({ text: 'A B', html: 'A <b>B</b>' });
  });
  it('keeps the target its own position', () => {
    const out = follow(snap(), snap({}, { s1: { text: 'T' } }), snap({}, { d1: { box: { dx: 12 } } }), src, dst);
    expect(out.edits.d1).toEqual({ box: { dx: 12 }, text: 'T' });
  });
});

describe('cover and event headlines', () => {
  it('splits a headline at a phrase', () => {
    expect(splitHeadline('Meet us in Chicago, booth 1211 all week')).toEqual(['Meet us in Chicago,', 'booth 1211 all week']);
  });
  it('splits on a line break first', () => {
    expect(splitHeadline('One\nTwo three')).toEqual(['One', 'Two three']);
  });
  it('joins the cover lines into the headline', () => {
    expect(carried({ 'headline-1': 'A', 'headline-2': 'B' }, 'headline')).toBe('A\nB');
  });
  it('prints the booth the way the format does', () => {
    expect(boothLike('#1039', 'Booth #12')).toBe('Booth #1039');
    expect(boothLike('Booth #1039', '#12')).toBe('#1039');
  });
});
