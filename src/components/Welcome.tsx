// Pantalla de bienvenida. Con Firebase configurado: "Continue with Google" (el trabajo se guarda en la
// cuenta). Siempre está la opción sin cuenta: el perfil vive en memoria y se borra al cerrar la pestaña.

import { useEffect, useState, type FormEvent } from 'react';
import { cloudEnabled } from '../cloud/config';
import { useStore } from '../state/store';
import { acceptTermsNow, forgetAcceptance } from '../terms';
import { DEMO_PROFILE, type TeacherProfile } from '../types';
import { TermsDialog } from './Terms';
import { Icon, type IconName } from './icons';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'plagiarism', title: 'Similarity check', text: 'Compare submissions with each other and with your reference files.' },
  { icon: 'review', title: 'Format & writing', text: 'Font, spacing, margins, citations, passive voice and long sentences.' },
  { icon: 'ai', title: 'AI indicators', text: 'Advisory signals calculated in your browser, never sent anywhere.' },
];

export function Welcome() {
  const { dispatch } = useStore();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [group, setGroup] = useState('');
  const [touched, setTouched] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [showLocal, setShowLocal] = useState(!cloudEnabled);
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Cada profesor que llega a la bienvenida acepta los términos de nuevo
  useEffect(() => forgetAcceptance(), []);

  /** Revisa que se hayan aceptado los términos; si no, marca la casilla en rojo. */
  const checkAgreed = () => {
    if (agreed) return true;
    setAgreeError(true);
    document.getElementById('terms-agree')?.focus();
    return false;
  };
  const start = (profile: TeacherProfile) => {
    if (!checkAgreed()) return;
    dispatch({ type: 'signIn', profile: { ...profile, ...acceptTermsNow() } });
  };

  const google = async () => {
    if (!checkAgreed()) return;
    acceptTermsNow();
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      const cloud = await import('../cloud/cloud');
      try {
        await cloud.signInWithGoogle();
        // CloudSync detecta la sesión y carga la cuenta
      } catch (e) {
        const msg = cloud.friendlyError(e);
        if (msg) setGoogleError(msg);
      }
    } catch {
      setGoogleError('The sign-in service could not be loaded. Check your internet connection.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const nameError = touched && !name.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    start({ name: name.trim().replace(/\s+/g, ' '), role: role.trim() || 'Teacher', group: group.trim() });
  };

  return (
    <div className="welcome">
      <section className="welcome-hero" aria-labelledby="welcome-brand">
        <div className="welcome-brand">
          <img className="brand-logo brand-logo-lg" src="/logo-mark.svg" alt="" width="56" height="56" />
          <span id="welcome-brand">Assistant Helper</span>
        </div>
        <h1 className="welcome-title">Review your students’ English writing with confidence.</h1>
        <p className="welcome-lead">
          Authenticity, format and writing quality in one place — for business letters, formal emails, memos and meeting
          minutes.
        </p>
        <ul className="welcome-features">
          {FEATURES.map((f, i) => (
            <li key={f.title} style={{ animationDelay: `${120 + i * 80}ms` }}>
              <span className="feature-icon">
                <Icon name={f.icon} size={20} />
              </span>
              <span>
                <strong>{f.title}</strong>
                <span className="feature-text">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="welcome-privacy">
          <Icon name="shield" size={16} />{' '}
          {cloudEnabled
            ? 'Files are read in your browser. With Google, only the text and your results are saved to your private account.'
            : 'Everything runs in this browser tab. Nothing is stored on a server.'}
        </p>
      </section>

      <section className="welcome-panel">
        <form className="welcome-form card" onSubmit={submit} noValidate>
          <h2>Welcome</h2>
          <div className={`terms-agree${agreeError && !agreed ? ' terms-agree-error' : ''}`}>
            <label className="checkbox">
              <input
                id="terms-agree"
                type="checkbox"
                checked={agreed}
                aria-describedby={agreeError && !agreed ? 'terms-agree-error' : undefined}
                onChange={(e) => {
                  setAgreed(e.target.checked);
                  setAgreeError(false);
                }}
              />
              <span>
                I have read and agree to the{' '}
                <button type="button" className="inline-link" onClick={() => setShowTerms(true)}>
                  Terms of Use and Privacy Notice
                </button>
                {cloudEnabled
                  ? ', including how Assistant Helper uses my Google account and the Google Drive files I choose.'
                  : '.'}
              </span>
            </label>
            {agreeError && !agreed && (
              <p id="terms-agree-error" className="form-hint text-bad" role="alert">
                Accept the terms to continue.
              </p>
            )}
          </div>
          {cloudEnabled && (
            <>
              <p className="muted-text">Sign in to keep your submissions, groups and reviews saved between sessions.</p>
              <button type="button" className="button google-button full" onClick={google} disabled={googleBusy}>
                {googleBusy ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6C12.3 13.6 17.6 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
                    <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.8-6z" />
                    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.4 0-11.7-4.1-13.6-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
                  </svg>
                )}
                {googleBusy ? 'Opening Google…' : 'Continue with Google'}
              </button>
              {googleError && (
                <p className="form-hint text-bad" role="alert">
                  {googleError}
                </p>
              )}
              <div className="divider">
                <span>or</span>
              </div>
              {!showLocal && (
                <button type="button" className="button button-secondary full" onClick={() => setShowLocal(true)}>
                  Use without an account
                </button>
              )}
            </>
          )}
          {showLocal && (
            <>
          <p className="muted-text">
            {cloudEnabled ? 'Without an account nothing is saved: everything is removed when you close the tab.' : 'Tell us who is reviewing in this session. No password is needed.'}
          </p>

          <label className="field-label" htmlFor="teacher-name">
            Full name <span className="required">(required)</span>
          </label>
          <input
            id="teacher-name"
            className={`input${nameError ? ' input-invalid' : ''}`}
            autoComplete="name"
            value={name}
            aria-invalid={nameError}
            aria-describedby={nameError ? 'teacher-name-error' : undefined}
            placeholder="e.g. Nalleli Olvera Castelan"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {nameError && (
            <p id="teacher-name-error" className="form-hint text-bad">
              Enter your name to start.
            </p>
          )}

          <label className="field-label" htmlFor="teacher-role">
            Role or subject
          </label>
          <input
            id="teacher-role"
            className="input"
            value={role}
            placeholder="e.g. Teacher · Bilingual Executive Secretary"
            onChange={(e) => setRole(e.target.value)}
          />

          <label className="field-label" htmlFor="teacher-group">
            Group <span className="muted-text">(optional)</span>
          </label>
          <input
            id="teacher-group"
            className="input"
            value={group}
            placeholder="e.g. 5th semester, Group B"
            onChange={(e) => setGroup(e.target.value)}
          />

          <button type="submit" className="button button-primary full welcome-submit">
            Start session <Icon name="arrow" size={18} />
          </button>
          <button
            type="button"
            className="button button-link welcome-demo"
            onClick={() => start(DEMO_PROFILE)}
          >
            Continue with the demo profile ({DEMO_PROFILE.name})
          </button>
          <p className="form-hint">Your name is only used in this tab and is removed when you close it.</p>
            </>
          )}
        </form>
        {showTerms && (
          <TermsDialog
            onClose={() => setShowTerms(false)}
            onAgree={() => {
              setAgreed(true);
              setAgreeError(false);
            }}
          />
        )}
      </section>
    </div>
  );
}
