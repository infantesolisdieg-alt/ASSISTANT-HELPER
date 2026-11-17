// Detección de similitud por shingles de 5 palabras.
// Solo compara entre los documentos cargados en la sesión (entregas y archivos de referencia).

import { tokenize, type Token } from './text';
import type { SimilarityStatus } from './types';

export const SHINGLE_SIZE = 5;
export const HIGH_MATCH_PERCENT = 30;

export interface SimDoc {
  id: string;
  text: string;
  isReference: boolean;
}

export interface MatchSource {
  docId: string;
  /** Porcentaje de palabras de la entrega cubiertas por coincidencias con este documento. */
  percent: number;
}

export interface MatchedRange {
  start: number;
  end: number;
  sources: string[];
}

export interface SimilarityResult {
  docId: string;
  /** Porcentaje total: unión de todas las coincidencias (nunca supera 100). */
  percent: number;
  wordCount: number;
  matches: MatchSource[];
  ranges: MatchedRange[];
}

export interface SimilarPair {
  a: string;
  b: string;
  aToB: number;
  /** null cuando b es un archivo de referencia (no se analiza). */
  bToA: number | null;
  max: number;
}

interface Prepared {
  doc: SimDoc;
  tokens: Token[];
  keys: string[];
  keySet: Set<string>;
}

function prepare(doc: SimDoc): Prepared {
  const tokens = tokenize(doc.text);
  const keys: string[] = [];
  for (let i = 0; i + SHINGLE_SIZE <= tokens.length; i++) {
    keys.push(
      tokens
        .slice(i, i + SHINGLE_SIZE)
        .map((t) => t.word)
        .join(' '),
    );
  }
  return { doc, tokens, keys, keySet: new Set(keys) };
}

export function computeSimilarity(docs: SimDoc[]): {
  results: Map<string, SimilarityResult>;
  pairs: SimilarPair[];
} {
  const prepared = docs.map(prepare);
  const results = new Map<string, SimilarityResult>();

  for (const a of prepared) {
    if (a.doc.isReference) continue;
    const n = a.tokens.length;
    const coveredAll = new Uint8Array(n);
    const sourcesPerWord: Array<Set<string> | undefined> = new Array(n);
    const matches: MatchSource[] = [];

    for (const b of prepared) {
      if (b === a || b.keys.length === 0) continue;
      const covered = new Uint8Array(n);
      for (let i = 0; i < a.keys.length; i++) {
        if (!b.keySet.has(a.keys[i])) continue;
        for (let k = i; k < i + SHINGLE_SIZE; k++) {
          covered[k] = 1;
          coveredAll[k] = 1;
          (sourcesPerWord[k] ??= new Set()).add(b.doc.id);
        }
      }
      const count = covered.reduce((s, v) => s + v, 0);
      if (count > 0) matches.push({ docId: b.doc.id, percent: (count / n) * 100 });
    }

    // Une palabras consecutivas cubiertas en rangos de caracteres para resaltar
    const ranges: MatchedRange[] = [];
    let i = 0;
    while (i < n) {
      if (!coveredAll[i]) {
        i++;
        continue;
      }
      let j = i;
      const sources = new Set<string>();
      while (j < n && coveredAll[j]) {
        sourcesPerWord[j]?.forEach((s) => sources.add(s));
        j++;
      }
      ranges.push({ start: a.tokens[i].start, end: a.tokens[j - 1].end, sources: [...sources] });
      i = j;
    }

    const total = coveredAll.reduce((s, v) => s + v, 0);
    matches.sort((x, y) => y.percent - x.percent);
    results.set(a.doc.id, {
      docId: a.doc.id,
      percent: n === 0 ? 0 : (total / n) * 100,
      wordCount: n,
      matches,
      ranges,
    });
  }

  // Pares: cada entrega contra las demás entregas y contra cada referencia
  const pairs: SimilarPair[] = [];
  const subs = prepared.filter((p) => !p.doc.isReference);
  const refs = prepared.filter((p) => p.doc.isReference);
  const pct = (from: string, to: string) =>
    results.get(from)?.matches.find((m) => m.docId === to)?.percent ?? 0;

  for (let x = 0; x < subs.length; x++) {
    for (let y = x + 1; y < subs.length; y++) {
      const a = subs[x].doc.id;
      const b = subs[y].doc.id;
      const aToB = pct(a, b);
      const bToA = pct(b, a);
      if (aToB > 0 || bToA > 0) pairs.push({ a, b, aToB, bToA, max: Math.max(aToB, bToA) });
    }
    for (const r of refs) {
      const a = subs[x].doc.id;
      const aToB = pct(a, r.doc.id);
      if (aToB > 0) pairs.push({ a, b: r.doc.id, aToB, bToA: null, max: aToB });
    }
  }
  pairs.sort((p, q) => q.max - p.max);

  return { results, pairs };
}

/**
 * Estado según el umbral configurado. Se usa el porcentaje redondeado (el mismo que se muestra)
 * para que el estado siempre coincida con lo que ve la docente.
 * Debajo del umbral = Clear; del umbral a 29 % = Review; 30 % o más = High match.
 */
export function similarityStatus(percent: number, threshold: number): SimilarityStatus {
  const p = Math.round(percent);
  if (p >= HIGH_MATCH_PERCENT) return 'high';
  if (p >= threshold) return 'review';
  return 'clear';
}
