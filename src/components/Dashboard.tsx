import { hasAlert } from '../analysis';
import { SAMPLE_SUBMISSIONS } from '../samples';
import { newId, nextPending, useStore } from '../state/store';
import type { DocItem } from '../types';
import { AiBadge, EmptyState, ReviewBadge, SimilarityBadge, kindLabel, percentText } from './common';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 19) return 'Good afternoon';
  return 'Good evening';
}

export function Dashboard() {
  const { state, dispatch, submissions, analysis, go, notify } = useStore();
  const references = state.docs.filter((d) => d.analyzed && d.isReference).length;
  const staged = state.docs.filter((d) => !d.analyzed).length;

  const loadSamples = () => {
    const docs: DocItem[] = SAMPLE_SUBMISSIONS.map((s) => ({
      id: newId(),
      fileName: s.fileName,
      kind: 'txt',
      studentName: s.studentName,
      assignmentTitle: s.assignmentTitle,
      isReference: false,
      text: s.text,
      state: 'ready',
      analyzed: true,
      reviewStatus: 'pending',
      finalComment: '',
      notes: [],
    }));
    dispatch({ type: 'addDocs', docs });
    notify(`${docs.length} sample submissions loaded and analyzed.`);
  };

  const pending = submissions.filter((d) => d.reviewStatus === 'pending');
  const reviewed = submissions.length - pending.length;
  const alerts = submissions.filter((d) => hasAlert(analysis.byId.get(d.id))).length;
  const next = nextPending(submissions);

  return (
    <div className="page">
      <section className="page-intro">
        <h2 className="greeting">{greeting()}, Nalleli.</h2>
        <p className="muted-text">
          Review authenticity, format and English writing quality. Files stay in this browser tab only.
        </p>
      </section>

      {submissions.length === 0 ? (
        <EmptyState
          title="No submissions in this session yet"
          actions={
            <>
              <button type="button" className="button button-primary" onClick={() => go('upload')}>
                Upload files
              </button>
              <button type="button" className="button button-secondary" onClick={loadSamples}>
                Load sample submissions
              </button>
            </>
          }
        >
          <p>
            Start by uploading your students’ work (.docx, .pdf or .txt). Assistant Helper compares the submissions with each
            other and with any reference files you choose, checks the format and flags writing and AI indicators.
          </p>
          {staged > 0 && (
            <p className="note-inline">
              You have {staged} file{staged === 1 ? '' : 's'} waiting on the Upload screen. Press “Analyze” there to see them here.
            </p>
          )}
        </EmptyState>
      ) : (
        <>
          <section className="stats" aria-label="Session summary">
            <div className="stat card">
              <span className="stat-value">{submissions.length}</span>
              <span className="stat-label">Submissions loaded</span>
            </div>
            <div className="stat card">
              <span className="stat-value">{pending.length}</span>
              <span className="stat-label">Pending review</span>
            </div>
            <div className="stat card">
              <span className="stat-value">{reviewed}</span>
              <span className="stat-label">Reviewed</span>
            </div>
            <div className={`stat card${alerts ? ' stat-alert' : ''}`}>
              <span className="stat-value">{alerts}</span>
              <span className="stat-label">With alerts</span>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Submissions</h2>
                <p className="muted-text small">
                  Similarity threshold: {state.settings.similarityThreshold}%
                  {references > 0 && ` · ${references} reference file${references === 1 ? '' : 's'}`}
                </p>
              </div>
              <button
                type="button"
                className="button button-primary"
                disabled={!next}
                onClick={() => next && go('review', next.id)}
              >
                {next ? 'Review next submission' : 'All submissions reviewed'}
              </button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Assignment</th>
                  <th scope="col">Type</th>
                  <th scope="col">Similarity</th>
                  <th scope="col">AI indicators</th>
                  <th scope="col">Review</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((d) => {
                  const a = analysis.byId.get(d.id);
                  return (
                    <tr key={d.id}>
                      <td className="strong">{d.studentName}</td>
                      <td>{d.assignmentTitle}</td>
                      <td>{kindLabel(d.kind)}</td>
                      <td>
                        {a && (
                          <span className="cell-flex">
                            <span className="num">{percentText(a.similarity.percent)}</span>
                            <SimilarityBadge status={a.status} />
                          </span>
                        )}
                      </td>
                      <td>{a?.ai ? <AiBadge level={a.ai.level} /> : <span className="muted-text">Off</span>}</td>
                      <td>
                        <ReviewBadge status={d.reviewStatus} />
                      </td>
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
        </>
      )}
    </div>
  );
}
