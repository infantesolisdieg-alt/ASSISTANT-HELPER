import { hasAlert } from '../analysis';
import { HIGH_MATCH_PERCENT } from '../analysis/similarity';
import type { SimilarityStatus } from '../analysis/types';
import { SAMPLE_SUBMISSIONS } from '../samples';
import { docLabel, newId, nextPending, useStore } from '../state/store';
import { firstName, type DocItem } from '../types';
import { Donut, ProgressSegments, SimilarityBars, type DonutSegment, type Tone } from './charts';
import { AiBadge, EmptyState, ReviewBadge, SimilarityBadge, kindLabel, percentText } from './common';
import { CountUp } from './CountUp';
import { Icon, type IconName } from './icons';
import { Insights } from './Insights';
import { STATUS_LABEL, STATUS_TONE } from './tones';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 19) return 'Good afternoon';
  return 'Good evening';
}

function StatCard({ icon, value, label, tone }: { icon: IconName; value: number; label: string; tone: string }) {
  return (
    <div className={`stat card stat-${tone}`}>
      <span className="stat-icon">
        <Icon name={icon} size={22} />
      </span>
      <span className="stat-body">
        <span className="stat-value">
          <CountUp value={value} />
        </span>
        <span className="stat-label">{label}</span>
      </span>
    </div>
  );
}

export function Dashboard() {
  const { state, dispatch, submissions, analysis, docById, go, notify } = useStore();
  const references = state.docs.filter((d) => d.analyzed && d.isReference).length;
  const staged = state.docs.filter((d) => !d.analyzed).length;
  const profile = state.profile!;

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
  const approved = submissions.filter((d) => d.reviewStatus === 'approved').length;
  const corrections = submissions.filter((d) => d.reviewStatus === 'needs-corrections').length;
  const reviewed = approved + corrections;
  const alerts = submissions.filter((d) => hasAlert(analysis.byId.get(d.id))).length;
  const next = nextPending(submissions);

  const progress: DonutSegment[] = [
    { key: 'approved', label: 'Approved', value: approved, tone: 'ok' },
    { key: 'corrections', label: 'Needs corrections', value: corrections, tone: 'warn' },
    { key: 'pending', label: 'Pending', value: pending.length, tone: 'neutral' },
  ];

  const bars = submissions
    .map((d) => {
      const a = analysis.byId.get(d.id);
      const top = a?.similarity.matches[0];
      return {
        id: d.id,
        label: d.studentName,
        sublabel: d.assignmentTitle,
        value: a?.similarity.percent ?? 0,
        tone: a ? STATUS_TONE[a.status] : ('neutral' as Tone),
        statusLabel: a ? STATUS_LABEL[a.status] : '',
        detail: top ? `Top match: ${docLabel(docById(top.docId))}` : 'No matches',
      };
    })
    .sort((x, y) => y.value - x.value);

  const statusCounts = (['clear', 'review', 'high'] as SimilarityStatus[]).map((s) => ({
    s,
    n: submissions.filter((d) => analysis.byId.get(d.id)?.status === s).length,
  }));
  const threshold = state.settings.similarityThreshold;

  return (
    <div className="page">
      <section className="page-intro">
        <div>
          <h2 className="greeting">
            {greeting()}, {firstName(profile.name)}.
          </h2>
          <p className="muted-text">
            {profile.group ? `${profile.group} · ` : ''}Review authenticity, format and English writing quality. Files stay in
            this browser tab only.
          </p>
        </div>
        {submissions.length > 0 && (
          <button
            type="button"
            className="button button-primary button-lg"
            disabled={!next}
            onClick={() => next && go('review', next.id)}
          >
            {next ? (
              <>
                Review next submission <Icon name="arrow" size={18} />
              </>
            ) : (
              <>
                <Icon name="check" size={18} /> All submissions reviewed
              </>
            )}
          </button>
        )}
      </section>

      {submissions.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No submissions in this session yet"
          actions={
            <>
              <button type="button" className="button button-primary" onClick={() => go('upload')}>
                <Icon name="upload" size={18} /> Upload files
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
            <StatCard icon="inbox" value={submissions.length} label="Submissions loaded" tone="brand" />
            <StatCard icon="clock" value={pending.length} label="Pending review" tone="neutral" />
            <StatCard icon="check" value={reviewed} label="Reviewed" tone="ok" />
            <StatCard icon="alert" value={alerts} label="With alerts" tone={alerts ? 'bad' : 'neutral'} />
          </section>

          {!next && (
            <section className="card complete-card" aria-live="polite">
              <svg className="complete-check" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="25" />
                <polyline points="17 29 25 37 40 21" />
              </svg>
              <div>
                <h2>Session complete</h2>
                <p className="muted-text">
                  You reviewed all {submissions.length} submissions: {approved} approved and {corrections} need corrections.
                  Export the reports you need before clearing the temporary files.
                </p>
              </div>
              <button type="button" className="button button-secondary" onClick={() => go('upload')}>
                <Icon name="upload" size={16} /> Upload more
              </button>
            </section>
          )}

          <Insights />

          <section className="chart-grid">
            <div className="card chart-card">
              <h2>Review progress</h2>
              <p className="muted-text small">
                {reviewed} of {submissions.length} submissions reviewed
              </p>
              <Donut
                title="Review progress by decision"
                segments={progress}
                centerValue={`${Math.round((reviewed / submissions.length) * 100)}%`}
                centerLabel="reviewed"
              />
            </div>

            <div className="card chart-card">
              <div className="chart-head">
                <div>
                  <h2>Similarity by submission</h2>
                  <p className="muted-text small">Click a bar to open that review.</p>
                </div>
                <ul className="chart-legend">
                  {statusCounts.map(({ s, n }) => (
                    <li key={s}>
                      <span className="legend-swatch" style={{ background: `var(--st-${STATUS_TONE[s]})` }} aria-hidden="true" />
                      {STATUS_LABEL[s]} <span className="legend-value">{n}</span>
                    </li>
                  ))}
                  <li>
                    <span className="legend-line" aria-hidden="true" />
                    {threshold < HIGH_MATCH_PERCENT ? `Threshold ${threshold}% · High ${HIGH_MATCH_PERCENT}%` : `High match ${HIGH_MATCH_PERCENT}%`}
                  </li>
                </ul>
              </div>
              <SimilarityBars rows={bars} threshold={threshold} high={HIGH_MATCH_PERCENT} onSelect={(id) => go('review', id)} />
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Submissions</h2>
                <p className="muted-text small">
                  Similarity threshold: {threshold}%
                  {references > 0 && ` · ${references} reference file${references === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="progress-wrap">
                <span className="small muted-text">
                  {reviewed}/{submissions.length} reviewed
                </span>
                <ProgressSegments segments={progress} />
              </div>
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
                    <tr key={d.id} className="row-link" onClick={() => go('review', d.id)}>
                      <td>
                        <span className="student-cell">
                          <span className="mini-avatar" aria-hidden="true">
                            {d.studentName.charAt(0).toUpperCase()}
                          </span>
                          <span className="strong">{d.studentName}</span>
                        </span>
                      </td>
                      <td>{d.assignmentTitle}</td>
                      <td>
                        <span className="file-chip">{kindLabel(d.kind)}</span>
                      </td>
                      <td>
                        {a && (
                          <span className="cell-flex">
                            <span className="num">{percentText(a.similarity.percent)}</span>
                            <SimilarityBadge status={a.status} />
                          </span>
                        )}
                      </td>
                      <td>
                        {a?.ai ? (
                          <span className="cell-flex">
                            <span className="num">{a.ai.percent}%</span>
                            <AiBadge level={a.ai.level} />
                          </span>
                        ) : (
                          <span className="muted-text">Off</span>
                        )}
                      </td>
                      <td>
                        <ReviewBadge status={d.reviewStatus} />
                      </td>
                      <td className="right">
                        <button
                          type="button"
                          className="button button-link"
                          aria-label={`Open review for ${d.studentName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            go('review', d.id);
                          }}
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
