// Panel de tablas, figuras y gráficas de una entrega. Las imágenes pueden leerse con OCR
// a petición, para revisar el texto que contienen (títulos, ejes, datos de una gráfica escaneada).

import { useState } from 'react';
import { useStore } from '../state/store';
import type { DocItem } from '../types';
import { Icon } from './icons';
import { ChartPreview } from './OriginalView';

export function FiguresPanel({ doc }: { doc: DocItem }) {
  const { dispatch, hasDoc } = useStore();
  const [reading, setReading] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tables = doc.tables ?? [];
  const figures = doc.figures ?? [];
  if (!tables.length && !figures.length) return null;

  const readFigure = async (i: number) => {
    const fig = figures[i];
    if (!fig?.src) return;
    setReading(i);
    setProgress(0);
    setError(null);
    try {
      const { ocrImage } = await import('../extract/ocr');
      const res = await ocrImage(fig.src, 1, 1, setProgress);
      if (!hasDoc(doc.id)) return;
      const text = res.text.trim() || 'No text was found in this image.';
      dispatch({
        type: 'updateDoc',
        id: doc.id,
        patch: { figures: figures.map((f, k) => (k === i ? { ...f, ocrText: text } : f)) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The text in this image could not be read.');
    } finally {
      setReading(null);
    }
  };

  return (
    <section className="card result-section" aria-labelledby="fig-title">
      <h3 id="fig-title">Tables, figures &amp; charts</h3>
      <p className="small muted-text">
        {tables.length} table{tables.length === 1 ? '' : 's'} · {figures.filter((f) => f.kind === 'image').length} image
        {figures.filter((f) => f.kind === 'image').length === 1 ? '' : 's'} · {figures.filter((f) => f.kind === 'chart').length} chart
        {figures.filter((f) => f.kind === 'chart').length === 1 ? '' : 's'}
      </p>

      {tables.length > 0 && (
        <div className="fig-group">
          <h4>Tables</h4>
          <ul className="fig-list">
            {tables.map((t, i) => (
              <li key={i} className="fig-item">
                <div className="fig-head">
                  <span className="fig-icon" aria-hidden="true">
                    <Icon name="dashboard" size={16} />
                  </span>
                  <span className="fig-caption">{t.caption ?? <em>Untitled table {i + 1}</em>}</span>
                  {t.page && <span className="file-chip">p. {t.page}</span>}
                </div>
                {t.rows.length > 0 ? (
                  <div className="mini-table-wrap">
                    <table className="mini-table">
                      <tbody>
                        {t.rows.slice(0, 4).map((r, ri) => (
                          <tr key={ri}>
                            {r.slice(0, 5).map((c, ci) => {
                              const Cell = ri === 0 ? 'th' : 'td';
                              return <Cell key={ci}>{c || '—'}</Cell>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="small muted-text">
                      {t.rows.length} row{t.rows.length === 1 ? '' : 's'} × {Math.max(...t.rows.map((r) => r.length))} column
                      {Math.max(...t.rows.map((r) => r.length)) === 1 ? '' : 's'}
                      {t.rows.length > 4 ? ' · showing the first 4 rows' : ''}
                    </p>
                  </div>
                ) : (
                  <p className="small muted-text">Found by its title. Open the Original view to see it on the page.</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {figures.length > 0 && (
        <div className="fig-group">
          <h4>Figures &amp; charts</h4>
          <ul className="fig-list">
            {figures.map((f, i) => (
              <li key={i} className="fig-item">
                <div className="fig-head">
                  <span className="fig-icon" aria-hidden="true">
                    <Icon name={f.kind === 'chart' ? 'ai' : 'review'} size={16} />
                  </span>
                  <span className="fig-caption">{f.caption ?? <em>Untitled {f.kind === 'chart' ? 'chart' : 'figure'} {i + 1}</em>}</span>
                  {f.page && <span className="file-chip">p. {f.page}</span>}
                </div>
                {f.kind === 'chart' && f.chart && <ChartPreview chart={f.chart} />}
                {f.kind === 'image' && f.src && (
                  <div className="fig-image">
                    <img src={f.src} alt={f.caption ?? `Figure ${i + 1}`} loading="lazy" />
                    <div className="fig-actions">
                      {f.ocrText ? (
                        <details className="check-instances" open>
                          <summary>Text found in the image</summary>
                          <p className="ocr-text">{f.ocrText}</p>
                        </details>
                      ) : (
                        <button
                          type="button"
                          className="button button-ghost"
                          disabled={reading !== null}
                          onClick={() => readFigure(i)}
                        >
                          {reading === i ? (
                            <>
                              <span className="spinner" aria-hidden="true" /> Reading… {Math.round(progress * 100)}%
                            </>
                          ) : (
                            <>
                              <Icon name="pen" size={14} /> Read text in image
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {f.kind === 'image' && !f.src && (
                  <p className="small muted-text">
                    {doc.kind === 'pdf' ? 'Image found on this page. Open the Original view to see it.' : 'This image format cannot be previewed.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {error && (
            <p className="small text-bad" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
