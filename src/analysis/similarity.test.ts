import { describe, expect, it } from 'vitest';
import { computeSimilarity, similarityStatus } from './similarity';

const shared = 'the quick brown fox jumps over the lazy dog near the river bank today';

describe('computeSimilarity', () => {
  it('detects shared passages and highlights them', () => {
    const { results, pairs } = computeSimilarity([
      { id: 'a', text: `Hello there. ${shared}. Goodbye now friends.`, isReference: false },
      { id: 'b', text: `Completely different opening words here. ${shared}.`, isReference: false },
      { id: 'c', text: 'Nothing in common with the others at all, really nothing.', isReference: false },
    ]);
    const a = results.get('a')!;
    expect(a.percent).toBeGreaterThan(50);
    expect(a.matches[0].docId).toBe('b');
    expect(a.ranges).toHaveLength(1);
    expect(a.ranges[0].sources).toEqual(['b']);
    expect(results.get('c')!.percent).toBe(0);
    expect(pairs[0]).toMatchObject({ a: 'a', b: 'b' });
  });

  it('ignores case and punctuation', () => {
    const { results } = computeSimilarity([
      { id: 'a', text: 'One, Two; THREE four five six!', isReference: false },
      { id: 'b', text: 'one two three four five six', isReference: false },
    ]);
    expect(results.get('a')!.percent).toBe(100);
  });

  it('compares against reference files but does not analyze them', () => {
    const { results, pairs } = computeSimilarity([
      { id: 'sub', text: `My essay begins. ${shared}.`, isReference: false },
      { id: 'ref', text: `Source text: ${shared}.`, isReference: true },
    ]);
    expect(results.has('ref')).toBe(false);
    expect(results.get('sub')!.matches[0].docId).toBe('ref');
    expect(pairs[0].bToA).toBeNull();
  });

  it('never exceeds 100% when matching several documents', () => {
    const { results } = computeSimilarity([
      { id: 'a', text: shared, isReference: false },
      { id: 'b', text: shared, isReference: false },
      { id: 'c', text: shared, isReference: false },
    ]);
    expect(results.get('a')!.percent).toBe(100);
  });

  it('handles texts shorter than one shingle', () => {
    const { results } = computeSimilarity([
      { id: 'a', text: 'too short', isReference: false },
      { id: 'b', text: 'too short', isReference: false },
    ]);
    expect(results.get('a')!.percent).toBe(0);
  });
});

describe('similarityStatus', () => {
  it('follows the configured threshold', () => {
    expect(similarityStatus(14.4, 15)).toBe('clear');
    expect(similarityStatus(15, 15)).toBe('review');
    expect(similarityStatus(19.6, 20)).toBe('review'); // se muestra como 20 %
    expect(similarityStatus(29.4, 20)).toBe('review');
    expect(similarityStatus(29.5, 20)).toBe('high');
    expect(similarityStatus(29, 30)).toBe('clear');
    expect(similarityStatus(30, 30)).toBe('high');
  });
});
