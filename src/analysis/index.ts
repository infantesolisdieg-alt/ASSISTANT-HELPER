// Ejecuta todos los análisis sobre los documentos analizados de la sesión.

import type { Settings } from '../settings';
import type { DocItem } from '../types';
import { analyzeAi, type AiResult } from './ai';
import { runCustomRules } from './customRules';
import { runFigureChecks } from './figures';
import { runFormatChecks } from './format';
import { computeSimilarity, similarityStatus, type SimilarPair, type SimilarityResult } from './similarity';
import { countWords } from './text';
import type { CheckResult, SimilarityStatus } from './types';
import { runWritingChecks } from './writing';

export interface DocAnalysis {
  similarity: SimilarityResult;
  status: SimilarityStatus;
  checks: CheckResult[];
  ai: AiResult | null;
  wordCount: number;
}

export interface SessionAnalysis {
  byId: Map<string, DocAnalysis>;
  pairs: SimilarPair[];
}

export function analyzeAll(docs: DocItem[], settings: Settings): SessionAnalysis {
  const ready = docs.filter((d) => d.state === 'ready');
  const { results, pairs } = computeSimilarity(ready.map((d) => ({ id: d.id, text: d.text, isReference: d.isReference })));
  const byId = new Map<string, DocAnalysis>();

  for (const d of ready) {
    if (d.isReference) continue;
    const similarity = results.get(d.id)!;
    const checks = [
      ...runFormatChecks({ kind: d.kind, text: d.text, docxFormat: d.docxFormat }, settings),
      ...runWritingChecks(d.text, settings),
      ...(settings.checks.tablesFigures
        ? runFigureChecks({ kind: d.kind, text: d.text, tables: d.tables, figures: d.figures })
        : []),
      ...runCustomRules(d.text, settings.customRules),
    ];
    byId.set(d.id, {
      similarity,
      status: similarityStatus(similarity.percent, settings.similarityThreshold),
      checks,
      ai: settings.checks.aiIndicators ? analyzeAi(d.text) : null,
      wordCount: countWords(d.text),
    });
  }
  return { byId, pairs };
}

export function hasAlert(a: DocAnalysis | undefined): boolean {
  if (!a) return false;
  return a.status === 'high' || a.ai?.level === 'Elevated' || a.checks.some((c) => c.outcome === 'failed');
}
