import { useStore, type View } from '../state/store';

const TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  upload: 'Upload',
  review: 'Submission Review',
  plagiarism: 'Plagiarism Detector',
  ai: 'AI Indicators',
  settings: 'Settings',
};

const SUBTITLES: Record<View, string> = {
  dashboard: 'Overview of this session',
  upload: 'Add submissions and reference files',
  review: 'Read, check and decide',
  plagiarism: 'Compare documents within this session',
  ai: 'Advisory writing signals',
  settings: 'Criteria and custom rules',
};

// Flujo principal en 3 pasos: Upload → Review → Complete
export function Topbar() {
  const { state, submissions } = useStore();
  const reviewed = submissions.filter((d) => d.reviewStatus !== 'pending').length;
  const allDone = submissions.length > 0 && reviewed === submissions.length;
  const step = submissions.length === 0 ? 1 : allDone ? 3 : 2;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const steps = ['Upload', 'Review', 'Complete'];
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <h1 className="topbar-title">{TITLES[state.view]}</h1>
        <p className="topbar-sub">
          {SUBTITLES[state.view]} · {today}
        </p>
      </div>
      <ol className="steps" aria-label="Workflow progress">
        {steps.map((label, i) => {
          const n = i + 1;
          const status = n < step || allDone ? 'done' : n === step ? 'current' : 'todo';
          return (
            <li key={label} className={`step step-${status}`} aria-current={status === 'current' ? 'step' : undefined}>
              <span className="step-number" aria-hidden="true">
                {status === 'done' ? '✓' : n}
              </span>
              {label}
              {i < steps.length - 1 && <span className="step-line" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </header>
  );
}
