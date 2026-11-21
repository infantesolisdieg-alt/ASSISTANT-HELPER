// Calidad de redacción en inglés: voz pasiva, oraciones demasiado largas y palabras repetidas.

import { t, tn } from '../i18n';
import type { Settings } from '../settings';
import { splitSentences, STOPWORDS, tokenize, truncate } from './text';
import type { CheckResult } from './types';

export const LONG_SENTENCE_WORDS = 35;
const REPEAT_WINDOW = 8;

const IRREGULAR_PARTICIPLES =
  'written given taken made done sent held known shown seen found told paid built chosen spoken brought bought kept left lost met put read said set sold thought understood won begun broken drawn driven eaten fallen forgotten gotten grown hidden ridden risen shaken stolen sworn thrown worn woken led sent spent taught caught felt heard hit hurt laid lent meant sought shut split spread stuck struck torn undertaken withdrawn forbidden overtaken'.split(
    ' ',
  );

// Palabras en -ed que normalmente no forman voz pasiva después de "to be"
const NOT_PASSIVE = new Set(
  'need indeed speed feed seed proceed exceed succeed bleed breed greed weed deed shed bed red pleased interested excited delighted tired bored worried concerned satisfied scared surprised married supposed glad based'.split(
    ' ',
  ),
);

const PASSIVE_RE = new RegExp(
  String.raw`\b(am|is|are|was|were|be|been|being)\s+(?:(?:not|also|already|usually|often|always|never|\w+ly)\s+)?(\w+ed|${IRREGULAR_PARTICIPLES.join('|')})\b`,
  'gi',
);

export function findPassive(text: string): string[] {
  const out: string[] = [];
  for (const s of splitSentences(text)) {
    for (const m of s.text.matchAll(PASSIVE_RE)) {
      if (NOT_PASSIVE.has(m[2].toLowerCase())) continue;
      out.push(s.text);
      break;
    }
  }
  return out;
}

export function findLongSentences(text: string, limit = LONG_SENTENCE_WORDS): { text: string; words: number }[] {
  return splitSentences(text)
    .filter((s) => s.words > limit)
    .map((s) => ({ text: s.text, words: s.words }));
}

export function findRepeatedWords(text: string, window = REPEAT_WINDOW): { word: string; distance: number; context: string }[] {
  const tokens = tokenize(text);
  const out: { word: string; distance: number; context: string }[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const w = tokens[i].word;
    if (w.length < 4 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    for (let k = i - 1; k >= Math.max(0, i - window); k--) {
      if (tokens[k].word !== w) continue;
      // no contar repeticiones que cruzan un salto de párrafo
      if (text.slice(tokens[k].end, tokens[i].start).includes('\n\n')) break;
      out.push({ word: w, distance: i - k, context: text.slice(tokens[k].start, tokens[i].end) });
      break;
    }
  }
  return out;
}

export function runWritingChecks(text: string, settings: Settings): CheckResult[] {
  const out: CheckResult[] = [];
  const sentences = splitSentences(text).filter((s) => s.words >= 3);

  if (settings.checks.passiveVoice) {
    const passive = findPassive(text);
    const ratio = sentences.length ? passive.length / sentences.length : 0;
    out.push({
      id: 'passiveVoice',
      name: t('Passive voice'),
      outcome: ratio <= 0.2 ? 'passed' : 'review',
      detail:
        passive.length === 0
          ? t('No passive constructions found.')
          : tn(passive.length, '{n} sentence with passive voice ({p}% of sentences).', '{n} sentences with passive voice ({p}% of sentences).', {
              p: Math.round(ratio * 100),
            }),
      instances: passive.slice(0, 10).map((s) => truncate(s)),
      group: 'writing',
    });
  }

  if (settings.checks.longSentences) {
    const long = findLongSentences(text);
    out.push({
      id: 'longSentences',
      name: t('Long sentences (> {max} words)', { max: LONG_SENTENCE_WORDS }),
      outcome: long.length === 0 ? 'passed' : 'review',
      detail:
        long.length === 0
          ? t('No overly long sentences.')
          : tn(long.length, '{n} sentence longer than {max} words.', '{n} sentences longer than {max} words.', { max: LONG_SENTENCE_WORDS }),
      instances: long.slice(0, 10).map((s) => t('{words} words: {text}', { words: s.words, text: truncate(s.text) })),
      group: 'writing',
    });
  }

  if (settings.checks.repeatedWords) {
    const rep = findRepeatedWords(text);
    out.push({
      id: 'repeatedWords',
      name: t('Repeated words'),
      outcome: rep.length <= 2 ? 'passed' : 'review',
      detail:
        rep.length === 0
          ? t('No words repeated close together.')
          : tn(rep.length, '{n} word repeated within {window} words of itself.', '{n} words repeated within {window} words of each other.', {
              window: REPEAT_WINDOW,
            }),
      instances: rep.slice(0, 10).map((r) => `“${r.word}”: ${truncate(r.context, 110)}`),
      group: 'writing',
    });
  }

  return out;
}
