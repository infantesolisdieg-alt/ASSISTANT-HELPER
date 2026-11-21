// Revisa que cada texto que pasa por t('...') o tn(n, '...', '...') tenga traducción al español.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ES } from './es';
import { setLang, t, tn } from './index';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.includes('i18n') ? [p] : [];
  });
}

/** Lee el contenido de un literal '...' o "..." (sin plantillas ${}). */
function literals(src: string): string[] {
  const out: string[] = [];
  // t('…') / tk('…') / tIn(lang, '…') / tn(n, '…', '…')
  const re = /(?<![\w.:$])(?:t|tk|tRich|tIn\([^,]+,|tn\([^,]+,)\s*\(?\s*(['"])((?:\\.|(?!\1).)*)\1(?:\s*,\s*(['"])((?:\\.|(?!\3).)*)\3)?/g;
  for (const m of src.matchAll(re)) {
    out.push(m[2]);
    if (m[4] !== undefined) out.push(m[4]);
  }
  return out.map((s) => s.replace(/\\(['"\\])/g, '$1'));
}

describe('i18n', () => {
  it('every interface text has a Spanish translation', () => {
    const missing = new Set<string>();
    for (const f of files(join(__dirname, '..'))) {
      for (const s of literals(readFileSync(f, 'utf8'))) if (!(s in ES)) missing.add(s);
    }
    expect([...missing]).toEqual([]);
  });

  it('translates, fills variables and picks the plural form', () => {
    setLang('es');
    expect(t('Upload')).toBe(ES['Upload']);
    expect(tn(1, '{n} file', '{n} files')).toBe(ES['{n} file'].replace('{n}', '1'));
    expect(tn(3, '{n} file', '{n} files')).toBe(ES['{n} files'].replace('{n}', '3'));
    setLang('en');
    expect(t('{n} files', { n: 2 })).toBe('2 files');
  });

  it('the Spanish texts keep the same {variables}', () => {
    const bad = Object.entries(ES).filter(([en, es]) => {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      return vars(en) !== vars(es);
    });
    expect(bad).toEqual([]);
  });
});
