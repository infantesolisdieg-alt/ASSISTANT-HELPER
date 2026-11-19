// Si una pantalla falla, se muestra un aviso con opción de reintentar en vez de dejar la app en blanco.

import { Component, type ReactNode } from 'react';

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
    console.error('Assistant Helper screen error:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card empty-state" role="alert">
        <h2>Something went wrong on this screen</h2>
        <p className="empty-text">Your files and results are still in this session. Try again, or go back to the Dashboard.</p>
        <div className="button-row center">
          <button type="button" className="button button-primary" onClick={() => this.setState({ error: null })}>
            Try again
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
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }
}
