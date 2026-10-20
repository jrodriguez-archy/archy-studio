import { describe, expect, it } from 'vitest';
import { differingFigures } from '../lib/compose';

// Formats of one exploration: a figure that really differs is said; a format that writes it shorter or
// leaves it out is not.
describe('differingFigures', () => {
  it('a price written two ways is the same price', () => {
    expect(differingFigures('<p>Normally $899</p>', '<p>Normally $899/mo</p>')).toEqual([]);
  });
  it('a shorter format that leaves a figure out is fine', () => {
    expect(differingFigures('<p>$400 /mo · Normally $899</p>', '<p>$400 /mo</p>')).toEqual([]);
  });
  it('two prices that differ are said', () => {
    expect(differingFigures('<p>Normally $899</p>', '<p>Normally $999</p>')).toEqual(['$899 vs $999']);
  });
  it('percentages and times too', () => {
    expect(differingFigures('<p>55% off · 6:00 PM</p>', '<p>50% off · 6:00 PM</p>')).toEqual(['55% vs 50%']);
  });
});
