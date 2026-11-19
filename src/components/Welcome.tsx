// Pantalla de bienvenida: el profesor indica quién revisa en esta sesión.
// No hay contraseña ni servidor: el perfil vive en memoria y se borra al cerrar la pestaña.

import { useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { DEMO_PROFILE } from '../types';
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

  const nameError = touched && !name.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    dispatch({
      type: 'signIn',
      profile: { name: name.trim().replace(/\s+/g, ' '), role: role.trim() || 'Teacher', group: group.trim() },
    });
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
          <Icon name="shield" size={16} /> Everything runs in this browser tab. Nothing is stored on a server.
        </p>
      </section>

      <section className="welcome-panel">
        <form className="welcome-form card" onSubmit={submit} noValidate>
          <h2>Welcome</h2>
          <p className="muted-text">Tell us who is reviewing in this session. No password is needed.</p>

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
            onClick={() => dispatch({ type: 'signIn', profile: DEMO_PROFILE })}
          >
            Continue with the demo profile ({DEMO_PROFILE.name})
          </button>
          <p className="form-hint">Your name is only used in this tab and is removed when you close it.</p>
        </form>
      </section>
    </div>
  );
}
