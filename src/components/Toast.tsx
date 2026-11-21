import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { useStore } from '../state/store';
import { Icon } from './icons';

const DURATION = 5000;

export function Toast() {
  const { state } = useStore();
  const [visible, setVisible] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    if (!state.toast) return;
    setVisible(state.toast);
    const t = window.setTimeout(() => setVisible(null), DURATION);
    return () => window.clearTimeout(t);
  }, [state.toast]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {visible && (
        <div className="toast" key={visible.id}>
          <span className="toast-icon">
            <Icon name="check" size={18} />
          </span>
          <span className="toast-text">{visible.message}</span>
          <button type="button" className="icon-button toast-close" aria-label={t('Dismiss message')} onClick={() => setVisible(null)}>
            ×
          </button>
          <span className="toast-timer" style={{ animationDuration: `${DURATION}ms` }} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
