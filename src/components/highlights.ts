// Utilidades de resaltado compartidas por la vista "Text" y la vista "Original".

export interface Highlight {
  start: number;
  end: number;
  title: string;
  /** Documentos de origen (solo para similitud): permite enfatizar los pasajes de uno. */
  sources?: string[];
}

export interface Segment {
  text: string;
  plag: Highlight | null;
  ai: string | null;
}

/** Corta el texto en tramos; cada tramo sabe si está dentro de un resaltado de similitud o de IA. */
export function buildSegments(text: string, plag: Highlight[], ai: Highlight[]): Segment[] {
  const bounds = new Set<number>([0, text.length]);
  for (const h of [...plag, ...ai]) {
    bounds.add(Math.max(0, Math.min(text.length, h.start)));
    bounds.add(Math.max(0, Math.min(text.length, h.end)));
  }
  const sorted = [...bounds].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i];
    const e = sorted[i + 1];
    if (e <= s) continue;
    const p = plag.find((h) => h.start <= s && h.end >= e);
    const a = ai.find((h) => h.start <= s && h.end >= e);
    out.push({ text: text.slice(s, e), plag: p ?? null, ai: a?.title ?? null });
  }
  return out;
}
