import { locale, t, tk } from '../i18n';
import { useState } from 'react';
import { useStore, type View } from '../state/store';
import { initials } from '../types';

export const TITLES: Record<View, string> = {
  dashboard: tk('Dashboard'),
  upload: tk('Upload'),
  review: tk('Submission Review'),
  plagiarism: tk('Plagiarism Detector'),
  ai: tk('AI Indicators'),
  settings: tk('Settings'),
};

const SUBTITLES: Record<View, string> = {
  dashboard: tk('Overview of this session'),
  upload: tk('Add submissions and reference files'),
  review: tk('Read, check and decide'),
  plagiarism: tk('Compare documents within this session'),
  ai: tk('Advisory writing signals'),
  settings: tk('Criteria and custom rules'),
};

// Flujo principal en 3 pasos: Upload → Review → Complete
export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { state, submissions } = useStore();
  const [photoOk, setPhotoOk] = useState(true);
  const profile = state.profile;
  const reviewed = submissions.filter((d) => d.reviewStatus !== 'pending').length;
  const allDone = submissions.length > 0 && reviewed === submissions.length;
  const step = submissions.length === 0 ? 1 : allDone ? 3 : 2;
  const today = new Date().toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric' });

  const steps = [t('Upload'), t('Review'), t('Complete')];
  return (
    <header className="topbar">
      <img className="topbar-logo" src="/logo-mark.svg" alt="" width="32" height="32" />
      <div className="topbar-heading">
        <h1 className="topbar-title">{t(TITLES[state.view])}</h1>
        <p className="topbar-sub">
          {t(SUBTITLES[state.view])} · {today}
        </p>
      </div>
      <ol className="steps" aria-label={t('Workflow progress')}>
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
      {profile && (
        <button type="button" className="topbar-menu" onClick={onMenu} aria-label={t('Open menu')} title={t('Open menu')}>
          {profile.photoURL && photoOk ? (
            <img className="avatar avatar-photo" src={profile.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setPhotoOk(false)} />
          ) : (
            <span className="avatar" aria-hidden="true">
              {initials(profile.name)}
            </span>
          )}
        </button>
      )}
    </header>
  );
}
