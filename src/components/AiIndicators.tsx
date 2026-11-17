import { AI_DISCLAIMER } from '../analysis/ai';
import { useStore } from '../state/store';
import { AiBadge, EmptyState } from './common';

export function AiIndicators() {
  const { state, submissions, analysis, go } = useStore();

  if (!state.settings.checks.aiIndicators) {
    return (
      <div className="page">
        <p className="disclaimer">{AI_DISCLAIMER}</p>
        <EmptyState
          title="AI indicators are turned off"
          actions={
            <button type="button" className="button button-primary" onClick={() => go('settings')}>
              Open Settings
            </button>
          }
        />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="page">
        <p className="disclaimer">{AI_DISCLAIMER}</p>
        <EmptyState
          title="No submissions analyzed yet"
          actions={
            <button type="button" className="button button-primary" onClick={() => go('upload')}>
              Upload files
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
      <p className="disclaimer">{AI_DISCLAIMER}</p>
      <section className="card">
        <h2>Submissions by indicator level</h2>
        <p className="muted-text small">
          Heuristics calculated in your browser: typical phrases, sentence length variation, vocabulary diversity, repetitive
          openers and style shifts between paragraphs.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Assignment</th>
              <th scope="col">Indicator</th>
              <th scope="col">Level</th>
              <th scope="col">Strongest signals</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
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
                  <td>{d.assignmentTitle}</td>
                  <td className="num">
                    {ai.percent}%{!ai.reliable && <span className="muted-text small"> (short text)</span>}
                  </td>
                  <td>
                    <AiBadge level={ai.level} />
                  </td>
                  <td>{strongest.length ? strongest.join(', ') : <span className="muted-text">None notable</span>}</td>
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
    </div>
  );
}
