import { useEffect, useMemo, useState } from 'react';
import { docLabel, nextPending, useStore } from '../state/store';
import type { ReviewStatus } from '../types';
import { AiBadge, EmptyState, Modal, OutcomeBadge, ReviewBadge, SimilarityBadge, kindLabel, percentText } from './common';
import { DocumentViewer, type Highlight } from './DocumentViewer';
import { Icon } from './icons';
import { ResultsPanel } from './ResultsPanel';

export function Review() {
  const { state, dispatch, submissions, analysis, docById, go, notify } = useStore();
  const [completing, setCompleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [focusSource, setFocusSource] = useState<string | null>(null);
  const [jumpToken, setJumpToken] = useState(0);

  const doc =
    submissions.find((d) => d.id === state.selectedId) ?? nextPending(submissions) ?? submissions[0] ?? undefined;
  const a = doc ? analysis.byId.get(doc.id) : undefined;

  const plagHighlights: Highlight[] = useMemo(
    () =>
      a?.similarity.ranges.map((r) => ({
        start: r.start,
        end: r.end,
        title: `Matches: ${r.sources.map((s) => docLabel(docById(s))).join(', ')}`,
        sources: r.sources,
      })) ?? [],
    [a, docById],
  );
  const aiHighlights: Highlight[] = useMemo(
    () => a?.ai?.sentences.map((s) => ({ start: s.start, end: s.end, title: `AI indicator: ${s.reasons.join('; ')}` })) ?? [],
    [a],
  );

  // Al cambiar de entrega se quita el énfasis de la anterior
  useEffect(() => setFocusSource(null), [doc?.id]);

  if (!doc || !a) {
    return (
      <div className="page">
        <EmptyState
          title="Nothing to review yet"
          actions={
            <button type="button" className="button button-primary" onClick={() => go('upload')}>
              Upload files
            </button>
          }
        >
          <p>Upload and analyze submissions to review them here.</p>
        </EmptyState>
      </div>
    );
  }

  const exportReport = async () => {
    setExporting(true);
    try {
      const { exportReport: run } = await import('../report/pdfReport');
      run(doc, a, state.settings, (id) => docLabel(docById(id)), state.profile);
    } catch {
      notify('The report could not be created. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const index = submissions.findIndex((d) => d.id === doc.id);
  const prev = index > 0 ? submissions[index - 1] : undefined;
  const nextDoc = index < submissions.length - 1 ? submissions[index + 1] : undefined;

  const failed = a.checks.filter((c) => c.outcome === 'failed').length;
  const toReview = a.checks.filter((c) => c.outcome === 'review').length;

  return (
    <div className="page review-page">
      <section className="review-header card">
        <div>
          <label className="field-label" htmlFor="submission-select">
            Submission {index + 1} of {submissions.length}
          </label>
          <div className="submission-nav">
          <button
            type="button"
            className="icon-button nav-arrow"
            aria-label="Previous submission"
            disabled={!prev}
            onClick={() => prev && go('review', prev.id)}
          >
            <Icon name="arrow" size={18} className="flip" />
          </button>
          <select
            id="submission-select"
            className="input select"
            value={doc.id}
            onChange={(e) => go('review', e.target.value)}
          >
            {submissions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.studentName} — {d.assignmentTitle} ({d.reviewStatus === 'pending' ? 'pending' : 'reviewed'})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button nav-arrow"
            aria-label="Next submission"
            disabled={!nextDoc}
            onClick={() => nextDoc && go('review', nextDoc.id)}
          >
            <Icon name="arrow" size={18} />
          </button>
          </div>
          <p className="small muted-text review-meta">
            {doc.fileName} · {kindLabel(doc.kind)} · {a.wordCount} words · <ReviewBadge status={doc.reviewStatus} />
          </p>
        </div>
        <div className="button-row">
          <button type="button" className="button button-secondary" onClick={exportReport} disabled={exporting}>
            <Icon name="download" size={16} /> {exporting ? 'Preparing PDF…' : 'Export report'}
          </button>
          <button type="button" className="button button-primary" onClick={() => setCompleting(true)}>
            <Icon name="check" size={16} /> Complete review
          </button>
        </div>
      </section>

      <div className="review-grid">
        <DocumentViewer
          key={doc.id}
          text={doc.text}
          title={`${doc.studentName} — ${doc.assignmentTitle}`}
          plag={plagHighlights}
          ai={aiHighlights}
          aiEnabled={!!a.ai}
          emphasize={focusSource}
          jumpToken={jumpToken}
        />
        <ResultsPanel
          key={`r-${doc.id}`}
          doc={doc}
          analysis={a}
          focusedSource={focusSource}
          onFocusSource={setFocusSource}
          onJumpToSource={(id) => {
            setFocusSource(id);
            setJumpToken((t) => t + 1);
          }}
        />
      </div>

      {completing && (
        <CompleteReviewModal
          key={doc.id}
          initialComment={doc.finalComment}
          initialDecision={doc.reviewStatus === 'pending' ? null : doc.reviewStatus}
          summary={
            <dl className="summary-list">
              <div>
                <dt>Student</dt>
                <dd>{doc.studentName}</dd>
              </div>
              <div>
                <dt>Assignment</dt>
                <dd>{doc.assignmentTitle}</dd>
              </div>
              <div>
                <dt>Similarity</dt>
                <dd>
                  {percentText(a.similarity.percent)} <SimilarityBadge status={a.status} />
                </dd>
              </div>
              <div>
                <dt>Format &amp; writing</dt>
                <dd>
                  {failed > 0 && (
                    <>
                      {failed} <OutcomeBadge outcome="failed" />{' '}
                    </>
                  )}
                  {toReview > 0 && (
                    <>
                      {toReview} <OutcomeBadge outcome="review" />
                    </>
                  )}
                  {failed === 0 && toReview === 0 && <OutcomeBadge outcome="passed" />}
                </dd>
              </div>
              <div>
                <dt>AI indicators</dt>
                <dd>{a.ai ? <><span>{a.ai.percent}%</span> <AiBadge level={a.ai.level} /></> : 'Off'}</dd>
              </div>
              <div>
                <dt>Teacher notes</dt>
                <dd>{doc.notes.length}</dd>
              </div>
            </dl>
          }
          onClose={() => setCompleting(false)}
          onConfirm={(decision, comment) => {
            dispatch({ type: 'completeReview', id: doc.id, decision, comment });
            setCompleting(false);
            const next = nextPending(
              submissions.map((d) => (d.id === doc.id ? { ...d, reviewStatus: decision } : d)),
              doc.id,
            );
            if (next) {
              notify(`Review saved for ${doc.studentName}. Next: ${next.studentName}.`);
              go('review', next.id);
            } else {
              notify(`Review saved for ${doc.studentName}. All submissions have been reviewed.`);
              go('dashboard');
            }
          }}
        />
      )}
    </div>
  );
}

function CompleteReviewModal({
  summary,
  initialComment,
  initialDecision,
  onClose,
  onConfirm,
}: {
  summary: React.ReactNode;
  initialComment: string;
  initialDecision: Exclude<ReviewStatus, 'pending'> | null;
  onClose: () => void;
  onConfirm: (decision: Exclude<ReviewStatus, 'pending'>, comment: string) => void;
}) {
  const [comment, setComment] = useState(initialComment);
  const [decision, setDecision] = useState<Exclude<ReviewStatus, 'pending'> | null>(initialDecision);

  return (
    <Modal
      title="Complete review"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!decision}
            onClick={() => decision && onConfirm(decision, comment.trim())}
          >
            Confirm and continue
          </button>
        </>
      }
    >
      {summary}
      <label className="field-label" htmlFor="final-comment">
        Final comment
      </label>
      <textarea
        id="final-comment"
        className="input textarea"
        rows={4}
        value={comment}
        placeholder="Feedback for the student…"
        onChange={(e) => setComment(e.target.value)}
      />
      <fieldset className="decision">
        <legend className="field-label">Decision</legend>
        <label className="radio">
          <input type="radio" name="decision" checked={decision === 'approved'} onChange={() => setDecision('approved')} />
          Approved
        </label>
        <label className="radio">
          <input
            type="radio"
            name="decision"
            checked={decision === 'needs-corrections'}
            onChange={() => setDecision('needs-corrections')}
          />
          Needs corrections
        </label>
      </fieldset>
    </Modal>
  );
}
