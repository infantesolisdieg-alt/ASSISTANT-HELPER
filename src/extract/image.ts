// Imágenes (.png, .jpg, .webp): se lee el texto con OCR y se conserva la posición de cada palabra.

import { t } from '../i18n';
import { assembleLines } from './layout';
import { ocrImage } from './ocr';
import type { ExtractedFile, ProgressFn } from './types';

export async function readImage(file: File, onProgress?: ProgressFn): Promise<ExtractedFile> {
  let width = 0;
  let height = 0;
  try {
    const bmp = await createImageBitmap(file);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {
    throw new Error(t('This image could not be opened. Try saving it again as .png or .jpg.'));
  }
  onProgress?.(t('Recognizing text…'), 0.05);
  const res = await ocrImage(file, 1, 1, (p) => onProgress?.(t('Recognizing text ({p}%)…', { p: Math.round(p * 100) }), 0.05 + p * 0.9));
  const { paragraphs, boxesByPage } = assembleLines(res.lines);
  return {
    kind: 'image',
    paragraphs,
    pages: [{ width, height, boxes: boxesByPage.get(1) ?? [], ocr: true }],
    ocrConfidence: res.confidence,
  };
}
