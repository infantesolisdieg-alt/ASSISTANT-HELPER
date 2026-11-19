import type { Alignment } from '../settings';

export type FileKind = 'docx' | 'pdf' | 'txt' | 'image';

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

/** Caja de un fragmento de texto dentro de una página, en unidades de la página. */
export interface TextBox {
  /** Posición del fragmento dentro del texto completo del documento. */
  start: number;
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Página de un PDF o imagen: tamaño y dónde está cada fragmento de texto. */
export interface PageLayout {
  width: number;
  height: number;
  boxes: TextBox[];
  /** true si el texto de esta página se obtuvo con reconocimiento de texto (OCR). */
  ocr: boolean;
}

/** Datos de una gráfica nativa de Word (word/charts/chartN.xml). */
export interface ChartData {
  type: string;
  title: string | null;
  categories: string[];
  series: { name: string; values: number[] }[];
  axisTitles: string[];
}

export interface TableInfo {
  rows: string[][];
  caption: string | null;
  page?: number;
}

export interface FigureInfo {
  kind: 'image' | 'chart';
  caption: string | null;
  page?: number;
  /** URL temporal (blob:) de la imagen, solo en memoria. */
  src?: string;
  chart?: ChartData;
  /** Texto leído dentro de la imagen con OCR (a petición de la docente). */
  ocrText?: string;
}

/** Bloques del .docx en orden, para mostrar el documento con su estructura. */
export type DocBlock =
  | { type: 'p'; para: number; style: 'title' | 'heading' | 'caption' | 'normal'; align: Alignment }
  | { type: 'table'; table: number; rows: number[][][] }
  | { type: 'figure'; figure: number };

export interface ExtractedFile {
  kind: FileKind;
  paragraphs: string[];
  docxFormat?: DocxFormat;
  pages?: PageLayout[];
  blocks?: DocBlock[];
  tables?: TableInfo[];
  figures?: FigureInfo[];
  /** Confianza promedio del OCR (0–100) si se usó. */
  ocrConfidence?: number;
  /** Páginas que no se procesaron por el límite de OCR. */
  skippedPages?: number;
}

export type ProgressFn = (label: string, value: number) => void;

/** Rangos [inicio, fin] de cada párrafo dentro del texto unido con "\n\n". */
export function paragraphRanges(paragraphs: string[]): [number, number][] {
  const out: [number, number][] = [];
  let pos = 0;
  for (const p of paragraphs) {
    out.push([pos, pos + p.length]);
    pos += p.length + 2;
  }
  return out;
}
