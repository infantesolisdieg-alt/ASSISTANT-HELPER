// Pantalla de bienvenida. Con Firebase configurado: "Continue with Google" (el trabajo se guarda en la
// cuenta). Siempre está la opción sin cuenta: el perfil vive en memoria y se borra al cerrar la pestaña.
//
// Idioma: el formulario usa el idioma elegido (English / Español). El texto de la izquierda alterna
// solo entre los dos idiomas cada pocos segundos, con una transición suave (se puede pausar).
// El nombre de la app nunca se traduce: APP_NAME.

import { useEffect, useState, type FormEvent } from 'react';
import { cloudEnabled } from '../cloud/config';
import { APP_NAME, LANGS, t, tIn, tk, type Lang } from '../i18n';
import { useStore } from '../state/store';
import { acceptTermsNow, forgetAcceptance } from '../terms';
import { DEMO_PROFILE, type TeacherProfile } from '../types';
import { TermsDialog } from './Terms';
import { Icon, type IconName } from './icons';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'plagiarism', title: tk('Similarity check'), text: tk('Compare submissions with each other and with your reference files.') },
  { icon: 'review', title: tk('Format & writing'), text: tk('Font, spacing, margins, citations, passive voice and long sentences.') },
  { icon: 'ai', title: tk('AI indicators'), text: tk('Advisory signals calculated in your browser, never sent anywhere.') },
];

const HERO_TITLE = tk('Review your students’ English writing with confidence.');
const HERO_LEAD = tk('Authenticity, format and writing quality in one place — for business letters, formal emails, memos and meeting minutes.');
const HERO_PRIVACY_CLOUD = tk('Files are read in your browser. With Google, only the text and your results are saved to your private account.');
const HERO_PRIVACY_LOCAL = tk('Everything runs in this browser tab. Nothing is stored on a server.');

/** Cada cuánto cambia el idioma del texto de bienvenida. */
const SWAP_MS = 6000;

/** Texto de la izquierda en un idioma (se dibujan los dos, uno encima del otro, para cambiar sin saltos). */
function HeroCopy({ lang, active }: { lang: Lang; active: boolean }) {
  const words = tIn(lang, HERO_TITLE).split(' ');
  return (
    <div className={`hero-layer${active ? ' is-active' : ''}`} lang={lang} aria-hidden={!active}>
      <h1 className="welcome-title">
        {words.map((w, i) => (
          <span key={i} className="hero-word" style={{ transitionDelay: active ? `${80 + i * 45}ms` : '0ms' }}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </h1>
      <p className="welcome-lead">{tIn(lang, HERO_LEAD)}</p>
      <ul className="welcome-features">
        {FEATURES.map((f, i) => (
          <li key={f.title} style={{ transitionDelay: active ? `${260 + i * 90}ms` : '0ms' }}>
            <span className="feature-icon">
              <Icon name={f.icon} size={20} />
            </span>
            <span>
              <strong>{tIn(lang, f.title)}</strong>
              <span className="feature-text">{tIn(lang, f.text)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="welcome-privacy">
        <Icon name="shield" size={16} /> {tIn(lang, cloudEnabled ? HERO_PRIVACY_CLOUD : HERO_PRIVACY_LOCAL)}
      </p>
    </div>
  );
}

export function Welcome() {
  const { state, dispatch } = useStore();
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
  // Idioma que se muestra ahora en el texto de la izquierda
  const [heroLang, setHeroLang] = useState<Lang>(state.lang);
  const [paused, setPaused] = useState(false);

  // Cada profesor que llega a la bienvenida acepta los términos de nuevo
  useEffect(() => forgetAcceptance(), []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setHeroLang((l) => (l === 'en' ? 'es' : 'en')), SWAP_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const chooseLang = (lang: Lang) => {
    dispatch({ type: 'setLang', lang });
    setHeroLang(lang);
  };

  /** Revisa que se hayan aceptado los términos; si no, marca la casilla en rojo. */
  const checkAgreed = () => {
    if (agreed) return true;
    setAgreeError(true);
    document.getElementById('terms-agree')?.focus();
    return false;
  };
  const start = (profile: TeacherProfile) => {
    if (!checkAgreed()) return;
    dispatch({ type: 'signIn', profile: { ...profile, lang: state.lang, ...acceptTermsNow() } });
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
      setGoogleError(t('The sign-in service could not be loaded. Check your internet connection.'));
    } finally {
      setGoogleBusy(false);
    }
  };

  const nameError = touched && !name.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    start({ name: name.trim().replace(/\s+/g, ' '), role: role.trim() || t('Teacher'), group: group.trim() });
  };

  return (
    <div className="welcome">
      <section className="welcome-hero" aria-labelledby="welcome-brand">
        <div className="welcome-brand">
          <img className="brand-logo brand-logo-lg" src="/logo-mark.svg" alt="" width="56" height="56" />
          <span id="welcome-brand">{APP_NAME}</span>
        </div>

        <div className="hero-lang">
          <span className="hero-lang-pills" aria-hidden="true">
            {LANGS.map((l) => (
              <span key={l.id} className={`hero-lang-pill${heroLang === l.id ? ' is-active' : ''}`}>
                {l.id.toUpperCase()}
              </span>
            ))}
          </span>
          <span className="hero-lang-track" aria-hidden="true">
            <span key={`${heroLang}-${paused}`} className={`hero-lang-fill${paused ? ' is-paused' : ''}`} style={{ animationDuration: `${SWAP_MS}ms` }} />
          </span>
          <button
            type="button"
            className="hero-lang-pause"
            aria-pressed={paused}
            aria-label={paused ? t('Resume the language animation') : t('Pause the language animation')}
            title={paused ? t('Resume the language animation') : t('Pause the language animation')}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
                <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>

        <div className="hero-swap">
          {LANGS.map((l) => (
            <HeroCopy key={l.id} lang={l.id} active={heroLang === l.id} />
          ))}
        </div>
      </section>

      <section className="welcome-panel">
        <form className="welcome-form card" onSubmit={submit} noValidate lang={state.lang}>
          <div className="lang-choice">
            <span className="field-label" id="lang-choice-label">
              Language · Idioma
            </span>
            <div className="segmented lang-switch" role="radiogroup" aria-labelledby="lang-choice-label">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={state.lang === l.id}
                  lang={l.id}
                  onClick={() => chooseLang(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <h2 key={state.lang} className="lang-fade">
            {t('Welcome')}
          </h2>
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
                {t('I have read and agree to the')}{' '}
                <button type="button" className="inline-link" onClick={() => setShowTerms(true)}>
                  {t('Terms of Use and Privacy Notice')}
                </button>
                {cloudEnabled
                  ? t(', including how {app} uses my Google account and the Google Drive files I choose.', { app: APP_NAME })
                  : '.'}
              </span>
            </label>
            {agreeError && !agreed && (
              <p id="terms-agree-error" className="form-hint text-bad" role="alert">
                {t('Accept the terms to continue.')}
              </p>
            )}
          </div>
          {cloudEnabled && (
            <>
              <p className="muted-text">{t('Sign in to keep your submissions, groups and reviews saved between sessions.')}</p>
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
                {googleBusy ? t('Opening Google…') : t('Continue with Google')}
              </button>
              {googleError && (
                <p className="form-hint text-bad" role="alert">
                  {googleError}
                </p>
              )}
              <div className="divider">
                <span>{t('or')}</span>
              </div>
              {!showLocal && (
                <button type="button" className="button button-secondary full" onClick={() => setShowLocal(true)}>
                  {t('Use without an account')}
                </button>
              )}
            </>
          )}
          {showLocal && (
            <>
              <p className="muted-text">
                {cloudEnabled
                  ? t('Without an account nothing is saved: everything is removed when you close the tab.')
                  : t('Tell us who is reviewing in this session. No password is needed.')}
              </p>

              <label className="field-label" htmlFor="teacher-name">
                {t('Full name')} <span className="required">{t('(required)')}</span>
              </label>
              <input
                id="teacher-name"
                className={`input${nameError ? ' input-invalid' : ''}`}
                autoComplete="name"
                value={name}
                aria-invalid={nameError}
                aria-describedby={nameError ? 'teacher-name-error' : undefined}
                placeholder={t('e.g. Nalleli Olvera Castelan')}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
              />
              {nameError && (
                <p id="teacher-name-error" className="form-hint text-bad">
                  {t('Enter your name to start.')}
                </p>
              )}

              <label className="field-label" htmlFor="teacher-role">
                {t('Role or subject')}
              </label>
              <input
                id="teacher-role"
                className="input"
                value={role}
                placeholder={t('e.g. Teacher · Bilingual Executive Secretary')}
                onChange={(e) => setRole(e.target.value)}
              />

              <label className="field-label" htmlFor="teacher-group">
                {t('Group')} <span className="muted-text">{t('(optional)')}</span>
              </label>
              <input
                id="teacher-group"
                className="input"
                value={group}
                placeholder={t('e.g. 5th semester, Group B')}
                onChange={(e) => setGroup(e.target.value)}
              />

              <button type="submit" className="button button-primary full welcome-submit">
                {t('Start session')} <Icon name="arrow" size={18} />
              </button>
              <button
                type="button"
                className="button button-link welcome-demo"
                onClick={() => start({ ...DEMO_PROFILE, role: t(DEMO_PROFILE.role) })}
              >
                {t('Continue with the demo profile ({name})', { name: DEMO_PROFILE.name })}
              </button>
              <p className="form-hint">{t('Your name is only used in this tab and is removed when you close it.')}</p>
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
