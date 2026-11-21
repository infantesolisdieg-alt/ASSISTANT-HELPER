import { HIGH_MATCH_PERCENT } from '../analysis/similarity';
import { t } from '../i18n';
import { docLabel, useStore } from '../state/store';
import { MiniBar } from './charts';
import { EmptyState, SimilarityBadge, percentText } from './common';
import { STATUS_TONE } from './tones';

export function Plagiarism() {
  const { state, submissions, analysis, docById, go } = useStore();
  const threshold = state.settings.similarityThreshold;

  if (submissions.length === 0) {
    return (
      <div className="page">
        <EmptyState
          icon="plagiarism"
          title={t('No submissions to compare')}
          actions={
            <button type="button" className="button button-primary" onClick={() => go('upload')}>
              {t('Upload files')}
            </button>
          }
        >
          <p>{t('Each submission is compared with the other submissions and reference files of this session.')}</p>
        </EmptyState>
      </div>
    );
  }

  const rows = submissions
    .map((d) => ({ d, a: analysis.byId.get(d.id)! }))
    .filter((r) => r.a)
    .sort((x, y) => y.a.similarity.percent - x.a.similarity.percent);
  const pairs = analysis.pairs.slice(0, 10);

  return (
    <div className="page">
      <section className="card">
        <div className="card-header">
          <div>
            <h2>{t('All submissions')}</h2>
            <p className="muted-text small">
              {threshold < HIGH_MATCH_PERCENT
                ? t('Threshold {threshold}% · Clear below {threshold}% · Review {threshold}–{upper}% · High match {high}% or more.', {
                    threshold,
                    upper: HIGH_MATCH_PERCENT - 1,
                    high: HIGH_MATCH_PERCENT,
                  })
                : t('Threshold {threshold}% · Clear below {threshold}% · High match {high}% or more.', { threshold, high: HIGH_MATCH_PERCENT })}{' '}
              {t('Method: 5-word sequences compared only within this session.')}
            </p>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t('Student')}</th>
              <th scope="col">{t('Group')}</th>
              <th scope="col">{t('Assignment')}</th>
              <th scope="col">{t('Similarity')}</th>
              <th scope="col">{t('Status')}</th>
              <th scope="col">{t('Top match')}</th>
              <th scope="col">
                <span className="sr-only">{t('Actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, a }) => {
              const top = a.similarity.matches[0];
              return (
                <tr key={d.id}>
                  <td className="strong">{d.studentName}</td>
                  <td>{d.group ? <span className="group-chip">{d.group}</span> : <span className="muted-text">—</span>}</td>
                  <td>{d.assignmentTitle}</td>
                  <td>
                    <span className="cell-flex">
                      <MiniBar value={a.similarity.percent} tone={STATUS_TONE[a.status]} />
                      <span className="num">{percentText(a.similarity.percent)}</span>
                    </span>
                  </td>
                  <td>
                    <SimilarityBadge status={a.status} />
                  </td>
                  <td>{top ? `${docLabel(docById(top.docId))} (${percentText(top.percent)})` : <span className="muted-text">{t('None')}</span>}</td>
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

      <section className="card">
        <h2>{t('Most similar pairs')}</h2>
        <p className="muted-text small">{t('Percentages are directional: “A → B” is the share of A’s words that also appear in B.')}</p>
        {pairs.length === 0 ? (
          <p className="empty-inline">{t('No shared passages were found between the files of this session.')}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('Document A')}</th>
                <th scope="col">{t('Document B')}</th>
                <th scope="col">A → B</th>
                <th scope="col">B → A</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={`${p.a}-${p.b}`}>
                  <td>{docLabel(docById(p.a))}</td>
                  <td>{docLabel(docById(p.b))}</td>
                  <td className="num strong">{percentText(p.aToB)}</td>
                  <td className="num">{p.bToA === null ? <span className="muted-text">{t('Reference')}</span> : percentText(p.bToA)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
