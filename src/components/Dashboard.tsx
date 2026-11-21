import { hasAlert } from '../analysis';
import { HIGH_MATCH_PERCENT } from '../analysis/similarity';
import { APP_NAME, t, tn } from '../i18n';
import type { SimilarityStatus } from '../analysis/types';
import { SAMPLE_SUBMISSIONS } from '../samples';
import { docLabel, newId, nextPending, useStore } from '../state/store';
import { firstName, type DocItem } from '../types';
import { Donut, SimilarityBars, type DonutSegment, type Tone } from './charts';
import { EmptyState } from './common';
import { CountUp } from './CountUp';
import { Icon, type IconName } from './icons';
import { Insights } from './Insights';
import { SubmissionsList } from './SubmissionsList';
import { STATUS_LABEL, STATUS_TONE } from './tones';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return t('Good morning');
  if (h < 19) return t('Good afternoon');
  return t('Good evening');
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
  const staged = state.docs.filter((d) => !d.analyzed).length;
  const profile = state.profile!;

  const loadSamples = () => {
    const docs: DocItem[] = SAMPLE_SUBMISSIONS.map((s) => ({
      id: newId(),
      fileName: s.fileName,
      kind: 'txt',
      studentName: s.studentName,
      group: s.group,
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
    notify(t('{n} sample submissions loaded and analyzed.', { n: docs.length }));
  };

  const pending = submissions.filter((d) => d.reviewStatus === 'pending');
  const approved = submissions.filter((d) => d.reviewStatus === 'approved').length;
  const corrections = submissions.filter((d) => d.reviewStatus === 'needs-corrections').length;
  const reviewed = approved + corrections;
  const alerts = submissions.filter((d) => hasAlert(analysis.byId.get(d.id))).length;
  const next = nextPending(submissions);

  const progress: DonutSegment[] = [
    { key: 'approved', label: t('Approved'), value: approved, tone: 'ok' },
    { key: 'corrections', label: t('Needs corrections'), value: corrections, tone: 'warn' },
    { key: 'pending', label: t('Pending'), value: pending.length, tone: 'neutral' },
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
        statusLabel: a ? t(STATUS_LABEL[a.status]) : '',
        detail: top ? t('Top match: {doc}', { doc: docLabel(docById(top.docId)) }) : t('No matches'),
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
            {profile.group ? `${profile.group} · ` : ''}
            {profile.uid
              ? t('Review authenticity, format and English writing quality. Your work is saved to your Google account.')
              : t('Review authenticity, format and English writing quality. Files stay in this browser tab only.')}
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
                {t('Review next submission')} <Icon name="arrow" size={18} />
              </>
            ) : (
              <>
                <Icon name="check" size={18} /> {t('All submissions reviewed')}
              </>
            )}
          </button>
        )}
      </section>

      {submissions.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={t('No submissions in this session yet')}
          actions={
            <>
              <button type="button" className="button button-primary" onClick={() => go('upload')}>
                <Icon name="upload" size={18} /> {t('Upload files')}
              </button>
              <button type="button" className="button button-secondary" onClick={loadSamples}>
                {t('Load sample submissions')}
              </button>
            </>
          }
        >
          <p>
            {t(
              'Start by uploading your students’ work (Word, PDF, text or images). {app} compares the submissions with each other and with any reference files you choose, checks the format and flags writing and AI indicators.',
              { app: APP_NAME },
            )}
          </p>
          {staged > 0 && (
            <p className="note-inline">
              {tn(
                staged,
                'You have {n} file waiting on the Upload screen. Press “Analyze” there to see it here.',
                'You have {n} files waiting on the Upload screen. Press “Analyze” there to see them here.',
              )}
            </p>
          )}
        </EmptyState>
      ) : (
        <>
          <section className="stats" aria-label={t('Session summary')}>
            <StatCard icon="inbox" value={submissions.length} label={t('Submissions loaded')} tone="brand" />
            <StatCard icon="clock" value={pending.length} label={t('Pending review')} tone="neutral" />
            <StatCard icon="check" value={reviewed} label={t('Reviewed')} tone="ok" />
            <StatCard icon="alert" value={alerts} label={t('With alerts')} tone={alerts ? 'bad' : 'neutral'} />
          </section>

          {!next && (
            <section className="card complete-card" aria-live="polite">
              <svg className="complete-check" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="25" />
                <polyline points="17 29 25 37 40 21" />
              </svg>
              <div>
                <h2>{t('Session complete')}</h2>
                <p className="muted-text">
                  {t(
                    'You reviewed all {n} submissions: {approved} approved and {corrections} need corrections. Export the reports you need before clearing the temporary files.',
                    { n: submissions.length, approved, corrections },
                  )}
                </p>
              </div>
              <button type="button" className="button button-secondary" onClick={() => go('upload')}>
                <Icon name="upload" size={16} /> {t('Upload more')}
              </button>
            </section>
          )}

          <Insights />

          <section className="chart-grid">
            <div className="card chart-card">
              <h2>{t('Review progress')}</h2>
              <p className="muted-text small">{t('{done} of {n} submissions reviewed', { done: reviewed, n: submissions.length })}</p>
              <Donut
                title={t('Review progress by decision')}
                segments={progress}
                centerValue={`${Math.round((reviewed / submissions.length) * 100)}%`}
                centerLabel={t('reviewed')}
              />
            </div>

            <div className="card chart-card">
              <div className="chart-head">
                <div>
                  <h2>{t('Similarity by submission')}</h2>
                  <p className="muted-text small">{t('Click a bar to open that review.')}</p>
                </div>
                <ul className="chart-legend">
                  {statusCounts.map(({ s, n }) => (
                    <li key={s}>
                      <span className="legend-swatch" style={{ background: `var(--st-${STATUS_TONE[s]})` }} aria-hidden="true" />
                      {t(STATUS_LABEL[s])} <span className="legend-value">{n}</span>
                    </li>
                  ))}
                  <li>
                    <span className="legend-line" aria-hidden="true" />
                    {threshold < HIGH_MATCH_PERCENT
                      ? t('Threshold {threshold}% · High {high}%', { threshold, high: HIGH_MATCH_PERCENT })
                      : t('High match {high}%', { high: HIGH_MATCH_PERCENT })}
                  </li>
                </ul>
              </div>
              <SimilarityBars rows={bars} threshold={threshold} high={HIGH_MATCH_PERCENT} onSelect={(id) => go('review', id)} />
            </div>
          </section>

          <SubmissionsList />
        </>
      )}
    </div>
  );
}
