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
import { Welcome } from './components/Welcome';
import { StoreProvider, useStore } from './state/store';

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
  if (!state.profile) {
    return (
      <div className="app app-welcome">
        <Welcome />
      </div>
    );
  }
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <main className="content" id="main-content">
          {/* La key reinicia la transición suave al cambiar de pantalla */}
          <div className="view-transition" key={state.view}>
            <ErrorBoundary onHome={() => go('dashboard')}>
              <CurrentView />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <div className="desktop-only" role="alert">
        <div>
          <p className="desktop-only-brand">Assistant Helper</p>
          <p>Assistant Helper is available on desktop computers only.</p>
        </div>
      </div>
      <Shell />
    </StoreProvider>
  );
}
