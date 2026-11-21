// Términos de uso y aviso de privacidad: ventana para leerlos y pantalla de aceptación para las
// cuentas de Google que todavía no aceptaron la versión actual.

import { useState } from 'react';
import { APP_NAME, locale, t, tn } from '../i18n';
import { useStore } from '../state/store';
import { acceptTermsNow, termsUrl } from '../terms';
import { Modal } from './common';
import { Icon } from './icons';

function TermsFrame({ section, tall }: { section?: string; tall?: boolean }) {
  return (
    <iframe
      className={`terms-frame${tall ? ' terms-frame-tall' : ''}`}
      src={termsUrl() + (section ? '#' + section : '')}
      title={t('Terms of Use and Privacy Notice')}
    />
  );
}

/** Ventana con los términos. Si se pasa onAgree, muestra el botón "I agree". */
export function TermsDialog({ onClose, onAgree, section }: { onClose: () => void; onAgree?: () => void; section?: string }) {
  return (
    <Modal
      title={t('Terms of Use and Privacy Notice')}
      onClose={onClose}
      wide
      footer={
        <>
          <a className="button button-link terms-newtab" href={termsUrl()} target="_blank" rel="noopener noreferrer">
            {t('Open in a new tab')}
          </a>
          <button type="button" className="button button-secondary" onClick={onClose}>
            {t('Close')}
          </button>
          {onAgree && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                onAgree();
                onClose();
              }}
            >
              {t('I agree')}
            </button>
          )}
        </>
      }
    >
      <TermsFrame section={section} />
    </Modal>
  );
}

/** Pantalla que bloquea la app hasta aceptar los términos (cuentas sin la versión actual). */
export function TermsGate() {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const updated = Boolean(state.profile?.termsVersion);

  const decline = async () => {
    setBusy(true);
    try {
      const cloud = await import('../cloud/cloud');
      await cloud.signOutCloud();
    } catch {
      // Sin conexión: igual se cierra la sesión local
    }
    dispatch({ type: 'signOut' });
  };

  return (
    <div className="terms-gate">
      <div className="terms-gate-card card">
        <div className="terms-gate-head">
          <img src="/logo-mark.svg" alt="" width="48" height="48" />
          <div>
            <h1>{updated ? t('Our terms were updated') : t('Before you continue')}</h1>
            <p className="muted-text">
              {t('Please read how {app} uses your Google account, the Google Drive files you choose and the work you save.', {
                app: APP_NAME,
              })}
            </p>
          </div>
        </div>
        <ul className="terms-points">
          <li>
            <Icon name="shield" size={16} /> {t('Original files are read in your browser and never uploaded.')}
          </li>
          <li>
            <Icon name="check" size={16} /> {t('Google Drive: only the files you pick, never the rest of your Drive.')}
          </li>
          <li>
            <Icon name="check" size={16} /> {t('Your saved work is private to your account and is never sold or shared.')}
          </li>
        </ul>
        <TermsFrame tall />
        <div className="terms-gate-actions">
          <button type="button" className="button button-link" onClick={decline} disabled={busy}>
            {t('Decline and sign out')}
          </button>
          <button
            type="button"
            className="button button-primary button-lg"
            disabled={busy}
            onClick={() => dispatch({ type: 'updateProfile', patch: acceptTermsNow() })}
          >
            {t('I agree and continue')} <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sección de Settings: términos aceptados, acceso de Google y borrar los datos guardados. */
export function PrivacyCard() {
  const { state, dispatch } = useStore();
  const p = state.profile!;
  const [showTerms, setShowTerms] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accepted = p.termsAcceptedAt
    ? new Date(p.termsAcceptedAt).toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const deleteAll = async () => {
    if (!p.uid) return;
    setDeleting(true);
    setError(null);
    try {
      const cloud = await import('../cloud/cloud');
      await cloud.deleteAccountData(p.uid);
      await cloud.signOutCloud().catch(() => undefined);
      dispatch({ type: 'signOut' });
    } catch (e) {
      const cloud = await import('../cloud/cloud').catch(() => null);
      setError((cloud && cloud.friendlyError(e)) || t('The data could not be deleted.'));
      setDeleting(false);
    }
  };

  return (
    <section className="card privacy-card">
      <h2>{t('Privacy and terms')}</h2>
      <div className="privacy-grid">
        <div className="privacy-item">
          <span className="privacy-icon">
            <Icon name="shield" size={18} />
          </span>
          <div>
            <h3>{t('Terms of Use and Privacy Notice')}</h3>
            <p className="muted-text small">
              {accepted ? t('You accepted version {version} on {date}.', { version: p.termsVersion ?? '', date: accepted }) : t('Accepted for this session.')}
            </p>
            <button type="button" className="button button-secondary" onClick={() => setShowTerms(true)}>
              {t('Read the terms')}
            </button>
          </div>
        </div>
        {p.uid && (
          <div className="privacy-item">
            <span className="privacy-icon">
              <Icon name="check" size={18} />
            </span>
            <div>
              <h3>{t('Google account and Drive access')}</h3>
              <p className="muted-text small">
                {t('{app} can only open the Drive files you choose. You can remove its access at any time.', { app: APP_NAME })}
              </p>
              <a className="button button-secondary" href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">
                {t('Manage Google access')}
              </a>
            </div>
          </div>
        )}
        {p.uid && (
          <div className="privacy-item privacy-danger">
            <span className="privacy-icon">
              <Icon name="trash" size={18} />
            </span>
            <div>
              <h3>{t('Delete my saved data')}</h3>
              <p className="muted-text small">{t('Deletes your profile, settings and every saved submission from the cloud, then signs you out.')}</p>
              <button
                type="button"
                className="button button-danger"
                onClick={() => setConfirmDelete(true)}
                disabled={state.cloud.state === 'saving'}
              >
                {t('Delete my saved data')}
              </button>
            </div>
          </div>
        )}
      </div>
      {showTerms && <TermsDialog onClose={() => setShowTerms(false)} />}
      {confirmDelete && (
        <Modal
          title={t('Delete all your saved data?')}
          onClose={() => !deleting && setConfirmDelete(false)}
          footer={
            <>
              <button type="button" className="button button-secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                {t('Cancel')}
              </button>
              <button type="button" className="button button-danger" onClick={deleteAll} disabled={deleting}>
                {deleting && <span className="spinner" aria-hidden="true" />}
                {deleting ? t('Deleting…') : t('Delete everything')}
              </button>
            </>
          }
        >
          <p>
            {t('This permanently deletes your profile, your settings and {saved} from your Google account in {app}. It cannot be undone. Your files in Google Drive are not affected.', {
              saved: tn(state.docs.filter((d) => d.analyzed).length, '{n} saved submission', '{n} saved submissions'),
              app: APP_NAME,
            })}
          </p>
          {error && (
            <p className="form-hint text-bad" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
