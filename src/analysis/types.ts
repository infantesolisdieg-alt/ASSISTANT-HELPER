// Tipos de resultados de análisis compartidos entre la lógica y la interfaz.

import { tk } from '../i18n';

export type CheckOutcome = 'passed' | 'review' | 'failed' | 'na';

export interface CheckResult {
  id: string;
  name: string;
  outcome: CheckOutcome;
  detail: string;
  /** Ejemplos concretos (oraciones, fragmentos) para mostrar al expandir la revisión. */
  instances?: string[];
  group: 'format' | 'writing' | 'figures' | 'custom';
}

export type SimilarityStatus = 'clear' | 'review' | 'high';

export type AiLevel = 'Low' | 'Moderate' | 'Elevated';

export const NOT_AVAILABLE = tk('Not available for this file type');
