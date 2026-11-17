// Validación de formato: propiedades del .docx (fuente, tamaño, interlineado, márgenes,
// alineación) y revisiones para todos los formatos (palabras, título, referencias, citas).

import type { DocxFormat, FileKind } from '../extract/types';
import type { Settings } from '../settings';
import { CITATION_EXAMPLE, findCitations, KIND_LABEL, styleToKind, type CitationKind } from './citations';
import { countWords, splitParagraphs, truncate } from './text';
import { NOT_AVAILABLE, type CheckResult } from './types';

export interface FormatInput {
  kind: FileKind;
  text: string;
  docxFormat?: DocxFormat;
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

export function lineSpacingLabel(v: number): string {
  if (Math.abs(v - 1) < 0.01) return 'single (1.0)';
  if (Math.abs(v - 2) < 0.01) return 'double (2.0)';
  return `${Number(v.toFixed(2))}`;
}

const REF_HEADING = /^(references?|reference list|works cited|works consulted|bibliography|sources)\s*:?$/i;

const EXPECTED_HEADINGS: Record<Settings['citationStyle'], string[]> = {
  'APA 7': ['references', 'reference list'],
  'MLA 9': ['works cited'],
  Chicago: ['bibliography', 'references', 'reference list'],
};

const EXPECTED_HEADING_LABEL: Record<Settings['citationStyle'], string> = {
  'APA 7': 'References',
  'MLA 9': 'Works Cited',
  Chicago: 'Bibliography',
};

export function findTitle(paragraphs: string[]): string | null {
  const head = paragraphs.slice(0, 8);
  const subject = head.find((p) => /^(subject|re|asunto)\s*:/i.test(p));
  if (subject) return subject;
  const marker = head.find((p) => /^(memorandum|memo|minutes\b)/i.test(p));
  if (marker) return marker;
  const first = paragraphs[0];
  if (!first) return null;
  const firstLine = first.split('\n')[0].trim();
  if (
    countWords(firstLine) > 0 &&
    countWords(firstLine) <= 12 &&
    !/[.,;:]$/.test(firstLine) &&
    !/^(dear|to|from|date)\b/i.test(firstLine)
  ) {
    return firstLine;
  }
  return null;
}

function docxOnly(id: string, name: string): CheckResult {
  return { id, name, outcome: 'na', detail: NOT_AVAILABLE, group: 'format' };
}

export function runFormatChecks(input: FormatInput, settings: Settings): CheckResult[] {
  const { checks } = settings;
  const out: CheckResult[] = [];
  const f = input.kind === 'docx' ? input.docxFormat : undefined;
  const paragraphs = splitParagraphs(input.text).map((p) => p.text);

  // --- Revisiones exclusivas de .docx ---
  if (checks.font) {
    if (!f) out.push(docxOnly('font', 'Font'));
    else if (!f.font) out.push({ id: 'font', name: 'Font', outcome: 'review', detail: 'The font could not be determined from the file.', group: 'format' });
    else {
      const ok = f.font.toLowerCase() === settings.font.toLowerCase();
      out.push({
        id: 'font',
        name: 'Font',
        outcome: ok ? (f.fontShare >= 0.9 ? 'passed' : 'review') : 'failed',
        detail: ok
          ? `${f.font} is used in ${pct(f.fontShare)} of the text.`
          : `Expected ${settings.font}. Found ${f.font} (${pct(f.fontShare)} of the text).`,
        group: 'format',
      });
    }
  }

  if (checks.fontSize) {
    if (!f) out.push(docxOnly('fontSize', 'Font size'));
    else if (f.fontSizePt == null) out.push({ id: 'fontSize', name: 'Font size', outcome: 'review', detail: 'The font size could not be determined from the file.', group: 'format' });
    else {
      const ok = Math.abs(f.fontSizePt - settings.fontSizePt) < 0.01;
      out.push({
        id: 'fontSize',
        name: 'Font size',
        outcome: ok ? (f.fontSizeShare >= 0.9 ? 'passed' : 'review') : 'failed',
        detail: ok
          ? `${f.fontSizePt} pt is used in ${pct(f.fontSizeShare)} of the text.`
          : `Expected ${settings.fontSizePt} pt. Found ${f.fontSizePt} pt (${pct(f.fontSizeShare)} of the text).`,
        group: 'format',
      });
    }
  }

  if (checks.lineSpacing) {
    if (!f) out.push(docxOnly('lineSpacing', 'Line spacing'));
    else if (f.lineSpacing == null) {
      out.push({
        id: 'lineSpacing',
        name: 'Line spacing',
        outcome: 'review',
        detail: f.lineSpacingExactPt
          ? `The document uses a fixed line height of ${f.lineSpacingExactPt} pt instead of ${lineSpacingLabel(settings.lineSpacing)} spacing.`
          : 'The line spacing could not be determined from the file.',
        group: 'format',
      });
    } else {
      const ok = Math.abs(f.lineSpacing - settings.lineSpacing) < 0.05;
      out.push({
        id: 'lineSpacing',
        name: 'Line spacing',
        outcome: ok ? (f.lineSpacingShare >= 0.9 ? 'passed' : 'review') : 'failed',
        detail: ok
          ? `${lineSpacingLabel(f.lineSpacing)} spacing in ${pct(f.lineSpacingShare)} of the text.`
          : `Expected ${lineSpacingLabel(settings.lineSpacing)}. Found ${lineSpacingLabel(f.lineSpacing)} (${pct(f.lineSpacingShare)} of the text).`,
        group: 'format',
      });
    }
  }

  if (checks.margins) {
    if (!f) out.push(docxOnly('margins', 'Margins'));
    else if (!f.marginsCm) out.push({ id: 'margins', name: 'Margins', outcome: 'review', detail: 'Page margins were not found in the file.', group: 'format' });
    else {
      const m = f.marginsCm;
      const sides: [string, number][] = [
        ['top', m.top],
        ['right', m.right],
        ['bottom', m.bottom],
        ['left', m.left],
      ];
      const wrong = sides.filter(([, v]) => Math.abs(v - settings.marginsCm) > 0.1);
      out.push({
        id: 'margins',
        name: 'Margins',
        outcome: wrong.length === 0 ? 'passed' : 'failed',
        detail:
          wrong.length === 0
            ? `All margins are ${settings.marginsCm} cm.`
            : `Expected ${settings.marginsCm} cm. Different: ${wrong.map(([s, v]) => `${s} ${v} cm`).join(', ')}.`,
        group: 'format',
      });
    }
  }

  if (checks.alignment) {
    if (!f) out.push(docxOnly('alignment', 'Alignment'));
    else if (!f.alignment) out.push({ id: 'alignment', name: 'Alignment', outcome: 'review', detail: 'The alignment could not be determined from the file.', group: 'format' });
    else {
      const ok = f.alignment === settings.alignment;
      out.push({
        id: 'alignment',
        name: 'Alignment',
        outcome: ok ? (f.alignmentShare >= 0.9 ? 'passed' : 'review') : 'failed',
        detail: ok
          ? `Body text is ${f.alignment}-aligned (${pct(f.alignmentShare)} of paragraphs).`
          : `Expected ${settings.alignment}. Body text is ${f.alignment}-aligned (${pct(f.alignmentShare)} of paragraphs).`,
        group: 'format',
      });
    }
  }

  // --- Revisiones para todos los formatos ---
  if (checks.wordCount) {
    const words = countWords(input.text);
    const { minWords, maxWords } = settings;
    let outcome: CheckResult['outcome'] = 'passed';
    if (words < minWords) outcome = words >= minWords * 0.9 ? 'review' : 'failed';
    if (words > maxWords) outcome = words <= maxWords * 1.1 ? 'review' : 'failed';
    out.push({
      id: 'wordCount',
      name: 'Word count',
      outcome,
      detail: `${words} words (expected ${minWords}–${maxWords}).`,
      group: 'format',
    });
  }

  if (checks.title) {
    const title = findTitle(paragraphs);
    if (f?.hasTitleStyle) {
      out.push({ id: 'title', name: 'Title', outcome: 'passed', detail: 'A Title or Heading 1 style is applied.', group: 'format' });
    } else if (title) {
      out.push({ id: 'title', name: 'Title', outcome: 'passed', detail: `Detected title: “${truncate(title, 90)}”.`, group: 'format' });
    } else {
      out.push({ id: 'title', name: 'Title', outcome: 'review', detail: 'No clear title or subject line was detected at the beginning.', group: 'format' });
    }
  }

  const citations = findCitations(input.text);

  if (checks.references) {
    const heading = paragraphs.find((p) => REF_HEADING.test(p.trim()));
    const expected = EXPECTED_HEADINGS[settings.citationStyle];
    const expectedLabel = EXPECTED_HEADING_LABEL[settings.citationStyle];
    if (heading) {
      const h = heading.trim().replace(/:$/, '');
      const ok = expected.includes(h.toLowerCase());
      out.push({
        id: 'references',
        name: 'References section',
        outcome: ok ? 'passed' : 'review',
        detail: ok ? `“${h}” section found.` : `Found “${h}”; ${settings.citationStyle} uses “${expectedLabel}”.`,
        group: 'format',
      });
    } else {
      out.push({
        id: 'references',
        name: 'References section',
        outcome: citations.length > 0 ? 'failed' : 'review',
        detail:
          citations.length > 0
            ? `The text cites sources but has no “${expectedLabel}” section.`
            : `No “${expectedLabel}” section found. Turn this check off if the assignment does not require sources.`,
        group: 'format',
      });
    }
  }

  if (checks.citations) {
    const expected: CitationKind = styleToKind(settings.citationStyle);
    const ok = citations.filter((c) => c.kind === expected);
    const other = citations.filter((c) => c.kind !== expected);
    const name = `In-text citations (${settings.citationStyle})`;
    const instances = citations.slice(0, 8).map((c) => `${c.text} — ${KIND_LABEL[c.kind]}`);
    if (citations.length === 0) {
      out.push({
        id: 'citations',
        name,
        outcome: 'review',
        detail: `No in-text citations found. Expected format: ${CITATION_EXAMPLE[settings.citationStyle]}.`,
        group: 'format',
      });
    } else if (other.length === 0) {
      out.push({ id: 'citations', name, outcome: 'passed', detail: `${ok.length} citation(s) follow ${settings.citationStyle}.`, instances, group: 'format' });
    } else if (ok.length === 0) {
      const kinds = [...new Set(other.map((c) => KIND_LABEL[c.kind]))].join(' / ');
      out.push({
        id: 'citations',
        name,
        outcome: 'failed',
        detail: `${other.length} citation(s) appear to use ${kinds}. Expected format: ${CITATION_EXAMPLE[settings.citationStyle]}.`,
        instances,
        group: 'format',
      });
    } else {
      out.push({
        id: 'citations',
        name,
        outcome: 'review',
        detail: `${ok.length} citation(s) follow ${settings.citationStyle}; ${other.length} use a different style.`,
        instances,
        group: 'format',
      });
    }
  }

  return out;
}
