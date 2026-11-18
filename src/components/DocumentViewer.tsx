// Visor tipo hoja con resaltados de similitud (plagio) y de indicadores de IA.

import { useEffect, useMemo, useRef, useState } from 'react';

export interface Highlight {
  start: number;
  end: number;
  title: string;
  /** Documentos de origen (solo para similitud): permite enfatizar los pasajes de uno. */
  sources?: string[];
}

interface Segment {
  text: string;
  plag: Highlight | null;
  ai: string | null;
}

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

export function DocumentViewer({
  text,
  title,
  plag,
  ai,
  aiEnabled,
  emphasize,
  jumpToken,
}: {
  text: string;
  title: string;
  plag: Highlight[];
  ai: Highlight[];
  aiEnabled: boolean;
  /** Id del documento cuyos pasajes coincidentes se enfatizan. */
  emphasize?: string | null;
  /** Cambia cada vez que se pide saltar al primer pasaje enfatizado. */
  jumpToken?: number;
}) {
  const [showPlag, setShowPlag] = useState(true);
  const [showAi, setShowAi] = useState(true);
  const sheetRef = useRef<HTMLElement>(null);
  const segments = useMemo(
    () => buildSegments(text, showPlag ? plag : [], showAi && aiEnabled ? ai : []),
    [text, plag, ai, showPlag, showAi, aiEnabled],
  );

  useEffect(() => {
    if (!jumpToken) return;
    setShowPlag(true);
    const t = window.setTimeout(() => {
      sheetRef.current?.querySelector('.hl-focus')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
    return () => window.clearTimeout(t);
  }, [jumpToken]);

  return (
    <section className="viewer card" aria-label="Document viewer">
      <div className="viewer-toolbar">
        <div className="legend" aria-label="Highlight legend">
          <label className="checkbox">
            <input type="checkbox" checked={showPlag} onChange={(e) => setShowPlag(e.target.checked)} />
            <span className="swatch swatch-plag" aria-hidden="true" />
            Similarity matches ({plag.length})
          </label>
          {aiEnabled && (
            <label className="checkbox">
              <input type="checkbox" checked={showAi} onChange={(e) => setShowAi(e.target.checked)} />
              <span className="swatch swatch-ai" aria-hidden="true" />
              AI indicator sentences ({ai.length})
            </label>
          )}
        </div>
      </div>
      <div className="sheet-scroll">
        <article className={`sheet${emphasize ? ' has-focus' : ''}`} aria-label={title} ref={sheetRef}>
          {segments.map((seg, i) => {
            if (!seg.plag && !seg.ai) return <span key={i}>{seg.text}</span>;
            const focused = !!(emphasize && seg.plag?.sources?.includes(emphasize));
            const cls = [seg.plag ? 'hl-plag' : '', seg.ai ? 'hl-ai' : '', focused ? 'hl-focus' : ''].join(' ').trim();
            const label = [seg.plag?.title, seg.ai].filter(Boolean).join(' · ');
            return (
              <mark key={i} className={cls} title={label}>
                {seg.text}
              </mark>
            );
          })}
        </article>
      </div>
    </section>
  );
}
