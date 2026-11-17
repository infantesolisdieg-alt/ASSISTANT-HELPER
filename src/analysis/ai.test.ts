import { describe, expect, it } from 'vitest';
import { SAMPLE_SUBMISSIONS } from '../samples';
import { aiLevel, analyzeAi, mattr, phraseHits } from './ai';

describe('phraseHits', () => {
  it('counts typical phrases without double counting', () => {
    const hits = phraseHits('It plays a crucial role. Crucial, really. We delve into it.');
    expect(hits.map((h) => h.phrase).sort()).toEqual(['crucial', 'delve into', 'plays a crucial role']);
  });

  it('handles curly apostrophes', () => {
    expect(phraseHits('In today’s fast-paced world we work.')[0].phrase).toBe("in today's fast-paced world");
  });
});

describe('mattr', () => {
  it('is 1 for all-distinct words and low for repeated words', () => {
    expect(mattr(['a', 'b', 'c'])).toBe(1);
    expect(mattr(Array.from({ length: 100 }, () => 'same'))).toBeCloseTo(0.02);
  });
});

describe('analyzeAi', () => {
  const byName = (name: string) => SAMPLE_SUBMISSIONS.find((s) => s.studentName === name)!.text;

  it('rates the AI-style sample memo higher than the human-style samples', () => {
    const memo = analyzeAi(byName('Andrés Morales'));
    const email = analyzeAi(byName('Mariana López'));
    const minutes = analyzeAi(byName('Fernanda Cruz'));
    expect(memo.level).toBe('Elevated');
    expect(email.level).toBe('Low');
    expect(minutes.level).not.toBe('Elevated');
    expect(memo.sentences.length).toBeGreaterThan(0);
    expect(memo.sentences[0].reasons.join(' ')).toContain('Typical phrase');
  });

  it('returns values between 0 and 100', () => {
    for (const s of SAMPLE_SUBMISSIONS) {
      const r = analyzeAi(s.text);
      expect(r.percent).toBeGreaterThanOrEqual(0);
      expect(r.percent).toBeLessThanOrEqual(100);
    }
    expect(analyzeAi('').percent).toBe(0);
  });

  it('maps levels', () => {
    expect([aiLevel(10), aiLevel(40), aiLevel(80)]).toEqual(['Low', 'Moderate', 'Elevated']);
  });
});
