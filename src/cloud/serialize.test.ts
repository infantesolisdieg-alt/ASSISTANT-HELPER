import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings';
import type { DocItem } from '../types';
import { MAX_DATA_CHARS, accountToCloud, fromCloud, settingsFromCloud, toCloud } from './serialize';

const doc = (over: Partial<DocItem> = {}): DocItem => ({
  id: 'd1',
  fileName: 'letter.docx',
  kind: 'docx',
  studentName: 'Valeria Gómez',
  group: '5A',
  assignmentTitle: 'Business letter',
  isReference: false,
  text: 'Hello world.\n\nSecond paragraph.',
  paraRanges: [
    [0, 12],
    [14, 31],
  ],
  tables: [{ rows: [['a', 'b']], caption: 'Table 1' }],
  figures: [{ kind: 'image', caption: 'Figure 1', src: 'blob:abc' }],
  state: 'ready',
  analyzed: true,
  reviewStatus: 'approved',
  finalComment: 'Good work',
  notes: [{ id: 'n1', text: 'Nice', at: 1 }],
  ...over,
});

describe('toCloud / fromCloud', () => {
  it('round-trips a submission without nested arrays at the top level', () => {
    const rec = toCloud(doc(), 123);
    // Los campos de primer nivel son simples (Firestore no acepta listas dentro de listas)
    for (const v of Object.values(rec)) expect(Array.isArray(v)).toBe(false);
    expect(rec.data).not.toContain('blob:abc');
    const back = fromCloud('d1', rec);
    expect(back).toMatchObject({
      studentName: 'Valeria Gómez',
      group: '5A',
      text: 'Hello world.\n\nSecond paragraph.',
      reviewStatus: 'approved',
      finalComment: 'Good work',
      analyzed: true,
      state: 'ready',
    });
    expect(back.paraRanges).toEqual([
      [0, 12],
      [14, 31],
    ]);
    expect(back.figures?.[0].src).toBeUndefined();
  });

  it('shrinks very large documents below the size limit', () => {
    const big = 'word '.repeat(200_000);
    const rec = toCloud(doc({ text: big, paraRanges: [[0, big.length]] }), 1);
    expect(rec.data.length).toBeLessThanOrEqual(MAX_DATA_CHARS);
    const back = fromCloud('x', rec);
    expect(back.text.length).toBeGreaterThan(400_000);
  });

  it('survives damaged data', () => {
    const rec = { ...toCloud(doc(), 1), data: '{not json' };
    expect(fromCloud('x', rec).text).toBe('');
  });
});

describe('account', () => {
  it('stores settings as text and reads them back', () => {
    const a = accountToCloud({ name: 'Ana', role: 'Teacher', group: '5A' }, DEFAULT_SETTINGS);
    expect(settingsFromCloud(a.settings)).toEqual(DEFAULT_SETTINGS);
    expect(settingsFromCloud('{bad')).toBeNull();
  });

  it('saves the accepted terms only when they exist (Firestore rejects undefined)', () => {
    const none = accountToCloud({ name: 'Ana', role: 'Teacher', group: '' }, DEFAULT_SETTINGS);
    expect('terms' in none).toBe(false);
    const withTerms = accountToCloud(
      { name: 'Ana', role: 'Teacher', group: '', termsVersion: '2026-11-20', termsAcceptedAt: 123 },
      DEFAULT_SETTINGS,
    );
    expect(withTerms.terms).toEqual({ version: '2026-11-20', acceptedAt: 123 });
  });
});
