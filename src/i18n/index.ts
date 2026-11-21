// Idioma de la interfaz (inglés o español). El texto en inglés es la clave: t('Upload') devuelve
// "Subir" cuando el idioma es español. Las traducciones están en es.ts; la prueba i18n.test.ts
// revisa que cada t('...') del código tenga su traducción.
//
// El nombre de la app nunca se traduce y siempre va en mayúsculas: APP_NAME.

import { ES } from './es';

export type Lang = 'en' | 'es';
export const APP_NAME = 'ASSISTANT HELPER';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

let current: Lang = 'en';
const missing = new Set<string>();

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function getLang(): Lang {
  return current;
}

/** Idioma del navegador para la primera visita. */
export function browserLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  return (navigator.languages?.[0] ?? navigator.language ?? 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
}

type Vars = Record<string, string | number>;

function fill(s: string, vars?: Vars): string {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Traduce en un idioma concreto (la bienvenida alterna entre los dos). */
export function tIn(lang: Lang, en: string, vars?: Vars): string {
  if (lang === 'en') return fill(en, vars);
  const es = ES[en];
  if (es === undefined && import.meta.env.DEV && !missing.has(en)) {
    missing.add(en);
    console.warn('[i18n] Missing Spanish text:', en);
  }
  return fill(es ?? en, vars);
}

/** Traduce al idioma actual. Las variables van entre llaves: t('{n} files', { n: 3 }). */
export function t(en: string, vars?: Vars): string {
  return tIn(current, en, vars);
}

/** Marca un texto fijo (listas, menús) para traducirlo después con t(texto). No traduce. */
export function tk<T extends string>(en: T): T {
  return en;
}

/** Singular o plural según n: tn(n, '{n} file', '{n} files'). */
export function tn(n: number, one: string, other: string, vars?: Vars): string {
  return t(n === 1 ? one : other, { n, ...vars });
}

/** Configuración regional para fechas y números. */
export function locale(): string {
  return current === 'es' ? 'es-MX' : 'en-US';
}

/** Textos sin traducción vistos en esta sesión (para revisar en el navegador). */
export function missingTexts(): string[] {
  return [...missing];
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __i18nMissing: () => string[] }).__i18nMissing = missingTexts;
}
