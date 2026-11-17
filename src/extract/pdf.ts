// Lectura de .pdf con pdfjs-dist (se carga solo cuando se necesita, para no hacer pesada la app).

import { joinLines } from './lines';

interface Line {
  text: string;
  y: number;
  page: number;
}

export async function readPdf(buffer: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch {
    throw new Error('This PDF could not be opened. It may be damaged or password-protected.');
  }

  const lines: Line[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    let cur = '';
    let y = 0;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      if (cur === '' && item.str.trim()) y = item.transform[5];
      cur += item.str;
      if (item.hasEOL) {
        lines.push({ text: cur, y, page: n });
        cur = '';
      }
    }
    if (cur) lines.push({ text: cur, y, page: n });
  }

  // Distancia típica entre líneas para detectar separación de párrafos
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1];
    const b = lines[i];
    if (a.page === b.page && a.text.trim() && b.text.trim() && a.y - b.y > 0) gaps.push(a.y - b.y);
  }
  gaps.sort((a, b) => a - b);
  const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

  const paragraphs: string[] = [];
  let block: string[] = [];
  const flush = () => {
    const p = joinLines(block);
    if (p) paragraphs.push(p);
    block = [];
  };
  let prev: Line | null = null;
  for (const line of lines) {
    if (!line.text.trim()) {
      flush();
      prev = null;
      continue;
    }
    if (prev && prev.page === line.page && typical > 0 && prev.y - line.y > typical * 1.5) flush();
    block.push(line.text);
    prev = line;
  }
  flush();
  return paragraphs;
}
