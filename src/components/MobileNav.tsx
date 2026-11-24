// Celular y tableta (menos de 1024 px): barra de pestañas fija abajo, como en las apps móviles.
// En computadora se oculta con CSS. Configuración y la cuenta se abren desde el avatar del encabezado.

import { useEffect } from 'react';
import { t, tk } from '../i18n';
import { useStore, type View } from '../state/store';
import { Icon, type IconName } from './icons';

const TABS: { view: View; label: string; icon: IconName }[] = [
  { view: 'dashboard', label: tk('Dashboard'), icon: 'dashboard' },
  { view: 'upload', label: tk('Upload'), icon: 'upload' },
  { view: 'review', label: tk('Review'), icon: 'review' },
  { view: 'plagiarism', label: tk('Plagiarism'), icon: 'plagiarism' },
  { view: 'ai', label: tk('AI'), icon: 'ai' },
];

// Se busca el contenido principal cuando ya está dibujado (la barra se monta junto con él)
const mainContent = () => document.querySelector<HTMLElement>('.main');

export function MobileNav() {
  const { state, submissions, go } = useStore();
  useTableLabels(mainContent);
  const pending = submissions.filter((d) => d.reviewStatus === 'pending').length;
  return (
    <nav className="mobile-nav" aria-label={t('Main navigation')}>
      {TABS.map((tab) => {
        const active = state.view === tab.view;
        return (
          <button
            key={tab.view}
            type="button"
            className={`mobile-tab${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => go(tab.view)}
          >
            <span className="mobile-tab-icon">
              <Icon name={tab.icon} size={22} />
              {tab.view === 'review' && pending > 0 && (
                <span className="mobile-tab-badge" aria-label={t('{n} pending', { n: pending })}>
                  {pending}
                </span>
              )}
            </span>
            <span className="mobile-tab-label">{t(tab.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * En pantallas angostas las tablas se muestran como tarjetas: cada celda necesita el nombre de su
 * columna (data-label). Se copia del encabezado de la tabla y se actualiza si cambia el contenido
 * o el idioma, para no repetir la etiqueta a mano en cada celda.
 */
export function useTableLabels(root: () => HTMLElement | null) {
  useEffect(() => {
    const el = root();
    if (!el) return;
    let frame = 0;
    const label = () => {
      frame = 0;
      el.querySelectorAll<HTMLTableElement>('table.table').forEach((table) => {
        const heads = [...table.querySelectorAll('thead th')].map((th) => (th.textContent ?? '').trim());
        table.querySelectorAll('tbody tr').forEach((tr) => {
          [...tr.children].forEach((cell, i) => {
            const text = cell.tagName === 'TD' ? heads[i] ?? '' : '';
            if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text);
          });
        });
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(label);
    };
    label();
    const obs = new MutationObserver(schedule);
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root]);
}
