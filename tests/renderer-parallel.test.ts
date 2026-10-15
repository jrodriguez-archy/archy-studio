import { describe, expect, it } from 'vitest';
import { render } from '@/lib/renderer';

// Formats are drawn side by side on one shared browser (render, compose, save-set): none of them may end
// another, and they all come back.
describe('renderer', () => {
  it('draws many formats at once on one browser', async () => {
    const jobs = ['post', 'stories', 'square', 'og'].flatMap((format) => ['booth-invite-photo', 'booth-icon-list'].map((template) => ({ template, format })));
    const out = await Promise.allSettled(jobs.map((j) => render({ ...j, slots: {}, fillDefaults: true, scale: 2 })));
    const failed = out.flatMap((r, i) => (r.status === 'rejected' ? [`${jobs[i].template}/${jobs[i].format}: ${r.reason}`] : []));
    expect(failed.filter((f) => !/Unknown format|not a format/i.test(f))).toEqual([]);
  });
});
