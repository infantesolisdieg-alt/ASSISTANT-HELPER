import { HIGH_MATCH_PERCENT } from '../analysis/similarity';
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
          title="No submissions to compare"
          actions={
            <button type="button" className="button button-primary" onClick={() => go('upload')}>
              Upload files
            </button>
          }
        >
          <p>Each submission is compared with the other submissions and reference files of this session.</p>
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
            <h2>All submissions</h2>
            <p className="muted-text small">
              Threshold {threshold}% · Clear below {threshold}%
              {threshold < HIGH_MATCH_PERCENT && ` · Review ${threshold}–${HIGH_MATCH_PERCENT - 1}%`} · High match{' '}
              {HIGH_MATCH_PERCENT}% or more. Method: 5-word sequences compared only within this session.
            </p>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Assignment</th>
              <th scope="col">Similarity</th>
              <th scope="col">Status</th>
              <th scope="col">Top match</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ d, a }) => {
              const top = a.similarity.matches[0];
              return (
                <tr key={d.id}>
                  <td className="strong">{d.studentName}</td>
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
                  <td>{top ? `${docLabel(docById(top.docId))} (${percentText(top.percent)})` : <span className="muted-text">None</span>}</td>
                  <td className="right">
                    <button
                      type="button"
                      className="button button-link"
                      aria-label={`Open review for ${d.studentName}`}
                      onClick={() => go('review', d.id)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Most similar pairs</h2>
        <p className="muted-text small">
          Percentages are directional: “A → B” is the share of A’s words that also appear in B.
        </p>
        {pairs.length === 0 ? (
          <p className="empty-inline">No shared passages were found between the files of this session.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Document A</th>
                <th scope="col">Document B</th>
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
                  <td className="num">{p.bToA === null ? <span className="muted-text">Reference</span> : percentText(p.bToA)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
