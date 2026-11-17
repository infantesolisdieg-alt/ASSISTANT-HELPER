import type { Alignment } from '../settings';

export type FileKind = 'docx' | 'pdf' | 'txt';

export interface DocxFormat {
  /** Fuente predominante (por número de caracteres). */
  font: string | null;
  fontShare: number;
  fontSizePt: number | null;
  fontSizeShare: number;
  /** Interlineado como múltiplo (1, 1.5, 2...). null si se usa un alto fijo. */
  lineSpacing: number | null;
  lineSpacingShare: number;
  lineSpacingExactPt: number | null;
  alignment: Alignment | null;
  alignmentShare: number;
  marginsCm: { top: number; right: number; bottom: number; left: number } | null;
  hasTitleStyle: boolean;
}

export interface ExtractedFile {
  kind: FileKind;
  paragraphs: string[];
  docxFormat?: DocxFormat;
}
