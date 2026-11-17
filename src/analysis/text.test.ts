import { describe, expect, it } from 'vitest';
import { splitParagraphs, splitSentences, tokenize } from './text';

describe('tokenize', () => {
  it('lowercases words and keeps offsets', () => {
    const t = tokenize("Don't stop, Mr. Pérez!");
    expect(t.map((x) => x.word)).toEqual(['dont', 'stop', 'mr', 'pérez']);
    expect(t[3]).toMatchObject({ start: 16, end: 21 });
  });
});

describe('splitSentences', () => {
  it('splits on end punctuation and newlines', () => {
    const s = splitSentences('First one. Second one? Third!\nFourth line');
    expect(s.map((x) => x.text)).toEqual(['First one.', 'Second one?', 'Third!', 'Fourth line']);
  });

  it('does not split common abbreviations or decimals', () => {
    const s = splitSentences('Dear Mr. Hayes, the price is 3.5 dollars. We meet at 10 a.m. tomorrow. See e.g. page 2.');
    expect(s).toHaveLength(3);
  });
});

describe('splitParagraphs', () => {
  it('separates blocks by blank lines', () => {
    const p = splitParagraphs('One\ntwo\n\nThree\n\n\nFour');
    expect(p.map((x) => x.text)).toEqual(['One\ntwo', 'Three', 'Four']);
  });
});
