// Convierte líneas con posición (de un PDF o del OCR) en texto plano y recuerda
// en qué parte de la página está cada fragmento, para poder resaltar sobre el original.

import type { TextBox } from './types';

export interface LayoutItem {
  str: string;
  box?: { x: number; y: number; w: number; h: number };
}

export interface LayoutLine {
  page: number;
  /** true si la línea empieza un párrafo nuevo. */
  paraStart: boolean;
  items: LayoutItem[];
}

/** Una línea larga sin puntuación final se considera cortada por el ancho y se une con espacio. */
export const WRAPPED_LINE = 55;

export function assembleLines(lines: LayoutLine[]): {
  text: string;
  paragraphs: string[];
  boxesByPage: Map<number, TextBox[]>;
} {
  let text = '';
  const paragraphs: string[] = [];
  let cur = '';
  let prevLine = '';
  let forceBreak = false;
  const boxesByPage = new Map<number, TextBox[]>();

  for (const line of lines) {
    const raw = line.items.map((i) => i.str).join('');
    const t = raw.trim();
    if (!t) {
      // Una línea vacía separa párrafos
      forceBreak = true;
      continue;
    }
    const lead = raw.length - raw.trimStart().length;

    if (cur && (line.paraStart || forceBreak)) {
      paragraphs.push(cur);
      cur = '';
      text += '\n\n';
    } else if (cur) {
      const sep = prevLine.length >= WRAPPED_LINE && !/[.:!?]$/.test(prevLine) ? ' ' : '\n';
      text += sep;
      cur += sep;
    }
    forceBreak = false;

    const lineStart = text.length;
    const lineEnd = lineStart + t.length;
    let p = -lead;
    const boxes = boxesByPage.get(line.page) ?? [];
    for (const item of line.items) {
      const s = lineStart + p;
      const e = s + item.str.length;
      p += item.str.length;
      if (!item.box || !item.str.trim()) continue;
      const cs = Math.max(s, lineStart);
      const ce = Math.min(e, lineEnd);
      if (ce <= cs) continue;
      // Si el fragmento se recortó por espacios, se ajusta la caja en proporción
      const len = item.str.length || 1;
      const x0 = item.box.x + (item.box.w * (cs - s)) / len;
      const w = (item.box.w * (ce - cs)) / len;
      boxes.push({ start: cs, end: ce, x: x0, y: item.box.y, w, h: item.box.h });
    }
    boxesByPage.set(line.page, boxes);

    text += t;
    cur += t;
    prevLine = t;
  }
  if (cur) paragraphs.push(cur);
  return { text, paragraphs, boxesByPage };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Rectángulos de las partes de las cajas que caen dentro de [start, end).
 * Se usa para dibujar resaltados encima de la página original.
 */
export function rectsForRange(boxes: TextBox[], start: number, end: number): Rect[] {
  const out: Rect[] = [];
  for (const b of boxes) {
    if (b.end <= start || b.start >= end) continue;
    const s = Math.max(b.start, start);
    const e = Math.min(b.end, end);
    const len = b.end - b.start || 1;
    out.push({ x: b.x + (b.w * (s - b.start)) / len, y: b.y, w: (b.w * (e - s)) / len, h: b.h });
  }
  return mergeRects(out);
}

/** Une rectángulos contiguos de la misma línea para que el resaltado se vea continuo. */
function mergeRects(rects: Rect[]): Rect[] {
  const out: Rect[] = [];
  for (const r of rects) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.y - r.y) < r.h * 0.5 && r.x - (last.x + last.w) < r.h * 0.8 && r.x >= last.x) {
      const right = Math.max(last.x + last.w, r.x + r.w);
      const top = Math.min(last.y, r.y);
      const bottom = Math.max(last.y + last.h, r.y + r.h);
      last.x = Math.min(last.x, r.x);
      last.w = right - last.x;
      last.y = top;
      last.h = bottom - top;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}
