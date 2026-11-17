// Visor tipo hoja con resaltados de similitud (plagio) y de indicadores de IA.

import { useMemo, useState } from 'react';

export interface Highlight {
  start: number;
  end: number;
  title: string;
}

interface Segment {
  text: string;
  plag: string | null;
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
    out.push({ text: text.slice(s, e), plag: p?.title ?? null, ai: a?.title ?? null });
  }
  return out;
}

export function DocumentViewer({
  text,
  title,
  plag,
  ai,
  aiEnabled,
}: {
  text: string;
  title: string;
  plag: Highlight[];
  ai: Highlight[];
  aiEnabled: boolean;
}) {
  const [showPlag, setShowPlag] = useState(true);
  const [showAi, setShowAi] = useState(true);
  const segments = useMemo(
    () => buildSegments(text, showPlag ? plag : [], showAi && aiEnabled ? ai : []),
    [text, plag, ai, showPlag, showAi, aiEnabled],
  );

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
        <article className="sheet" aria-label={title}>
          {segments.map((seg, i) => {
            if (!seg.plag && !seg.ai) return <span key={i}>{seg.text}</span>;
            const cls = [seg.plag ? 'hl-plag' : '', seg.ai ? 'hl-ai' : ''].join(' ').trim();
            const label = [seg.plag, seg.ai].filter(Boolean).join(' · ');
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
