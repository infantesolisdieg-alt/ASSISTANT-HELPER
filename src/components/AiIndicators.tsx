import { AI_DISCLAIMER } from '../analysis/ai';
import { t } from '../i18n';
import { useStore } from '../state/store';
import { MiniBar } from './charts';
import { AiBadge, EmptyState } from './common';
import { AI_TONE } from './tones';

export function AiIndicators() {
  const { state, submissions, analysis, go } = useStore();

  if (!state.settings.checks.aiIndicators) {
    return (
      <div className="page">
        <p className="disclaimer">{t(AI_DISCLAIMER)}</p>
        <EmptyState
          title={t('AI indicators are turned off')}
          actions={
            <button type="button" className="button button-primary" onClick={() => go('settings')}>
              {t('Open Settings')}
            </button>
          }
        />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="page">
        <p className="disclaimer">{t(AI_DISCLAIMER)}</p>
        <EmptyState
          title={t('No submissions analyzed yet')}
          actions={
            <button type="button" className="button button-primary" onClick={() => go('upload')}>
              {t('Upload files')}
            </button>
          }
        />
      </div>
    );
  }

  const rows = submissions
    .map((d) => ({ d, ai: analysis.byId.get(d.id)?.ai }))
    .filter((r): r is { d: (typeof submissions)[number]; ai: NonNullable<typeof r.ai> } => !!r.ai)
    .sort((x, y) => y.ai.percent - x.ai.percent);

  return (
    <div className="page">
      <p className="disclaimer">{t(AI_DISCLAIMER)}</p>
      <section className="card">
        <h2>{t('Submissions by indicator level')}</h2>
        <p className="muted-text small">
          {t(
            'Heuristics calculated in your browser: typical phrases, sentence length variation, vocabulary diversity, repetitive openers and style shifts between paragraphs.',
          )}
        </p>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t('Student')}</th>
              <th scope="col">{t('Group')}</th>
              <th scope="col">{t('Assignment')}</th>
              <th scope="col">{t('Indicator')}</th>
              <th scope="col">{t('Level')}</th>
              <th scope="col">{t('Strongest signals')}</th>
              <th scope="col">
                <span className="sr-only">{t('Actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, ai }) => {
              const strongest = ai.signals
                .filter((s) => (s.score ?? 0) >= 0.25)
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .slice(0, 2)
                .map((s) => s.name);
              return (
                <tr key={d.id}>
                  <td className="strong">{d.studentName}</td>
                  <td>{d.group ? <span className="group-chip">{d.group}</span> : <span className="muted-text">—</span>}</td>
                  <td>{d.assignmentTitle}</td>
                  <td>
                    <span className="cell-flex">
                      <MiniBar value={ai.percent} tone={AI_TONE[ai.level]} />
                      <span className="num">{ai.percent}%</span>
                      {!ai.reliable && <span className="muted-text small">{t('(short text)')}</span>}
                    </span>
                  </td>
                  <td>
                    <AiBadge level={ai.level} />
                  </td>
                  <td>{strongest.length ? strongest.join(', ') : <span className="muted-text">{t('None notable')}</span>}</td>
                  <td className="right">
                    <button
                      type="button"
                      className="button button-link"
                      aria-label={t('Open review for {name}', { name: d.studentName })}
                      onClick={() => go('review', d.id)}
                    >
                      {t('Open')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
