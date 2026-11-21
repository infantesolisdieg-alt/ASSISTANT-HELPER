// Lectura de .pdf con pdfjs-dist (carga diferida). Conserva la posición de cada fragmento
// para resaltar sobre la página original. Las páginas sin texto (escaneadas) se leen con OCR.

import { t } from '../i18n';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { assembleLines, type LayoutLine } from './layout';
import { ocrImage } from './ocr';
import type { ExtractedFile, FigureInfo, PageLayout, ProgressFn, TableInfo } from './types';

/** Máximo de páginas escaneadas que se leen con OCR (el OCR tarda varios segundos por página). */
export const MAX_OCR_PAGES = 15;

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

async function getPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

// Documentos abiertos, para dibujar las páginas en el visor sin volver a leer el archivo
const openDocs = new Map<string, Promise<PDFDocumentProxy>>();

export async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  let p = openDocs.get(url);
  if (!p) {
    p = getPdfJs().then((pdfjs) => pdfjs.getDocument({ url }).promise);
    openDocs.set(url, p);
    p.catch(() => openDocs.delete(url));
  }
  return p;
}

export function closePdf(url: string): void {
  const p = openDocs.get(url);
  openDocs.delete(url);
  p?.then((d) => d.destroy()).catch(() => undefined);
}

interface RawItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  eol: boolean;
}

export async function readPdf(url: string, onProgress?: ProgressFn): Promise<ExtractedFile> {
  const pdfjs = await getPdfJs();
  let pdf: PDFDocumentProxy;
  try {
    pdf = await loadPdf(url);
  } catch {
    throw new Error(t('This PDF could not be opened. It may be damaged or password-protected.'));
  }

  const lines: LayoutLine[] = [];
  const pages: PageLayout[] = [];
  const imagesPerPage: number[] = [];
  let ocrUsed = 0;
  let skipped = 0;
  let confidenceSum = 0;
  const imageOps = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageXObjectRepeat]);

  for (let n = 1; n <= pdf.numPages; n++) {
    onProgress?.(t('Reading page {n} of {total}…', { n, total: pdf.numPages }), (n - 1) / pdf.numPages);
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items: RawItem[] = [];
    for (const it of content.items) {
      if (!('str' in it)) continue;
      const [x, baseline] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      const h = it.height || Math.abs(it.transform[3]) || 10;
      items.push({ str: it.str, x, y: baseline - h, w: it.width, h, eol: it.hasEOL });
    }
    const chars = items.reduce((s, i) => s + i.str.trim().length, 0);

    let images = 0;
    try {
      const ops = await page.getOperatorList();
      images = ops.fnArray.filter((f) => imageOps.has(f)).length;
    } catch {
      images = 0;
    }

    pages.push({ width: viewport.width, height: viewport.height, boxes: [], ocr: false });

    if (chars < 15) {
      // Página escaneada: se dibuja y se lee con OCR
      if (ocrUsed >= MAX_OCR_PAGES) {
        skipped++;
        imagesPerPage.push(0);
        continue;
      }
      ocrUsed++;
      const scale = 2;
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d');
      if (ctx) await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const res = await ocrImage(canvas, n, 1 / scale, (p) =>
        onProgress?.(t('Recognizing text on page {n} of {total} ({p}%)…', { n, total: pdf.numPages, p: Math.round(p * 100) }), (n - 1 + p) / pdf.numPages),
      );
      lines.push(...res.lines);
      confidenceSum += res.confidence;
      pages[n - 1].ocr = true;
      imagesPerPage.push(0); // la imagen es la página escaneada, no una figura
      continue;
    }
    imagesPerPage.push(images);

    // Agrupa los fragmentos en líneas
    const pageLines: { items: RawItem[]; y: number; h: number }[] = [];
    let cur: RawItem[] = [];
    const flush = () => {
      if (cur.length) {
        const first = cur.find((i) => i.str.trim()) ?? cur[0];
        pageLines.push({ items: cur, y: first.y, h: first.h });
      }
      cur = [];
    };
    for (const it of items) {
      cur.push(it);
      if (it.eol) flush();
    }
    flush();

    // Distancia típica entre líneas para detectar separación de párrafos
    const gaps: number[] = [];
    for (let i = 1; i < pageLines.length; i++) {
      const g = pageLines[i].y - pageLines[i - 1].y;
      if (g > 0) gaps.push(g);
    }
    gaps.sort((a, b) => a - b);
    const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

    pageLines.forEach((l, i) => {
      const prev = pageLines[i - 1];
      const paraStart = i === 0 || (typical > 0 && l.y - prev.y > typical * 1.5);
      lines.push({
        page: n,
        paraStart,
        items: l.items.map((it) => ({ str: it.str, box: { x: it.x, y: it.y, w: it.w, h: it.h } })),
      });
    });
  }
  onProgress?.(t('Finishing…'), 1);

  const { paragraphs, boxesByPage } = assembleLines(lines);
  boxesByPage.forEach((boxes, page) => {
    if (pages[page - 1]) pages[page - 1].boxes = boxes;
  });

  // Figuras: imágenes encontradas en las páginas; tablas: títulos "Table N" del texto
  const pageOfOffset = (offset: number) => {
    for (let i = 0; i < pages.length; i++) {
      const b = pages[i].boxes;
      if (b.length && offset >= b[0].start && offset <= b[b.length - 1].end) return i + 1;
    }
    return undefined;
  };
  const captions = { figure: [] as { text: string; page?: number }[], table: [] as { text: string; page?: number }[] };
  let pos = 0;
  for (const p of paragraphs) {
    const first = p.split('\n')[0].trim();
    if (/^(figure|fig\.?)\s*\d+/i.test(first)) captions.figure.push({ text: first, page: pageOfOffset(pos) });
    if (/^table\s+\d+/i.test(first)) captions.table.push({ text: first, page: pageOfOffset(pos) });
    pos += p.length + 2;
  }

  const figures: FigureInfo[] = [];
  imagesPerPage.forEach((count, i) => {
    for (let k = 0; k < count; k++) figures.push({ kind: 'image', caption: null, page: i + 1 });
  });
  // Asigna los títulos de figura en orden, prefiriendo la misma página
  const freeCaptions = [...captions.figure];
  for (const f of figures) {
    const idx = freeCaptions.findIndex((c) => c.page === f.page);
    const c = idx >= 0 ? freeCaptions.splice(idx, 1)[0] : undefined;
    if (c) f.caption = c.text;
  }
  // Títulos de figura sin imagen detectada (por ejemplo, gráficas vectoriales)
  for (const c of freeCaptions) figures.push({ kind: 'image', caption: c.text, page: c.page });

  const tables: TableInfo[] = captions.table.map((c) => ({ rows: [], caption: c.text, page: c.page }));

  return {
    kind: 'pdf',
    paragraphs,
    pages,
    figures,
    tables,
    ocrConfidence: ocrUsed ? confidenceSum / ocrUsed : undefined,
    skippedPages: skipped || undefined,
  };
}
