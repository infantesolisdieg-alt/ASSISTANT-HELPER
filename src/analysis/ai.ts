// Indicadores heurísticos de texto posiblemente generado por IA.
// Todo se calcula en el navegador. Son orientativos, nunca determinantes.

import { clamp01, splitParagraphs, splitSentences, tokenize, type Sentence } from './text';
import type { AiLevel } from './types';

export const AI_DISCLAIMER =
  'AI indicators are advisory, not determinative. Always consider them alongside drafting history, student context and your own judgment.';

export const AI_PHRASES: { phrase: string; weight: number }[] = [
  { phrase: 'delve into', weight: 1 },
  { phrase: 'delves into', weight: 1 },
  { phrase: 'delving into', weight: 1 },
  { phrase: 'it is important to note', weight: 1 },
  { phrase: 'it is worth noting', weight: 0.9 },
  { phrase: "in today's fast-paced world", weight: 1 },
  { phrase: "in today's digital age", weight: 1 },
  { phrase: "in today's world", weight: 0.6 },
  { phrase: 'tapestry', weight: 0.9 },
  { phrase: 'plays a crucial role', weight: 0.8 },
  { phrase: 'plays a vital role', weight: 0.8 },
  { phrase: 'plays a pivotal role', weight: 0.9 },
  { phrase: 'navigate the complexities', weight: 1 },
  { phrase: 'ever-evolving', weight: 0.9 },
  { phrase: 'ever-changing landscape', weight: 0.9 },
  { phrase: 'landscape', weight: 0.35 },
  { phrase: 'realm', weight: 0.6 },
  { phrase: 'a testament to', weight: 0.8 },
  { phrase: 'unlock the potential', weight: 0.9 },
  { phrase: 'harness the power', weight: 0.9 },
  { phrase: 'a myriad of', weight: 0.8 },
  { phrase: 'multifaceted', weight: 0.7 },
  { phrase: 'holistic', weight: 0.5 },
  { phrase: 'paramount', weight: 0.5 },
  { phrase: 'embark on', weight: 0.6 },
  { phrase: 'seamlessly', weight: 0.6 },
  { phrase: 'seamless', weight: 0.5 },
  { phrase: 'foster', weight: 0.45 },
  { phrase: 'streamline', weight: 0.35 },
  { phrase: 'leverage', weight: 0.45 },
  { phrase: 'robust', weight: 0.35 },
  { phrase: 'pivotal', weight: 0.5 },
  { phrase: 'crucial', weight: 0.25 },
  { phrase: 'underscores', weight: 0.6 },
  { phrase: 'serves as a', weight: 0.4 },
  { phrase: 'meticulous', weight: 0.6 },
  { phrase: 'meticulously', weight: 0.6 },
  { phrase: 'intricate', weight: 0.5 },
  { phrase: 'elevate', weight: 0.45 },
  { phrase: 'commendable', weight: 0.5 },
  { phrase: 'invaluable', weight: 0.4 },
  { phrase: 'cutting-edge', weight: 0.4 },
  { phrase: 'game-changer', weight: 0.5 },
  { phrase: 'in conclusion', weight: 0.35 },
  { phrase: 'in summary', weight: 0.35 },
  { phrase: 'furthermore', weight: 0.3 },
  { phrase: 'moreover', weight: 0.3 },
  { phrase: 'additionally', weight: 0.25 },
];

const PHRASE_RES = [...AI_PHRASES]
  .sort((a, b) => b.phrase.length - a.phrase.length)
  .map((p) => ({
    ...p,
    re: new RegExp(`(?<![\\p{L}])${p.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu'),
  }));

export interface AiSignal {
  id: 'phrases' | 'burstiness' | 'vocabulary' | 'openers' | 'styleShift';
  name: string;
  /** 0 a 1; null cuando no hay suficiente texto para calcularlo. */
  score: number | null;
  detail: string;
}

export interface AiSentence {
  start: number;
  end: number;
  text: string;
  score: number;
  reasons: string[];
}

export interface AiResult {
  percent: number;
  level: AiLevel;
  signals: AiSignal[];
  sentences: AiSentence[];
  /** false cuando el texto es demasiado corto para que los indicadores sean confiables. */
  reliable: boolean;
}

const WEIGHTS: Record<AiSignal['id'], number> = {
  phrases: 0.35,
  burstiness: 0.2,
  vocabulary: 0.15,
  openers: 0.15,
  styleShift: 0.15,
};

function normalizeQuotes(s: string): string {
  return s.replace(/[’‘]/g, "'");
}

export function phraseHits(text: string): { phrase: string; weight: number }[] {
  let t = normalizeQuotes(text);
  const hits: { phrase: string; weight: number }[] = [];
  // Las frases más largas primero; lo encontrado se borra para no contar
  // "crucial" otra vez dentro de "plays a crucial role".
  for (const p of PHRASE_RES) {
    t = t.replace(p.re, (m) => {
      hits.push({ phrase: p.phrase, weight: p.weight });
      return ' '.repeat(m.length);
    });
  }
  return hits;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

function stdev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Moving-average type-token ratio (ventana de 50 palabras), independiente de la longitud. */
export function mattr(words: string[], window = 50): number {
  if (words.length === 0) return 0;
  if (words.length <= window) return new Set(words).size / words.length;
  const counts = new Map<string, number>();
  let distinct = 0;
  let total = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const c = counts.get(w) ?? 0;
    if (c === 0) distinct++;
    counts.set(w, c + 1);
    if (i >= window) {
      const old = words[i - window];
      const oc = counts.get(old)!;
      if (oc === 1) distinct--;
      counts.set(old, oc - 1);
    }
    if (i >= window - 1) total += distinct / window;
  }
  return total / (words.length - window + 1);
}

function firstWord(s: Sentence): string {
  return tokenize(s.text)[0]?.word ?? '';
}

export function analyzeAi(text: string): AiResult {
  const words = tokenize(text).map((t) => t.word);
  const sentences = splitSentences(text).filter((s) => s.words >= 4);
  const signals: AiSignal[] = [];

  // 1. Frases típicas
  const hits = phraseHits(text);
  const weighted = hits.reduce((s, h) => s + h.weight, 0);
  const density = words.length ? (weighted / words.length) * 100 : 0;
  const distinctPhrases = [...new Set(hits.map((h) => h.phrase))];
  signals.push({
    id: 'phrases',
    name: 'Typical AI phrases',
    score: words.length ? clamp01(density / 1.5) : null,
    detail:
      hits.length === 0
        ? 'No typical phrases found.'
        : `${hits.length} occurrence(s): ${distinctPhrases.slice(0, 6).map((p) => `“${p}”`).join(', ')}${distinctPhrases.length > 6 ? ' and others.' : '.'}`,
  });

  // 2. Variación de longitud de oraciones (texto muy uniforme = señal)
  const lengths = sentences.map((s) => s.words);
  const cv = lengths.length ? stdev(lengths) / mean(lengths) : 0;
  const burstScore = lengths.length >= 5 ? clamp01((0.55 - cv) / 0.3) : null;
  signals.push({
    id: 'burstiness',
    name: 'Sentence length variation',
    score: burstScore,
    detail:
      burstScore === null
        ? 'Not enough sentences to measure.'
        : `Variation coefficient ${cv.toFixed(2)} (lower means more uniform sentences; typical human writing is above 0.5).`,
  });

  // 3. Diversidad de vocabulario
  const m = mattr(words);
  const vocabScore = words.length >= 80 ? clamp01((0.7 - m) / 0.15) : null;
  signals.push({
    id: 'vocabulary',
    name: 'Vocabulary diversity',
    score: vocabScore,
    detail: vocabScore === null ? 'Not enough words to measure.' : `Type-token ratio ${m.toFixed(2)} (moving average, 50-word window).`,
  });

  // 4. Inicios de oración repetitivos
  const openerCounts = new Map<string, number>();
  for (const s of sentences) {
    const w = firstWord(s);
    openerCounts.set(w, (openerCounts.get(w) ?? 0) + 1);
  }
  const repeatedOpeners = new Set([...openerCounts].filter(([, c]) => c >= 3).map(([w]) => w));
  const repeatedShare = sentences.length
    ? sentences.filter((s) => repeatedOpeners.has(firstWord(s))).length / sentences.length
    : 0;
  const openerScore = sentences.length >= 5 ? clamp01((repeatedShare - 0.15) / 0.35) : null;
  signals.push({
    id: 'openers',
    name: 'Repetitive sentence openers',
    score: openerScore,
    detail:
      openerScore === null
        ? 'Not enough sentences to measure.'
        : repeatedOpeners.size === 0
          ? 'Sentence openers are varied.'
          : `${Math.round(repeatedShare * 100)}% of sentences start with: ${[...repeatedOpeners].map((w) => `“${w}”`).join(', ')}.`,
  });

  // 5. Cambios bruscos de estilo entre párrafos
  const paraStats = splitParagraphs(text)
    .map((p) => {
      const ss = splitSentences(p.text).filter((s) => s.words >= 4);
      const ws = tokenize(p.text);
      return {
        words: ws.length,
        avgSentence: mean(ss.map((s) => s.words)),
        avgWordLen: mean(ws.map((w) => w.word.length)),
        sentences: ss.length,
      };
    })
    .filter((p) => p.words >= 30 && p.sentences >= 2);
  let styleScore: number | null = null;
  let maxJump = 0;
  if (paraStats.length >= 3) {
    const avgS = mean(paraStats.map((p) => p.avgSentence));
    const avgW = mean(paraStats.map((p) => p.avgWordLen));
    for (let i = 1; i < paraStats.length; i++) {
      const a = paraStats[i - 1];
      const b = paraStats[i];
      const jump = (Math.abs(a.avgSentence - b.avgSentence) / avgS + (Math.abs(a.avgWordLen - b.avgWordLen) / avgW) * 3) / 2;
      maxJump = Math.max(maxJump, jump);
    }
    styleScore = clamp01((maxJump - 0.4) / 0.6);
  }
  signals.push({
    id: 'styleShift',
    name: 'Style shifts between paragraphs',
    score: styleScore,
    detail:
      styleScore === null
        ? 'Not enough full paragraphs to compare.'
        : styleScore === 0
          ? 'Paragraph style is consistent.'
          : `A noticeable change in sentence and word length between paragraphs (shift index ${maxJump.toFixed(2)}).`,
  });

  // Puntaje ponderado sobre las señales disponibles
  let num = 0;
  let den = 0;
  for (const s of signals) {
    if (s.score === null) continue;
    num += WEIGHTS[s.id] * s.score;
    den += WEIGHTS[s.id];
  }
  const percent = den ? Math.round((num / den) * 100) : 0;

  // Oraciones que más contribuyen
  const meanLen = mean(lengths);
  const scored: AiSentence[] = sentences.map((s) => {
    const reasons: string[] = [];
    let score = 0;
    const sh = phraseHits(s.text);
    if (sh.length) {
      score += sh.reduce((a, h) => a + h.weight, 0);
      reasons.push(`Typical phrase: ${[...new Set(sh.map((h) => `“${h.phrase}”`))].join(', ')}`);
    }
    if (burstScore && burstScore > 0.3 && meanLen && Math.abs(s.words - meanLen) / meanLen < 0.15) {
      score += 0.3 * burstScore;
      reasons.push('Uniform sentence length');
    }
    if (openerScore && openerScore > 0 && repeatedOpeners.has(firstWord(s))) {
      score += 0.3 * openerScore;
      reasons.push(`Repeated opener “${firstWord(s)}”`);
    }
    return { start: s.start, end: s.end, text: s.text, score, reasons };
  });
  const top = scored
    .filter((s) => s.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .sort((a, b) => a.start - b.start);

  return {
    percent,
    level: aiLevel(percent),
    signals,
    sentences: top,
    reliable: words.length >= 120 && sentences.length >= 5,
  };
}

export function aiLevel(percent: number): AiLevel {
  if (percent >= 45) return 'Elevated';
  if (percent >= 25) return 'Moderate';
  return 'Low';
}
