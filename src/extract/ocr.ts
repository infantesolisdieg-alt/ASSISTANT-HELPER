// Reconocimiento de texto (OCR) con tesseract.js, 100 % en el navegador.
// La imagen nunca sale de la computadora; solo se descargan una vez los datos del idioma inglés.

import { t } from '../i18n';
import type { LayoutLine } from './layout';

type TesseractWorker = import('tesseract.js').Worker;

let workerPromise: Promise<TesseractWorker> | null = null;
let progressHandler: ((p: number) => void) | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') progressHandler?.(m.progress);
        },
      }),
    );
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

// Una sola tarea de OCR a la vez: el worker es compartido
let queue: Promise<unknown> = Promise.resolve();

export interface OcrResult {
  lines: LayoutLine[];
  confidence: number;
  text: string;
}

interface TWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
interface TLine {
  words: TWord[];
}
interface TParagraph {
  lines: TLine[];
}

/**
 * Lee el texto de una imagen o canvas. `scale` convierte los píxeles de la imagen
 * a las unidades de la página (por ejemplo 0.5 si el canvas se dibujó al doble).
 */
export function ocrImage(
  image: HTMLCanvasElement | Blob | string,
  page: number,
  scale = 1,
  onProgress?: (p: number) => void,
): Promise<OcrResult> {
  const run = async (): Promise<OcrResult> => {
    let worker: TesseractWorker;
    try {
      worker = await getWorker();
    } catch {
      throw new Error(t('Text recognition could not start. Check your internet connection and try again.'));
    }
    progressHandler = onProgress ?? null;
    try {
      const { data } = await worker.recognize(image);
      const paragraphs = ((data as unknown as { paragraphs?: TParagraph[] }).paragraphs ?? []) as TParagraph[];
      const lines: LayoutLine[] = [];
      for (const para of paragraphs) {
        para.lines.forEach((line, li) => {
          const items: LayoutLine['items'] = [];
          line.words.forEach((w, wi) => {
            if (wi > 0) items.push({ str: ' ' });
            items.push({
              str: w.text,
              box: {
                x: w.bbox.x0 * scale,
                y: w.bbox.y0 * scale,
                w: (w.bbox.x1 - w.bbox.x0) * scale,
                h: (w.bbox.y1 - w.bbox.y0) * scale,
              },
            });
          });
          lines.push({ page, paraStart: li === 0, items });
        });
      }
      // Si la versión de tesseract no trae posiciones, se usa el texto plano (sin resaltado sobre la imagen)
      if (!lines.length && data.text?.trim()) {
        let paraStart = true;
        for (const l of data.text.split('\n')) {
          if (!l.trim()) {
            paraStart = true;
            continue;
          }
          lines.push({ page, paraStart, items: [{ str: l }] });
          paraStart = false;
        }
      }
      return { lines, confidence: data.confidence ?? 0, text: data.text ?? '' };
    } finally {
      progressHandler = null;
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}
