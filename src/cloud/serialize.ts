// Convierte un documento de la sesión en un registro para Firestore y viceversa.
// Firestore no acepta listas dentro de listas ni valores undefined, y un documento puede
// pesar como máximo 1 MiB; por eso los datos detallados viajan como texto JSON y se recortan si es necesario.

import { parseSettings, serializeSettings, type Settings } from '../settings';
import type { DocItem, ReviewStatus, TeacherProfile } from '../types';

/** Margen seguro por debajo de 1 MiB (un carácter acentuado ocupa más de un byte). */
export const MAX_DATA_CHARS = 600_000;

export interface CloudSubmission {
  v: 1;
  studentName: string;
  group: string;
  assignmentTitle: string;
  fileName: string;
  kind: DocItem['kind'];
  isReference: boolean;
  reviewStatus: ReviewStatus;
  createdAt: number;
  /** JSON con el texto y los resultados detallados. */
  data: string;
}

interface Payload {
  text: string;
  truncated?: boolean;
  fileSize?: number;
  paraRanges?: DocItem['paraRanges'];
  docxFormat?: DocItem['docxFormat'];
  blocks?: DocItem['blocks'];
  tables?: DocItem['tables'];
  figures?: DocItem['figures'];
  ocrConfidence?: number;
  finalComment: string;
  reviewedAt?: number;
  notes: DocItem['notes'];
}

export function toCloud(d: DocItem, createdAt: number): CloudSubmission {
  const base: Payload = {
    text: d.text,
    fileSize: d.fileSize,
    paraRanges: d.paraRanges,
    docxFormat: d.docxFormat,
    blocks: d.blocks,
    tables: d.tables?.map((t) => ({ ...t, rows: t.rows.slice(0, 200) })),
    // Las imágenes no se suben (solo existen en esta computadora); se guarda su título, gráfica y texto leído
    figures: d.figures?.map(({ src: _src, ...f }) => f),
    ocrConfidence: d.ocrConfidence,
    finalComment: d.finalComment,
    reviewedAt: d.reviewedAt,
    notes: d.notes,
  };
  let data = JSON.stringify(base);
  if (data.length > MAX_DATA_CHARS) {
    // Primero se quita la estructura (el texto es lo importante)
    const slim: Payload = { ...base, blocks: undefined, tables: undefined, paraRanges: undefined };
    data = JSON.stringify(slim);
    if (data.length > MAX_DATA_CHARS) {
      const over = data.length - MAX_DATA_CHARS;
      data = JSON.stringify({ ...slim, text: d.text.slice(0, Math.max(0, d.text.length - over - 1000)), truncated: true });
    }
  }
  return {
    v: 1,
    studentName: d.studentName,
    group: d.group ?? '',
    assignmentTitle: d.assignmentTitle,
    fileName: d.fileName,
    kind: d.kind,
    isReference: d.isReference,
    reviewStatus: d.reviewStatus,
    createdAt,
    data,
  };
}

export function fromCloud(id: string, r: CloudSubmission): DocItem {
  let p: Partial<Payload> = {};
  try {
    p = JSON.parse(r.data) as Payload;
  } catch {
    p = {};
  }
  return {
    id,
    fileName: r.fileName ?? 'file',
    fileSize: p.fileSize,
    kind: r.kind ?? 'txt',
    studentName: r.studentName ?? '',
    group: r.group ?? '',
    assignmentTitle: r.assignmentTitle ?? '',
    isReference: !!r.isReference,
    text: p.text ?? '',
    paraRanges: p.paraRanges,
    docxFormat: p.docxFormat,
    blocks: p.blocks,
    tables: p.tables,
    figures: p.figures,
    ocrConfidence: p.ocrConfidence,
    state: 'ready',
    analyzed: true,
    reviewStatus: r.reviewStatus ?? 'pending',
    finalComment: p.finalComment ?? '',
    reviewedAt: p.reviewedAt,
    notes: Array.isArray(p.notes) ? p.notes : [],
  };
}

export interface CloudAccount {
  profile: { name: string; role: string; group: string };
  settings: string;
}

export function accountToCloud(profile: TeacherProfile, settings: Settings): CloudAccount {
  return {
    profile: { name: profile.name, role: profile.role, group: profile.group },
    settings: serializeSettings(settings),
  };
}

/** Lee la configuración guardada; si está dañada se usa la configuración por defecto. */
export function settingsFromCloud(raw: string | undefined): Settings | null {
  if (!raw) return null;
  try {
    return parseSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}
