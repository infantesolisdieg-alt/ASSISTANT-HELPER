import { useStore, type View } from '../state/store';

const TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  upload: 'Upload',
  review: 'Submission Review',
  plagiarism: 'Plagiarism Detector',
  ai: 'AI Indicators',
  settings: 'Settings',
};

// Flujo principal en 3 pasos: Upload → Review → Complete
export function Topbar() {
  const { state, submissions } = useStore();
  const reviewed = submissions.filter((d) => d.reviewStatus !== 'pending').length;
  const allDone = submissions.length > 0 && reviewed === submissions.length;
  const step = submissions.length === 0 ? 1 : allDone ? 3 : 2;

  const steps = ['Upload', 'Review', 'Complete'];
  return (
    <header className="topbar">
      <h1 className="topbar-title">{TITLES[state.view]}</h1>
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
            </li>
          );
        })}
      </ol>
    </header>
  );
}
