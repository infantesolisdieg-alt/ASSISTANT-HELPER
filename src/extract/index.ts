import { t, tk } from '../i18n';
import { readDocx } from './docx';
import { paragraphsFromPlainText } from './lines';
import type { ExtractedFile, FileKind, ProgressFn } from './types';

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
export const ACCEPTED_EXTENSIONS = ['.docx', '.pdf', '.txt', ...IMAGE_EXTENSIONS];
export const ACCEPTED_LABEL = tk('.docx, .pdf, .txt and images (.png, .jpg, .webp)');
export const MAX_FILE_MB = 30;

export function fileKind(name: string): FileKind | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === 'docx' || ext === 'pdf' || ext === 'txt') return ext;
  if (ext && IMAGE_EXTENSIONS.includes(`.${ext}`)) return 'image';
  return null;
}

/** Los PDF y las imágenes se muestran tal cual en el visor, a partir de esta URL temporal. */
export function needsSourceUrl(kind: FileKind): boolean {
  return kind === 'pdf' || kind === 'image';
}

export async function extractFile(file: File, sourceUrl: string | undefined, onProgress?: ProgressFn): Promise<ExtractedFile> {
  const kind = fileKind(file.name);
  if (!kind) throw new Error(t('Unsupported file type.'));
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(t('This file is larger than {mb} MB.', { mb: MAX_FILE_MB }));

  if (kind === 'docx') {
    onProgress?.(t('Reading document…'), 0.3);
    return readDocx(await file.arrayBuffer());
  }
  if (kind === 'pdf') {
    const { readPdf } = await import('./pdf');
    return readPdf(sourceUrl!, onProgress);
  }
  if (kind === 'image') {
    const { readImage } = await import('./image');
    return readImage(file, onProgress);
  }
  return { kind, paragraphs: paragraphsFromPlainText(await file.text()) };
}
