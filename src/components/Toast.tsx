import { useEffect, useState } from 'react';
import { useStore } from '../state/store';

export function Toast() {
  const { state } = useStore();
  const [visible, setVisible] = useState<string | null>(null);

  useEffect(() => {
    if (!state.toast) return;
    setVisible(state.toast.message);
    const t = window.setTimeout(() => setVisible(null), 5000);
    return () => window.clearTimeout(t);
  }, [state.toast]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {visible && (
        <div className="toast">
          <span>{visible}</span>
          <button type="button" className="icon-button toast-close" aria-label="Dismiss message" onClick={() => setVisible(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
