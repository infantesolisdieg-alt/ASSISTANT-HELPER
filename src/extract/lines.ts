// Reconstruye párrafos a partir de líneas (para .txt y .pdf).
// Las líneas largas se consideran texto "cortado" por ancho y se unen con espacio;
// las líneas cortas (direcciones, firmas, encabezados) conservan su salto de línea.

const WRAPPED_LINE = 55;

export function joinLines(lines: string[]): string {
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (!out) {
      out = line;
      continue;
    }
    const prev = lines[i - 1]?.trim() ?? '';
    out += prev.length >= WRAPPED_LINE && !/[.:!?]$/.test(prev) ? ' ' + line : '\n' + line;
  }
  return out;
}

export function paragraphsFromPlainText(raw: string): string[] {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  return text
    .split(/\n[ \t]*\n/)
    .map((block) => joinLines(block.split('\n')))
    .filter((p) => p.length > 0);
}
