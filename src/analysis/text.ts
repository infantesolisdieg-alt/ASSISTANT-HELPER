// Utilidades de texto compartidas por todos los análisis: tokenización con posiciones,
// división en oraciones y párrafos.

export interface Token {
  /** Palabra normalizada: minúsculas y sin apóstrofos. */
  word: string;
  start: number;
  end: number;
}

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    const start = m.index ?? 0;
    out.push({
      word: m[0].toLowerCase().replace(/['’]/g, ''),
      start,
      end: start + m[0].length,
    });
  }
  return out;
}

export function countWords(text: string): number {
  return tokenize(text).length;
}

export interface Span {
  text: string;
  start: number;
  end: number;
}

export interface Sentence extends Span {
  words: number;
}

const ABBREV =
  /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|e\.g|i\.e|a\.m|p\.m|inc|ltd|co|corp|no|p|pp|vol|ed|eds|al|approx|dept|ext|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|av|blvd)\.$/i;

/** Divide el texto en oraciones conservando las posiciones de inicio y fin. */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;

  const push = (end: number) => {
    let s = start;
    let e = end;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) {
      const t = text.slice(s, e);
      const words = countWords(t);
      if (words > 0) out.push({ text: t, start: s, end: e, words });
    }
    start = end;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') {
      push(i);
      start = i + 1;
      continue;
    }
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;

    let j = i + 1;
    while (j < text.length && /[.!?"'”’)\]]/.test(text[j])) j++;
    // "3.5", "www.site.com": no es fin de oración
    if (j < text.length && !/\s/.test(text[j])) {
      i = j - 1;
      continue;
    }
    if (ch === '.') {
      const before = text.slice(Math.max(start, i - 12), i + 1);
      if (ABBREV.test(before) || /(?:^|\s)[A-Z]\.$/.test(before)) {
        i = j - 1;
        continue;
      }
      let k = j;
      while (k < text.length && text[k] === ' ') k++;
      if (k < text.length && /[a-z]/.test(text[k])) {
        i = j - 1;
        continue;
      }
    }
    push(j);
    i = j - 1;
  }
  push(text.length);
  return out;
}

/** Párrafos = bloques separados por al menos una línea en blanco. */
export function splitParagraphs(text: string): Span[] {
  const out: Span[] = [];
  const re = /[^\n]*\S[^\n]*(?:\n(?![ \t]*\n)[^\n]*\S[^\n]*)*/g;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    out.push({ text: m[0].trim(), start, end: start + m[0].length });
  }
  return out;
}

export function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function truncate(s: string, max = 140): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

export const STOPWORDS = new Set(
  (
    'a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves dear please thank thanks shall may might must upon also'
  ).split(' '),
);
