import { describe, expect, it } from 'vitest';
import type { DocxFormat } from '../extract/types';
import { DEFAULT_SETTINGS, type Settings } from '../settings';
import { findCitations } from './citations';
import { runFormatChecks } from './format';

const settings = (over: Partial<Settings> = {}): Settings => ({ ...structuredClone(DEFAULT_SETTINGS), ...over });
const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

const goodDocx: DocxFormat = {
  font: 'Times New Roman',
  fontShare: 1,
  fontSizePt: 12,
  fontSizeShare: 1,
  lineSpacing: 2,
  lineSpacingShare: 1,
  lineSpacingExactPt: null,
  alignment: 'left',
  alignmentShare: 1,
  marginsCm: { top: 2.54, right: 2.54, bottom: 2.54, left: 2.54 },
  hasTitleStyle: true,
};

const byId = (checks: ReturnType<typeof runFormatChecks>, id: string) => checks.find((c) => c.id === id)!;

describe('runFormatChecks', () => {
  it('marks docx-only checks as N/A for txt and pdf', () => {
    for (const kind of ['txt', 'pdf'] as const) {
      const checks = runFormatChecks({ kind, text: words(200) }, settings());
      for (const id of ['font', 'fontSize', 'lineSpacing', 'margins', 'alignment']) {
        expect(byId(checks, id)).toMatchObject({ outcome: 'na', detail: 'Not available for this file type' });
      }
    }
  });

  it('passes a docx that matches the criteria', () => {
    const checks = runFormatChecks({ kind: 'docx', text: words(200), docxFormat: goodDocx }, settings());
    for (const id of ['font', 'fontSize', 'lineSpacing', 'margins', 'alignment', 'wordCount', 'title']) {
      expect(byId(checks, id).outcome).toBe('passed');
    }
  });

  it('fails a docx with the wrong font and margins', () => {
    const f = { ...goodDocx, font: 'Calibri', marginsCm: { top: 2.5, right: 3, bottom: 2.5, left: 3 } };
    const checks = runFormatChecks({ kind: 'docx', text: words(200), docxFormat: f }, settings());
    expect(byId(checks, 'font').outcome).toBe('failed');
    expect(byId(checks, 'margins').outcome).toBe('failed');
    expect(byId(checks, 'margins').detail).toContain('right 3 cm');
  });

  it('checks the word count range', () => {
    expect(byId(runFormatChecks({ kind: 'txt', text: words(50) }, settings()), 'wordCount').outcome).toBe('failed');
    expect(byId(runFormatChecks({ kind: 'txt', text: words(140) }, settings()), 'wordCount').outcome).toBe('review');
    expect(byId(runFormatChecks({ kind: 'txt', text: words(300) }, settings()), 'wordCount').outcome).toBe('passed');
  });

  it('omits disabled checks', () => {
    const s = settings();
    s.checks.font = false;
    expect(runFormatChecks({ kind: 'txt', text: 'x' }, s).some((c) => c.id === 'font')).toBe(false);
  });

  it('validates the references section and citation style', () => {
    const apa = `Title here\n\nResearch shows this (Smith, 2020) and more (Lee & Kim, 2021, p. 4).\n\nReferences\n\nSmith, J. (2020). Book.`;
    const checks = runFormatChecks({ kind: 'txt', text: apa }, settings());
    expect(byId(checks, 'references').outcome).toBe('passed');
    expect(byId(checks, 'citations').outcome).toBe('passed');

    const mla = `Title\n\nAs noted before (Smith 45).\n\nWorks Cited\n\nSmith, John. Book.`;
    const c2 = runFormatChecks({ kind: 'txt', text: mla }, settings());
    expect(byId(c2, 'citations').outcome).toBe('failed');
    expect(byId(c2, 'references').outcome).toBe('review');

    const noRefs = runFormatChecks({ kind: 'txt', text: 'A claim (Smith, 2020).' }, settings());
    expect(byId(noRefs, 'references').outcome).toBe('failed');
  });
});

describe('findCitations', () => {
  it('classifies citation styles', () => {
    const kinds = findCitations('(Smith, 2020) (Smith 45) (Smith 2020, 45) Johnson (2023) (see chapter two)').map((c) => c.kind);
    expect(kinds).toEqual(['apa', 'mla', 'chicago', 'apa']);
  });
});
