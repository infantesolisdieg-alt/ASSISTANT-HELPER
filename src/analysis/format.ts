// Validación de formato: propiedades del .docx (fuente, tamaño, interlineado, márgenes,
// alineación) y revisiones para todos los formatos (palabras, título, referencias, citas).

import { t, tk, tn } from '../i18n';
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
  if (Math.abs(v - 1) < 0.01) return t('single (1.0)');
  if (Math.abs(v - 2) < 0.01) return t('double (2.0)');
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
  return { id, name, outcome: 'na', detail: t(NOT_AVAILABLE), group: 'format' };
}

/** Nombre de la alineación para los mensajes ("left" → "left-aligned" / "alineado a la izquierda"). */
function alignLabel(a: string): string {
  if (a === 'left') return t('left-aligned');
  if (a === 'right') return t('right-aligned');
  if (a === 'center') return t('centered');
  if (a === 'justify') return t('justified');
  return a;
}

const SIDE_LABEL: Record<string, string> = { top: tk('top'), right: tk('right'), bottom: tk('bottom'), left: tk('left') };

export function runFormatChecks(input: FormatInput, settings: Settings): CheckResult[] {
  const { checks } = settings;
  const out: CheckResult[] = [];
  const f = input.kind === 'docx' ? input.docxFormat : undefined;
  const paragraphs = splitParagraphs(input.text).map((p) => p.text);

  // --- Revisiones exclusivas de .docx ---
  if (checks.font) {
    if (!f) out.push(docxOnly('font', t('Font')));
    else if (!f.font) out.push({ id: 'font', name: t('Font'), outcome: 'review', detail: t('The font could not be determined from the file.'), group: 'format' });
    else {
      const ok = f.font.toLowerCase() === settings.font.toLowerCase();
      out.push({
        id: 'font',
        name: t('Font'),
        outcome: ok ? (f.fontShare >= 0.9 ? 'passed' : 'review') : 'failed',
        detail: ok
          ? t('{font} is used in {share} of the text.', { font: f.font, share: pct(f.fontShare) })
          : t('Expected {expected}. Found {font} ({share} of the text).', { expected: settings.font, font: f.font, share: pct(f.fontShare) }),
        group: 'format',
      });
    }
  }

  if (checks.fontSize) {
    if (!f) out.push(docxOnly('fontSize', t('Font size')));
    else if (f.fontSizePt == null) out.push({ id: 'fontSize', name: t('Font size'), outcome: 'review', detail: t('The font size could not be determined from the file.'), group: 'format' });
    else {
      const ok = Math.abs(f.fontSizePt - settings.fontSizePt) < 0.01;
      out.push({
        id: 'fontSize',
        name: t('Font size'),
        outcome: ok ? (f.fontSizeShare >= 0.9 ? 'passed' : 'review') : 'failed',
        detail: ok
          ? t('{size} pt is used in {share} of the text.', { size: f.fontSizePt, share: pct(f.fontSizeShare) })
          : t('Expected {expected} pt. Found {size} pt ({share} of the text).', {
              expected: settings.fontSizePt,
              size: f.fontSizePt,
              share: pct(f.fontSizeShare),
            }),
        group: 'format',
      });
    }
  }

  if (checks.lineSpacing) {
    if (!f) out.push(docxOnly('lineSpacing', t('Line spacing')));
    else if (f.lineSpacing == null) {
      out.push({
        id: 'lineSpacing',
        name: t('Line spacing'),
        outcome: 'review',
        detail: f.lineSpacingExactPt
          ? t('The document uses a fixed line height of {pt} pt instead of {expected} spacing.', {
              pt: f.lineSpacingExactPt,
              expected: lineSpacingLabel(settings.lineSpacing),
            })
          : t('The line spacing could not be determined from the file.'),
        group: 'format',
      });
    } else {
      const ok = Math.abs(f.lineSpacing - settings.lineSpacing) < 0.05;
      out.push({
        id: 'lineSpacing',
        name: t('Line spacing'),
        outcome: ok ? (f.lineSpacingShare >= 0.9 ? 'passed' : 'review') : 'failed',
        detail: ok
          ? t('{spacing} spacing in {share} of the text.', { spacing: lineSpacingLabel(f.lineSpacing), share: pct(f.lineSpacingShare) })
          : t('Expected {expected}. Found {spacing} ({share} of the text).', {
              expected: lineSpacingLabel(settings.lineSpacing),
              spacing: lineSpacingLabel(f.lineSpacing),
              share: pct(f.lineSpacingShare),
            }),
        group: 'format',
      });
    }
  }

  if (checks.margins) {
    if (!f) out.push(docxOnly('margins', t('Margins')));
    else if (!f.marginsCm) out.push({ id: 'margins', name: t('Margins'), outcome: 'review', detail: t('Page margins were not found in the file.'), group: 'format' });
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
        name: t('Margins'),
        outcome: wrong.length === 0 ? 'passed' : 'failed',
        detail:
          wrong.length === 0
            ? t('All margins are {cm} cm.', { cm: settings.marginsCm })
            : t('Expected {cm} cm. Different: {list}.', {
                cm: settings.marginsCm,
                list: wrong.map(([s, v]) => `${t(SIDE_LABEL[s] ?? s)} ${v} cm`).join(', '),
              }),
        group: 'format',
      });
    }
  }

  if (checks.alignment) {
    if (!f) out.push(docxOnly('alignment', t('Alignment')));
    else if (!f.alignment) out.push({ id: 'alignment', name: t('Alignment'), outcome: 'review', detail: t('The alignment could not be determined from the file.'), group: 'format' });
    else {
      const ok = f.alignment === settings.alignment;
      out.push({
        id: 'alignment',
        name: t('Alignment'),
        outcome: ok ? (f.alignmentShare >= 0.9 ? 'passed' : 'review') : 'failed',
        detail: ok
          ? t('Body text is {align} ({share} of paragraphs).', { align: alignLabel(f.alignment), share: pct(f.alignmentShare) })
          : t('Expected {expected}. Body text is {align} ({share} of paragraphs).', {
              expected: alignLabel(settings.alignment),
              align: alignLabel(f.alignment),
              share: pct(f.alignmentShare),
            }),
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
    // Un rango inválido en Settings no debe reprobar a nadie
    const badRange = minWords > maxWords;
    out.push({
      id: 'wordCount',
      name: t('Word count'),
      outcome: badRange ? 'review' : outcome,
      detail: badRange
        ? t('{words} words. The word range in Settings is not valid (minimum {min} is greater than maximum {max}).', {
            words,
            min: minWords,
            max: maxWords,
          })
        : t('{words} words (expected {min}–{max}).', { words, min: minWords, max: maxWords }),
      group: 'format',
    });
  }

  if (checks.title) {
    const title = findTitle(paragraphs);
    if (f?.hasTitleStyle) {
      out.push({ id: 'title', name: t('Title'), outcome: 'passed', detail: t('A Title or Heading 1 style is applied.'), group: 'format' });
    } else if (title) {
      out.push({ id: 'title', name: t('Title'), outcome: 'passed', detail: t('Detected title: “{title}”.', { title: truncate(title, 90) }), group: 'format' });
    } else {
      out.push({ id: 'title', name: t('Title'), outcome: 'review', detail: t('No clear title or subject line was detected at the beginning.'), group: 'format' });
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
        name: t('References section'),
        outcome: ok ? 'passed' : 'review',
        detail: ok
          ? t('“{heading}” section found.', { heading: h })
          : t('Found “{heading}”; {style} uses “{expected}”.', { heading: h, style: settings.citationStyle, expected: expectedLabel }),
        group: 'format',
      });
    } else {
      out.push({
        id: 'references',
        name: t('References section'),
        outcome: citations.length > 0 ? 'failed' : 'review',
        detail:
          citations.length > 0
            ? t('The text cites sources but has no “{expected}” section.', { expected: expectedLabel })
            : t('No “{expected}” section found. Turn this check off if the assignment does not require sources.', { expected: expectedLabel }),
        group: 'format',
      });
    }
  }

  if (checks.citations) {
    const expected: CitationKind = styleToKind(settings.citationStyle);
    const ok = citations.filter((c) => c.kind === expected);
    const other = citations.filter((c) => c.kind !== expected);
    const name = t('In-text citations ({style})', { style: settings.citationStyle });
    const instances = citations.slice(0, 8).map((c) => `${c.text} — ${KIND_LABEL[c.kind]}`);
    if (citations.length === 0) {
      out.push({
        id: 'citations',
        name,
        outcome: 'review',
        detail: t('No in-text citations found. Expected format: {example}.', { example: CITATION_EXAMPLE[settings.citationStyle] }),
        group: 'format',
      });
    } else if (other.length === 0) {
      out.push({ id: 'citations', name, outcome: 'passed', detail: tn(ok.length, '{n} citation follows {style}.', '{n} citations follow {style}.', { style: settings.citationStyle }), instances, group: 'format' });
    } else if (ok.length === 0) {
      const kinds = [...new Set(other.map((c) => KIND_LABEL[c.kind]))].join(' / ');
      out.push({
        id: 'citations',
        name,
        outcome: 'failed',
        detail: tn(other.length, '{n} citation appears to use {kinds}. Expected format: {example}.', '{n} citations appear to use {kinds}. Expected format: {example}.', {
          kinds,
          example: CITATION_EXAMPLE[settings.citationStyle],
        }),
        instances,
        group: 'format',
      });
    } else {
      out.push({
        id: 'citations',
        name,
        outcome: 'review',
        detail: t('{ok} of {total} citations follow {style}; the rest use a different style.', {
          ok: ok.length,
          total: ok.length + other.length,
          style: settings.citationStyle,
        }),
        instances,
        group: 'format',
      });
    }
  }

  return out;
}
