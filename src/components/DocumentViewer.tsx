// Visor del documento: vista "Original" (como el archivo) o vista "Text" (texto extraído),
// con resaltados de similitud (plagio) y de indicadores de IA.

import { useEffect, useMemo, useRef, useState } from 'react';
import { t, tn } from '../i18n';
import type { DocItem } from '../types';
import { Icon } from './icons';
import { buildSegments, type Highlight } from './highlights';
import { OriginalView, hasOriginalView } from './OriginalView';

export type { Highlight };


export function DocumentViewer({
  doc,
  plag,
  ai,
  aiEnabled,
  emphasize,
  jumpToken,
}: {
  doc: DocItem;
  plag: Highlight[];
  ai: Highlight[];
  aiEnabled: boolean;
  /** Id del documento cuyos pasajes coincidentes se enfatizan. */
  emphasize?: string | null;
  /** Cambia cada vez que se pide saltar al primer pasaje enfatizado. */
  jumpToken?: number;
}) {
  const canOriginal = hasOriginalView(doc);
  const [mode, setMode] = useState<'original' | 'text'>(canOriginal ? 'original' : 'text');
  const [showPlag, setShowPlag] = useState(true);
  const [showAi, setShowAi] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const title = `${doc.studentName} — ${doc.assignmentTitle}`;
  const shownPlag = showPlag ? plag : [];
  const shownAi = showAi && aiEnabled ? ai : [];

  const segments = useMemo(
    () => (mode === 'text' ? buildSegments(doc.text, shownPlag, shownAi) : []),
    [mode, doc.text, shownPlag, shownAi],
  );

  useEffect(() => {
    if (!jumpToken) return;
    setShowPlag(true);
    const timer = window.setTimeout(() => {
      scrollRef.current?.querySelector('.hl-focus, .ov-focus')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [jumpToken]);

  const ocrPages = doc.pages?.filter((p) => p.ocr).length ?? 0;

  return (
    <section className="viewer card" aria-label={t('Document viewer')}>
      <div className="viewer-toolbar">
        {canOriginal && (
          <div className="segmented" role="group" aria-label={t('Viewer mode')}>
            <button type="button" aria-pressed={mode === 'original'} onClick={() => setMode('original')}>
              <Icon name="review" size={15} /> {t('Original')}
            </button>
            <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>
              <Icon name="pen" size={15} /> {t('Text')}
            </button>
          </div>
        )}
        <div className="legend" aria-label={t('Highlight legend')}>
          <label className="checkbox">
            <input type="checkbox" checked={showPlag} onChange={(e) => setShowPlag(e.target.checked)} />
            <span className="swatch swatch-plag" aria-hidden="true" />
            {t('Similarity ({n})', { n: plag.length })}
          </label>
          {aiEnabled && (
            <label className="checkbox">
              <input type="checkbox" checked={showAi} onChange={(e) => setShowAi(e.target.checked)} />
              <span className="swatch swatch-ai" aria-hidden="true" />
              {t('AI indicators ({n})', { n: ai.length })}
            </label>
          )}
        </div>
      </div>

      {(ocrPages > 0 || doc.skippedPages) && (
        <div className="viewer-note">
          <Icon name="alert" size={15} />
          <span>
            {ocrPages > 0 &&
              (doc.kind === 'image'
                ? t('Text on this image was recognized automatically (OCR{confidence}). Compare unusual words with the original.', {
                    confidence: doc.ocrConfidence ? t(', {p}% confidence', { p: Math.round(doc.ocrConfidence) }) : '',
                  })
                : tn(
                    ocrPages,
                    'Text on {n} page was recognized automatically (OCR{confidence}). Compare unusual words with the original.',
                    'Text on {n} pages was recognized automatically (OCR{confidence}). Compare unusual words with the original.',
                    { confidence: doc.ocrConfidence ? t(', {p}% confidence', { p: Math.round(doc.ocrConfidence) }) : '' },
                  )) + ' '}
            {doc.skippedPages
              ? tn(doc.skippedPages, '{n} scanned page was not read (limit reached).', '{n} scanned pages were not read (limit reached).')
              : ''}
          </span>
        </div>
      )}

      <div className="sheet-scroll" ref={scrollRef}>
        {mode === 'original' && canOriginal ? (
          <OriginalView doc={doc} plag={shownPlag} ai={shownAi} emphasize={emphasize} />
        ) : (
          <article className={`sheet${emphasize ? ' has-focus' : ''}`} aria-label={title}>
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
        )}
      </div>
    </section>
  );
}
