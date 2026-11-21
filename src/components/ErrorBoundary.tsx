// Si una pantalla falla, se muestra un aviso con opción de reintentar en vez de dejar la app en blanco.

import { Component, type ReactNode } from 'react';
import { APP_NAME, t } from '../i18n';

interface Props {
  children: ReactNode;
  onHome?: () => void;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(APP_NAME + ' screen error:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card empty-state" role="alert">
        <h2>{t('Something went wrong on this screen')}</h2>
        <p className="empty-text">{t('Your files and results are still in this session. Try again, or go back to the Dashboard.')}</p>
        <div className="button-row center">
          <button type="button" className="button button-primary" onClick={() => this.setState({ error: null })}>
            {t('Try again')}
          </button>
          {this.props.onHome && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                this.setState({ error: null });
                this.props.onHome?.();
              }}
            >
              {t('Go to Dashboard')}
            </button>
          )}
        </div>
      </div>
    );
  }
}
