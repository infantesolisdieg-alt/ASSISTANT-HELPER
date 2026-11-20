// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { analyzeAll } from '../analysis';
import { SAMPLE_SUBMISSIONS } from '../samples';
import { DEFAULT_SETTINGS } from '../settings';
import type { DocItem } from '../types';
import { buildReport } from './pdfReport';

describe('buildReport', () => {
  it('creates a PDF with the analysis of a submission', () => {
    const docs: DocItem[] = SAMPLE_SUBMISSIONS.map((s, i) => ({
      id: `d${i}`,
      fileName: s.fileName,
      kind: 'txt',
      studentName: s.studentName,
      group: s.group,
      assignmentTitle: s.assignmentTitle,
      isReference: false,
      text: s.text,
      state: 'ready',
      analyzed: true,
      reviewStatus: 'needs-corrections',
      finalComment: 'Rewrite the second paragraph — “in your own words”.',
      notes: [{ id: 'n1', text: 'Check drafting history.', at: Date.now() }],
    }));
    const { byId } = analyzeAll(docs, DEFAULT_SETTINGS);
    const pdf = buildReport(docs[3], byId.get('d3')!, DEFAULT_SETTINGS, (id) => id);
    const bytes = pdf.output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(2000);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
