import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings';
import { runCustomRules } from './customRules';
import { findLongSentences, findPassive, findRepeatedWords } from './writing';

describe('findPassive', () => {
  it('finds passive constructions and ignores common adjectives', () => {
    const found = findPassive('The report was written by Ana. I am pleased to help. The minutes were approved. We need help.');
    expect(found).toEqual(['The report was written by Ana.', 'The minutes were approved.']);
  });
});

describe('findLongSentences', () => {
  it('flags sentences over 35 words', () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ') + '.';
    expect(findLongSentences(`Short one. ${long}`)).toHaveLength(1);
  });
});

describe('findRepeatedWords', () => {
  it('finds content words repeated close together', () => {
    const rep = findRepeatedWords('The meeting starts soon and the meeting ends late.');
    expect(rep.map((r) => r.word)).toEqual(['meeting']);
  });

  it('ignores stopwords and repetitions across paragraphs', () => {
    expect(findRepeatedWords('the the the and and')).toHaveLength(0);
    expect(findRepeatedWords('Budget report.\n\nBudget review.')).toHaveLength(0);
  });
});

describe('runCustomRules', () => {
  const text = 'Dear Ms. Ramírez,\n\nThank you.\n\nSincerely,';
  it('evaluates contain, not contain and paragraph rules', () => {
    const r = runCustomRules(text, [
      { id: '1', type: 'must-contain', value: 'sincerely' },
      { id: '2', type: 'must-not-contain', value: 'thank you' },
      { id: '3', type: 'min-paragraphs', value: '4' },
      { id: '4', type: 'must-contain', value: 'Dear' },
    ]);
    expect(r.map((c) => c.outcome)).toEqual(['passed', 'failed', 'failed', 'passed']);
  });

  it('matches whole words only', () => {
    expect(runCustomRules('Signature', [{ id: '1', type: 'must-contain', value: 'sign' }])[0].outcome).toBe('failed');
  });
});

it('default settings enable every check', () => {
  expect(Object.values(DEFAULT_SETTINGS.checks).every(Boolean)).toBe(true);
});
