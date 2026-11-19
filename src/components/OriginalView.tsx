// Vista "Original": muestra el documento como es (páginas del PDF, la imagen, el Word con
// tablas, imágenes y gráficas) con los resaltados de similitud e IA dibujados encima.

import { useEffect, useMemo, useRef, useState } from 'react';
import { rectsForRange, type Rect } from '../extract/layout';
import type { ChartData, DocBlock, FigureInfo, PageLayout } from '../extract/types';
import type { DocItem } from '../types';
import { buildSegments, type Highlight } from './highlights';

interface LayerProps {
  plag: Highlight[];
  ai: Highlight[];
  emphasize?: string | null;
}

/* ---------------- Capa de resaltados sobre una página ---------------- */

function Overlay({ layout, plag, ai, emphasize }: LayerProps & { layout: PageLayout }) {
  const rects = useMemo(() => {
    const out: { r: Rect; cls: string; title: string; key: string }[] = [];
    plag.forEach((h, i) => {
      const focus = !!(emphasize && h.sources?.includes(emphasize));
      rectsForRange(layout.boxes, h.start, h.end).forEach((r, k) =>
        out.push({ r, cls: `ov ov-plag${focus ? ' ov-focus' : ''}`, title: h.title, key: `p${i}-${k}` }),
      );
    });
    ai.forEach((h, i) =>
      rectsForRange(layout.boxes, h.start, h.end).forEach((r, k) =>
        out.push({ r, cls: 'ov ov-ai', title: h.title, key: `a${i}-${k}` }),
      ),
    );
    return out;
  }, [layout, plag, ai, emphasize]);

  const pad = 1.5; // pequeño margen alrededor de cada palabra
  return (
    <div className={`overlay${emphasize ? ' has-focus' : ''}`} aria-hidden="true">
      {rects.map(({ r, cls, title, key }) => (
        <span
          key={key}
          className={cls}
          title={title}
          style={{
            left: `${((r.x - pad) / layout.width) * 100}%`,
            top: `${((r.y - pad) / layout.height) * 100}%`,
            width: `${((r.w + pad * 2) / layout.width) * 100}%`,
            height: `${((r.h + pad * 2) / layout.height) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- Página de PDF (se dibuja al acercarse a la vista) ---------------- */

function PdfPage({ url, num, layout, ...layers }: LayerProps & { url: string; num: number; layout: PageLayout }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle');

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), {
      rootMargin: '600px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    (async () => {
      try {
        const { loadPdf } = await import('../extract/pdf');
        const pdf = await loadPdf(url);
        const page = await pdf.getPage(num);
        if (cancelled || !canvasRef.current || !hostRef.current) return;
        const cssWidth = hostRef.current.clientWidth || 700;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (cssWidth / layout.width) * dpr });
        const canvas = canvasRef.current;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        task = page.render({ canvasContext: ctx, viewport });
        await task.promise;
        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (!cancelled && (e as { name?: string })?.name !== 'RenderingCancelledException') setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, url, num, layout.width]);

  return (
    <div className="page-frame">
      <div
        ref={hostRef}
        className={`page-sheet${status === 'ready' ? ' is-ready' : ''}`}
        style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
      >
        <canvas ref={canvasRef} />
        {status !== 'ready' && (
          <div className="page-placeholder">{status === 'error' ? 'This page could not be displayed.' : <span className="spinner" />}</div>
        )}
        <Overlay layout={layout} {...layers} />
      </div>
      <div className="page-number">
        Page {num}
        {layout.ocr && <span className="page-ocr">Text recognized (OCR)</span>}
      </div>
    </div>
  );
}

/* ---------------- Imagen ---------------- */

function ImagePage({ url, layout, ...layers }: LayerProps & { url: string; layout: PageLayout }) {
  return (
    <div className="page-frame">
      <div className="page-sheet is-ready" style={{ aspectRatio: `${layout.width} / ${layout.height}` }}>
        <img src={url} alt="Uploaded image" />
        <Overlay layout={layout} {...layers} />
      </div>
    </div>
  );
}

/* ---------------- Word ---------------- */

function HighlightedText({ text, offset, plag, ai, emphasize }: LayerProps & { text: string; offset: number }) {
  const end = offset + text.length;
  const shift = (hs: Highlight[]) =>
    hs.filter((h) => h.end > offset && h.start < end).map((h) => ({ ...h, start: h.start - offset, end: h.end - offset }));
  const segments = buildSegments(text, shift(plag), shift(ai));
  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.plag && !seg.ai) return <span key={i}>{seg.text}</span>;
        const focused = !!(emphasize && seg.plag?.sources?.includes(emphasize));
        const cls = [seg.plag ? 'hl-plag' : '', seg.ai ? 'hl-ai' : '', focused ? 'hl-focus' : ''].join(' ').trim();
        return (
          <mark key={i} className={cls} title={[seg.plag?.title, seg.ai].filter(Boolean).join(' · ')}>
            {seg.text}
          </mark>
        );
      })}
    </>
  );
}

export function ChartPreview({ chart }: { chart: ChartData }) {
  const all = chart.series.flatMap((s) => s.values.filter((v) => Number.isFinite(v)));
  const max = Math.max(...all, 0) || 1;
  const cats = chart.categories.length ? chart.categories : chart.series[0]?.values.map((_, i) => `${i + 1}`) ?? [];
  return (
    <div className="chart-preview">
      <div className="chart-preview-head">
        <strong>{chart.title ?? 'Untitled chart'}</strong>
        <span className="file-chip">{chart.type}</span>
      </div>
      <div className="chart-table-wrap">
        <table className="chart-table">
          <thead>
            <tr>
              <th scope="col">{chart.axisTitles[0] ?? 'Category'}</th>
              {chart.series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map((c, i) => (
              <tr key={`${c}-${i}`}>
                <th scope="row">{c}</th>
                {chart.series.map((s) => {
                  const v = s.values[i];
                  return (
                    <td key={s.name}>
                      <span className="chart-cell">
                        <span className="chart-cell-bar" style={{ width: `${Number.isFinite(v) ? Math.max(0, (v / max) * 100) : 0}%` }} />
                        <span className="num">{Number.isFinite(v) ? v.toLocaleString('en-US') : '–'}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chart.axisTitles.length > 0 && <p className="small muted-text">Axis titles: {chart.axisTitles.join(' · ')}</p>}
    </div>
  );
}

function FigureBlock({ fig, index }: { fig: FigureInfo; index: number }) {
  return (
    <figure className="doc-figure">
      {fig.kind === 'chart' && fig.chart ? (
        <ChartPreview chart={fig.chart} />
      ) : fig.src ? (
        <img src={fig.src} alt={fig.caption ?? `Figure ${index + 1}`} loading="lazy" />
      ) : (
        <div className="doc-figure-missing">Image (this format cannot be previewed in the browser)</div>
      )}
    </figure>
  );
}

function DocxView({ doc, ...layers }: LayerProps & { doc: DocItem }) {
  const ranges = doc.paraRanges ?? [];
  const para = (i: number) => {
    const [s, e] = ranges[i] ?? [0, 0];
    return <HighlightedText text={doc.text.slice(s, e)} offset={s} {...layers} />;
  };
  const render = (b: DocBlock, k: number) => {
    if (b.type === 'p') {
      const Tag = b.style === 'title' ? 'h1' : b.style === 'heading' ? 'h2' : 'p';
      return (
        <Tag key={k} className={`doc-p doc-${b.style}`} style={{ textAlign: b.align }}>
          {para(b.para)}
        </Tag>
      );
    }
    if (b.type === 'table') {
      return (
        <div key={k} className="doc-table-wrap">
          <table className="doc-table">
            <tbody>
              {b.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => {
                    const Cell = r === 0 ? 'th' : 'td';
                    return (
                      <Cell key={c}>
                        {cell.map((pi, j) => (
                          <div key={j}>{para(pi)}</div>
                        ))}
                      </Cell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    const fig = doc.figures?.[b.figure];
    return fig ? <FigureBlock key={k} fig={fig} index={b.figure} /> : null;
  };
  return <article className="sheet docx-sheet">{doc.blocks?.map(render)}</article>;
}

/* ---------------- Selector ---------------- */

export function hasOriginalView(doc: DocItem): boolean {
  return !!((doc.kind === 'pdf' || doc.kind === 'image') && doc.sourceUrl && doc.pages?.length) || !!(doc.kind === 'docx' && doc.blocks?.length);
}

export function OriginalView({ doc, ...layers }: LayerProps & { doc: DocItem }) {
  if (doc.kind === 'docx') return <DocxView doc={doc} {...layers} />;
  if (doc.kind === 'image' && doc.sourceUrl && doc.pages?.[0]) {
    return (
      <div className="pages">
        <ImagePage url={doc.sourceUrl} layout={doc.pages[0]} {...layers} />
      </div>
    );
  }
  if (doc.kind === 'pdf' && doc.sourceUrl && doc.pages) {
    return (
      <div className="pages">
        {doc.pages.map((p, i) => (
          <PdfPage key={i} url={doc.sourceUrl!} num={i + 1} layout={p} {...layers} />
        ))}
      </div>
    );
  }
  return null;
}
