// Tipos de resultados de análisis compartidos entre la lógica y la interfaz.

export type CheckOutcome = 'passed' | 'review' | 'failed' | 'na';

export interface CheckResult {
  id: string;
  name: string;
  outcome: CheckOutcome;
  detail: string;
  /** Ejemplos concretos (oraciones, fragmentos) para mostrar al expandir la revisión. */
  instances?: string[];
  group: 'format' | 'writing' | 'custom';
}

export type SimilarityStatus = 'clear' | 'review' | 'high';

export type AiLevel = 'Low' | 'Moderate' | 'Elevated';

export const NOT_AVAILABLE = 'Not available for this file type';
