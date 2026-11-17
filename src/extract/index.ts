import { readDocx } from './docx';
import { paragraphsFromPlainText } from './lines';
import type { ExtractedFile, FileKind } from './types';

export const ACCEPTED_EXTENSIONS = ['.docx', '.pdf', '.txt'];

export function fileKind(name: string): FileKind | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext === 'docx' || ext === 'pdf' || ext === 'txt' ? ext : null;
}

export async function extractFile(file: File): Promise<ExtractedFile> {
  const kind = fileKind(file.name);
  if (!kind) throw new Error('Unsupported file type.');

  if (kind === 'docx') {
    const { paragraphs, format } = await readDocx(await file.arrayBuffer());
    return { kind, paragraphs, docxFormat: format };
  }
  if (kind === 'pdf') {
    const { readPdf } = await import('./pdf');
    return { kind, paragraphs: await readPdf(await file.arrayBuffer()) };
  }
  return { kind, paragraphs: paragraphsFromPlainText(await file.text()) };
}
