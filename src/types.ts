import type { DocxFormat, FileKind } from './extract/types';

export type ReviewStatus = 'pending' | 'approved' | 'needs-corrections';

export interface Note {
  id: string;
  text: string;
  at: number;
}

/** Un documento cargado en la sesión. Vive solo en memoria. */
export interface DocItem {
  id: string;
  fileName: string;
  kind: FileKind;
  studentName: string;
  assignmentTitle: string;
  isReference: boolean;
  /** Texto completo: párrafos separados por una línea en blanco. */
  text: string;
  docxFormat?: DocxFormat;
  /** 'reading' mientras se extrae el texto; 'error' si no se pudo leer. */
  state: 'reading' | 'ready' | 'error';
  error?: string;
  /** true cuando la docente presionó "Analyze" en la pantalla Upload. */
  analyzed: boolean;
  reviewStatus: ReviewStatus;
  finalComment: string;
  reviewedAt?: number;
  notes: Note[];
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  'needs-corrections': 'Needs corrections',
};
