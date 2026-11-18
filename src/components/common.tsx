// Componentes pequeños reutilizables: insignias de estado, modal y estado vacío.

import { useEffect, useRef, type ReactNode } from 'react';
import type { AiLevel, CheckOutcome, SimilarityStatus } from '../analysis/types';
import { REVIEW_LABEL, type ReviewStatus } from '../types';
import { Icon, type IconName } from './icons';

const STATUS_LABEL: Record<SimilarityStatus, string> = { clear: 'Clear', review: 'Review', high: 'High match' };
const STATUS_TONE: Record<SimilarityStatus, string> = { clear: 'ok', review: 'warn', high: 'bad' };

export function SimilarityBadge({ status }: { status: SimilarityStatus }) {
  return <span className={`badge badge-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const OUTCOME_LABEL: Record<CheckOutcome, string> = { passed: 'Passed', review: 'Review', failed: 'Failed', na: 'N/A' };
const OUTCOME_TONE: Record<CheckOutcome, string> = { passed: 'ok', review: 'warn', failed: 'bad', na: 'muted' };

export function OutcomeBadge({ outcome }: { outcome: CheckOutcome }) {
  return <span className={`badge badge-${OUTCOME_TONE[outcome]}`}>{OUTCOME_LABEL[outcome]}</span>;
}

const AI_TONE: Record<AiLevel, string> = { Low: 'ok', Moderate: 'warn', Elevated: 'bad' };

export function AiBadge({ level }: { level: AiLevel }) {
  return <span className={`badge badge-${AI_TONE[level]}`}>{level}</span>;
}

const REVIEW_TONE: Record<ReviewStatus, string> = { pending: 'muted', approved: 'ok', 'needs-corrections': 'warn' };

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return <span className={`badge badge-${REVIEW_TONE[status]}`}>{REVIEW_LABEL[status]}</span>;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('textarea, input, select, button:not(.modal-close)');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && ref.current) {
        // Mantiene el foco dentro del modal
        const items = ref.current.querySelectorAll<HTMLElement>('button, textarea, input, select, [href]');
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  actions,
  icon = 'inbox',
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="card empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={30} />
      </span>
      <h2>{title}</h2>
      {children && <div className="empty-text">{children}</div>}
      {actions && <div className="button-row center">{actions}</div>}
    </div>
  );
}

export function percentText(p: number): string {
  return `${Math.round(p)}%`;
}

export function kindLabel(kind: string): string {
  return '.' + kind;
}
