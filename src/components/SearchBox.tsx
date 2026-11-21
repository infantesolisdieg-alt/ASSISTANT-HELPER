// Caja de búsqueda con botón para limpiar y atajo de teclado "/" para enfocarla.

import { useEffect, useRef } from 'react';
import { t } from '../i18n';

export function SearchBox({
  id,
  value,
  onChange,
  placeholder,
  label,
  shortcut = false,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  /** Si es true, la tecla "/" enfoca la búsqueda (como en muchos sitios). */
  shortcut?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing && !document.querySelector('.modal')) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);

  return (
    <div className="searchbox">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="searchbox-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
      </span>
      <input
        ref={ref}
        id={id}
        type="search"
        className="input searchbox-input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            onChange('');
          }
        }}
      />
      {value ? (
        <button type="button" className="icon-button searchbox-clear" aria-label={t('Clear search')} onClick={() => onChange('')}>
          ×
        </button>
      ) : (
        shortcut && (
          <kbd className="searchbox-kbd" aria-hidden="true">
            /
          </kbd>
        )
      )}
    </div>
  );
}

/** Quita acentos y mayúsculas para buscar "gomez" y encontrar "Gómez". */
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** ¿Todos los términos de la búsqueda aparecen en alguno de los campos? */
export function matchesSearch(query: string, fields: (string | undefined)[]): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const hay = normalizeSearch(fields.filter(Boolean).join(' '));
  return terms.every((t) => hay.includes(t));
}

/** Resalta en el texto las partes que coinciden con la búsqueda. */
export function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return <>{text}</>;
  // Misma normalización pero sin recortar espacios, para que las posiciones coincidan con el texto
  const norm = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (norm.length !== text.length) return <>{text}</>;
  const marks: [number, number][] = [];
  for (const t of terms) {
    let i = norm.indexOf(t);
    while (i >= 0) {
      marks.push([i, i + t.length]);
      i = norm.indexOf(t, i + t.length);
    }
  }
  if (!marks.length) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  marks.forEach(([s, e], k) => {
    if (s < pos) return;
    if (s > pos) out.push(text.slice(pos, s));
    out.push(
      <mark key={k} className="search-hit">
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  out.push(text.slice(pos));
  return <>{out}</>;
}

