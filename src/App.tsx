import { AiIndicators } from './components/AiIndicators';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Plagiarism } from './components/Plagiarism';
import { Review } from './components/Review';
import { SettingsScreen } from './components/SettingsScreen';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { Topbar } from './components/Topbar';
import { Upload } from './components/Upload';
import { MobileNav } from './components/MobileNav';
import { TermsGate } from './components/Terms';
import { Welcome } from './components/Welcome';
import { CloudSync } from './cloud/CloudSync';
import { StoreProvider, useStore } from './state/store';
import { TERMS_VERSION } from './terms';
import { useEffect, useState } from 'react';
import { t } from './i18n';

function CurrentView() {
  const { state } = useStore();
  switch (state.view) {
    case 'dashboard':
      return <Dashboard />;
    case 'upload':
      return <Upload />;
    case 'review':
      return <Review />;
    case 'plagiarism':
      return <Plagiarism />;
    case 'ai':
      return <AiIndicators />;
    case 'settings':
      return <SettingsScreen />;
  }
}

function Shell() {
  const { state, go } = useStore();
  // Celular: la barra lateral se abre como panel desde el avatar del encabezado
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [state.view]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  if (state.auth === 'checking' || state.cloud.state === 'loading') {
    return (
      <div className="app app-welcome">
        <div className="splash" role="status">
          <img src="/logo-mark.svg" alt="" width="72" height="72" className="splash-logo" />
          <p>{state.auth === 'checking' ? t('Checking your account…') : t('Loading your saved work…')}</p>
        </div>
      </div>
    );
  }
  if (!state.profile) {
    return (
      <div className="app app-welcome">
        <Welcome />
      </div>
    );
  }
  if (state.profile.termsVersion !== TERMS_VERSION) {
    // Cuenta que todavía no aceptó la versión actual de los términos
    return (
      <div className="app app-welcome">
        <TermsGate />
      </div>
    );
  }
  return (
    <div className={`app${menuOpen ? ' menu-open' : ''}`}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="content" id="main-content">
          {/* La key reinicia la transición suave al cambiar de pantalla */}
          <div className="view-transition" key={state.view}>
            <ErrorBoundary onHome={() => go('dashboard')}>
              <CurrentView />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <MobileNav />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <CloudSync />
      <Shell />
    </StoreProvider>
  );
}
