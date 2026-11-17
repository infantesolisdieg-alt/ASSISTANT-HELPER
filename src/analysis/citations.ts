// Detección del estilo de citas dentro del texto: APA 7, MLA 9 o Chicago (autor-fecha).

import type { CitationStyle } from '../settings';

export type CitationKind = 'apa' | 'mla' | 'chicago';

export interface CitationFound {
  kind: CitationKind;
  text: string;
}

const AUTHOR = String.raw`[A-ZÀ-Ý][\p{L}'’\-]+(?:,? (?:[A-ZÀ-Ý][\p{L}'’\-]+|et al\.|and|&))*`;
const YEAR = String.raw`(?:1[5-9]\d{2}|20\d{2})[a-z]?|n\.d\.`;
const LOCATOR = String.raw`(?:, (?:p|pp|para|chap|ch)\.? ?[\d\-–ivx]+)?`;

const APA_PIECE = new RegExp(String.raw`^${AUTHOR}, (?:${YEAR})${LOCATOR}$`, 'u');
const CHICAGO_PIECE = new RegExp(String.raw`^${AUTHOR} (?:${YEAR})(?:, [\d\-–]+)?$`, 'u');
const MLA_PIECE = new RegExp(String.raw`^${AUTHOR} \d{1,3}(?:[\-–]\d{1,3})?$`, 'u');
const APA_NARRATIVE = new RegExp(
  String.raw`\b[A-ZÀ-Ý][\p{L}'’\-]+(?: (?:et al\.|and|&) [A-ZÀ-Ý][\p{L}'’\-]+)? \((?:${YEAR})${LOCATOR}\)`,
  'gu',
);

export function classifyCitation(piece: string): CitationKind | null {
  const p = piece.trim();
  if (APA_PIECE.test(p)) return 'apa';
  if (CHICAGO_PIECE.test(p)) return 'chicago';
  if (MLA_PIECE.test(p)) return 'mla';
  return null;
}

export function findCitations(text: string): CitationFound[] {
  const found: CitationFound[] = [];
  for (const m of text.matchAll(/\(([^()]{3,160})\)/g)) {
    for (const piece of m[1].split(';')) {
      const kind = classifyCitation(piece);
      if (kind) found.push({ kind, text: `(${piece.trim()})` });
    }
  }
  for (const m of text.matchAll(APA_NARRATIVE)) {
    found.push({ kind: 'apa', text: m[0] });
  }
  return found;
}

export function styleToKind(style: CitationStyle): CitationKind {
  return style === 'APA 7' ? 'apa' : style === 'MLA 9' ? 'mla' : 'chicago';
}

export const KIND_LABEL: Record<CitationKind, string> = {
  apa: 'APA 7',
  mla: 'MLA 9',
  chicago: 'Chicago',
};

export const CITATION_EXAMPLE: Record<CitationStyle, string> = {
  'APA 7': '(Author, 2024)',
  'MLA 9': '(Author 45)',
  Chicago: '(Author 2024, 45)',
};
