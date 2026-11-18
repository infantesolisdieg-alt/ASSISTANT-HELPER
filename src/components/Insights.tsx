// "Highlights": hallazgos automáticos de la sesión, con un botón para ir directo al detalle.

import type { ReactNode } from 'react';
import { HIGH_MATCH_PERCENT } from '../analysis/similarity';
import { nextPending, useStore } from '../state/store';
import { Icon, type IconName } from './icons';

interface Insight {
  key: string;
  icon: IconName;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
  text: ReactNode;
  action?: { label: string; onClick: () => void };
}

export function Insights() {
  const { state, submissions, analysis, docById, go } = useStore();
  const threshold = state.settings.similarityThreshold;
  const items: Insight[] = [];

  // 1. Par de documentos más parecido
  const top = analysis.pairs.find((p) => p.max >= threshold);
  if (top) {
    const a = docById(top.a);
    const b = docById(top.b);
    const bName = b?.isReference ? `the reference “${b.assignmentTitle}”` : b?.studentName;
    items.push({
      key: 'pair',
      icon: 'plagiarism',
      tone: top.max >= HIGH_MATCH_PERCENT ? 'bad' : 'warn',
      text: (
        <>
          <strong>{a?.studentName}</strong> and <strong>{bName}</strong> share up to <strong>{Math.round(top.max)}%</strong>{' '}
          of their text.
        </>
      ),
      action: { label: 'Compare', onClick: () => go('review', top.a) },
    });
  } else if (submissions.length > 1) {
    items.push({
      key: 'pair',
      icon: 'plagiarism',
      tone: 'ok',
      text: <>No pair of documents reaches the {threshold}% similarity threshold.</>,
    });
  }

  // 2. Indicadores de IA elevados
  const elevated = submissions.filter((d) => analysis.byId.get(d.id)?.ai?.level === 'Elevated');
  if (state.settings.checks.aiIndicators) {
    items.push(
      elevated.length
        ? {
            key: 'ai',
            icon: 'ai',
            tone: 'warn',
            text: (
              <>
                <strong>{elevated.length}</strong> submission{elevated.length === 1 ? ' shows' : 's show'} elevated AI indicators
                {elevated.length === 1 && (
                  <>
                    {' '}
                    (<strong>{elevated[0].studentName}</strong>)
                  </>
                )}
                . Treat this as advisory.
              </>
            ),
            action: { label: 'View', onClick: () => go('ai') },
          }
        : { key: 'ai', icon: 'ai', tone: 'ok', text: <>No submission shows elevated AI indicators.</> },
    );
  }

  // 3. Problema de formato o redacción más frecuente
  const counts = new Map<string, { name: string; n: number }>();
  for (const d of submissions) {
    for (const c of analysis.byId.get(d.id)?.checks ?? []) {
      if (c.outcome !== 'failed' && c.outcome !== 'review') continue;
      const cur = counts.get(c.id) ?? { name: c.name, n: 0 };
      cur.n += 1;
      counts.set(c.id, cur);
    }
  }
  const common = [...counts.values()].sort((x, y) => y.n - x.n)[0];
  if (common) {
    items.push({
      key: 'format',
      icon: 'review',
      tone: 'neutral',
      text: (
        <>
          Most common issue: <strong>{common.name}</strong> in {common.n} of {submissions.length} submissions.
        </>
      ),
    });
  }

  // 4. Pendientes
  const pending = submissions.filter((d) => d.reviewStatus === 'pending').length;
  const next = nextPending(submissions);
  if (pending && next) {
    items.push({
      key: 'pending',
      icon: 'clock',
      tone: 'neutral',
      text: (
        <>
          <strong>{pending}</strong> submission{pending === 1 ? ' is' : 's are'} waiting for your review. Next:{' '}
          <strong>{next.studentName}</strong>.
        </>
      ),
      action: { label: 'Start', onClick: () => go('review', next.id) },
    });
  }

  if (!items.length) return null;

  return (
    <section className="card insights" aria-labelledby="insights-title">
      <h2 id="insights-title">Highlights</h2>
      <ul>
        {items.map((it, i) => (
          <li key={it.key} className={`insight insight-${it.tone}`} style={{ animationDelay: `${i * 60}ms` }}>
            <span className="insight-icon">
              <Icon name={it.icon} size={18} />
            </span>
            <span className="insight-text">{it.text}</span>
            {it.action && (
              <button type="button" className="button button-ghost" onClick={it.action.onClick}>
                {it.action.label} <Icon name="arrow" size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
