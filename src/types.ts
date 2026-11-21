import type { DocBlock, DocxFormat, FigureInfo, FileKind, PageLayout, TableInfo } from './extract/types';

export type ReviewStatus = 'pending' | 'approved' | 'needs-corrections';

/** Perfil del profesor de la sesión. Solo vive en memoria. */
export interface TeacherProfile {
  name: string;
  role: string;
  group: string;
  /** Solo con cuenta de Google. */
  uid?: string;
  email?: string;
  photoURL?: string;
  /** Versión de los términos que aceptó (ver src/terms.ts) y cuándo. */
  termsVersion?: string;
  termsAcceptedAt?: number;
}

export const DEMO_PROFILE: TeacherProfile = {
  name: 'Nalleli Olvera Castelan',
  role: 'Teacher · Bilingual Executive Secretary',
  group: '',
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const second = parts.length > 1 ? parts[1][0] : '';
  return (first + second).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

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
  fileSize?: number;
  /** De dónde se subió el archivo (para mostrar el icono en Upload). */
  source?: 'computer' | 'drive';
  studentName: string;
  /** Grupo del alumno (por ejemplo "5A"). Vacío si no se indicó. */
  group: string;
  assignmentTitle: string;
  isReference: boolean;
  /** Texto completo: párrafos separados por una línea en blanco. */
  text: string;
  /** Inicio y fin de cada párrafo dentro de `text`. */
  paraRanges?: [number, number][];
  docxFormat?: DocxFormat;
  /** URL temporal (blob:) del archivo original, para PDF e imágenes. */
  sourceUrl?: string;
  pages?: PageLayout[];
  blocks?: DocBlock[];
  tables?: TableInfo[];
  figures?: FigureInfo[];
  ocrConfidence?: number;
  skippedPages?: number;
  /** 'reading' mientras se extrae el texto; 'error' si no se pudo leer. */
  state: 'reading' | 'ready' | 'error';
  progress?: { label: string; value: number };
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

/** Libera las URLs temporales de un documento (el archivo original y sus imágenes). */
export function releaseDoc(d: DocItem): void {
  if (d.sourceUrl) {
    URL.revokeObjectURL(d.sourceUrl);
    if (d.kind === 'pdf') import('./extract/pdf').then((m) => m.closePdf(d.sourceUrl!)).catch(() => undefined);
  }
  for (const f of d.figures ?? []) if (f.src) URL.revokeObjectURL(f.src);
}

export const NO_GROUP = 'No group';

/** Nombre del grupo para mostrar (los vacíos se agrupan como "No group"). */
export function groupLabel(group: string | undefined): string {
  return group?.trim() || NO_GROUP;
}

/** Normaliza lo que escribe la docente: sin espacios extra ("  5 a " → "5 a"). */
export function cleanGroup(group: string): string {
  return group.replace(/\s+/g, ' ').trim();
}

/** Grupos distintos de una lista de documentos, en orden alfabético ("No group" al final). */
export function groupsOf(docs: DocItem[]): string[] {
  const set = new Set(docs.map((d) => cleanGroup(d.group ?? '')).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));
}
