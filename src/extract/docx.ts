// Lectura de .docx: texto por párrafo y propiedades de formato efectivas.
// Lee word/document.xml, word/styles.xml y word/theme/theme1.xml (fuentes del tema).
// Herencia: docDefaults → estilo de párrafo (basedOn) → pPr directo → estilo de carácter → rPr directo.

import JSZip from 'jszip';
import type { Alignment } from '../settings';
import type { DocxFormat } from './types';

interface FontRef {
  name?: string;
  theme?: string;
}
interface RProps {
  font?: FontRef;
  sizeHalfPt?: number;
}
interface PProps {
  jc?: string;
  line?: number;
  lineRule?: string;
}
interface StyleDef {
  id: string;
  name: string;
  basedOn?: string;
  r: RProps;
  p: PProps;
}

function child(el: Element | null | undefined, tag: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) if (c.tagName === tag) return c;
  return null;
}

function hasAncestor(el: Element, tag: string, stopAt?: Element): boolean {
  let cur = el.parentElement;
  while (cur && cur !== stopAt) {
    if (cur.tagName === tag) return true;
    cur = cur.parentElement;
  }
  return false;
}

function closest(el: Element, tag: string): Element | null {
  let cur = el.parentElement;
  while (cur) {
    if (cur.tagName === tag) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function readRProps(rPr: Element | null): RProps {
  const out: RProps = {};
  if (!rPr) return out;
  const f = child(rPr, 'w:rFonts');
  if (f) {
    const theme = f.getAttribute('w:asciiTheme') ?? f.getAttribute('w:hAnsiTheme');
    const name = f.getAttribute('w:ascii') ?? f.getAttribute('w:hAnsi');
    if (theme) out.font = { theme };
    else if (name) out.font = { name };
  }
  const sz = child(rPr, 'w:sz')?.getAttribute('w:val');
  if (sz && !Number.isNaN(Number(sz))) out.sizeHalfPt = Number(sz);
  return out;
}

function readPProps(pPr: Element | null): PProps {
  const out: PProps = {};
  if (!pPr) return out;
  const jc = child(pPr, 'w:jc')?.getAttribute('w:val');
  if (jc) out.jc = jc;
  const sp = child(pPr, 'w:spacing');
  const line = sp?.getAttribute('w:line');
  if (line && !Number.isNaN(Number(line))) {
    out.line = Number(line);
    out.lineRule = sp?.getAttribute('w:lineRule') ?? 'auto';
  }
  return out;
}

function mergeR(a: RProps, b: RProps): RProps {
  return { font: b.font ?? a.font, sizeHalfPt: b.sizeHalfPt ?? a.sizeHalfPt };
}
function mergeP(a: PProps, b: PProps): PProps {
  return {
    jc: b.jc ?? a.jc,
    line: b.line ?? a.line,
    lineRule: b.line !== undefined ? b.lineRule : a.lineRule,
  };
}

function normalizeAlignment(jc: string | undefined): Alignment {
  switch (jc) {
    case 'center':
      return 'center';
    case 'right':
    case 'end':
      return 'right';
    case 'both':
    case 'distribute':
    case 'justify':
      return 'justify';
    default:
      return 'left';
  }
}

class Tally {
  private m = new Map<string, number>();
  add(key: string, w: number) {
    if (w > 0) this.m.set(key, (this.m.get(key) ?? 0) + w);
  }
  top(): { key: string; share: number } | null {
    let total = 0;
    let best: [string, number] | null = null;
    for (const [k, v] of this.m) {
      total += v;
      if (!best || v > best[1]) best = [k, v];
    }
    return best ? { key: best[0], share: best[1] / total } : null;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseDocxXml(
  documentXml: string,
  stylesXml: string | null,
  themeXml: string | null,
): { paragraphs: string[]; format: DocxFormat } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The .docx file is damaged (invalid document.xml).');

  // Fuentes del tema
  const themeFonts: { major?: string; minor?: string } = {};
  if (themeXml) {
    const theme = parser.parseFromString(themeXml, 'application/xml');
    themeFonts.major = child(theme.getElementsByTagName('a:majorFont')[0], 'a:latin')?.getAttribute('typeface') ?? undefined;
    themeFonts.minor = child(theme.getElementsByTagName('a:minorFont')[0], 'a:latin')?.getAttribute('typeface') ?? undefined;
  }
  const fontName = (f: FontRef | undefined): string | null => {
    if (!f) return null;
    if (f.name) return f.name;
    if (f.theme?.startsWith('major')) return themeFonts.major ?? null;
    if (f.theme?.startsWith('minor')) return themeFonts.minor ?? null;
    return null;
  };

  // Estilos y valores por defecto
  let defaults: { r: RProps; p: PProps } = { r: {}, p: {} };
  const styles = new Map<string, StyleDef>();
  let defaultParaStyle: string | undefined;
  let defaultCharStyle: string | undefined;
  if (stylesXml) {
    const st = parser.parseFromString(stylesXml, 'application/xml');
    const dd = st.getElementsByTagName('w:docDefaults')[0];
    defaults = {
      r: readRProps(child(child(dd, 'w:rPrDefault'), 'w:rPr')),
      p: readPProps(child(child(dd, 'w:pPrDefault'), 'w:pPr')),
    };
    for (const s of Array.from(st.getElementsByTagName('w:style'))) {
      const id = s.getAttribute('w:styleId');
      if (!id) continue;
      const type = s.getAttribute('w:type');
      const isDefault = s.getAttribute('w:default') === '1' || s.getAttribute('w:default') === 'true';
      if (isDefault && type === 'paragraph') defaultParaStyle = id;
      if (isDefault && type === 'character') defaultCharStyle = id;
      styles.set(id, {
        id,
        name: child(s, 'w:name')?.getAttribute('w:val') ?? id,
        basedOn: child(s, 'w:basedOn')?.getAttribute('w:val') ?? undefined,
        r: readRProps(child(s, 'w:rPr')),
        p: readPProps(child(s, 'w:pPr')),
      });
    }
  }

  const resolved = new Map<string, { r: RProps; p: PProps; names: string[] }>();
  const resolve = (id: string | undefined, depth = 0): { r: RProps; p: PProps; names: string[] } => {
    if (!id || depth > 20) return { r: {}, p: {}, names: [] };
    const cached = resolved.get(id);
    if (cached) return cached;
    const s = styles.get(id);
    if (!s) return { r: {}, p: {}, names: [] };
    const base = resolve(s.basedOn, depth + 1);
    const out = { r: mergeR(base.r, s.r), p: mergeP(base.p, s.p), names: [...base.names, s.name, s.id] };
    resolved.set(id, out);
    return out;
  };

  const body = doc.getElementsByTagName('w:body')[0];
  if (!body) throw new Error('The .docx file has no document body.');

  const paragraphs: string[] = [];
  const fonts = new Tally();
  const sizes = new Tally();
  const spacing = new Tally();
  const alignAll = new Tally();
  const alignBody = new Tally();
  let hasTitleStyle = false;

  for (const p of Array.from(body.getElementsByTagName('w:p'))) {
    if (hasAncestor(p, 'mc:Fallback') || hasAncestor(p, 'w:del')) continue;
    const pPr = child(p, 'w:pPr');
    const styleId = child(pPr, 'w:pStyle')?.getAttribute('w:val') ?? defaultParaStyle;
    const pStyle = resolve(styleId);
    const pp = mergeP(mergeP(defaults.p, pStyle.p), readPProps(pPr));
    const baseR = mergeR(defaults.r, pStyle.r);

    let text = '';
    for (const r of Array.from(p.getElementsByTagName('w:r'))) {
      if (closest(r, 'w:p') !== p) continue; // runs de cuadros de texto anidados
      if (hasAncestor(r, 'w:del', p) || hasAncestor(r, 'mc:Fallback', p)) continue;
      let runText = '';
      for (const c of Array.from(r.children)) {
        if (c.tagName === 'w:t') runText += c.textContent ?? '';
        else if (c.tagName === 'w:tab') runText += '\t';
        else if (c.tagName === 'w:br' || c.tagName === 'w:cr') runText += '\n';
      }
      if (!runText) continue;
      text += runText;
      const rPr = child(r, 'w:rPr');
      const rStyleId = child(rPr, 'w:rStyle')?.getAttribute('w:val') ?? defaultCharStyle;
      const rp = mergeR(mergeR(baseR, resolve(rStyleId).r), readRProps(rPr));
      const weight = runText.replace(/\s/g, '').length;
      fonts.add(fontName(rp.font) ?? 'Times New Roman', weight);
      sizes.add(String((rp.sizeHalfPt ?? 20) / 2), weight);
    }

    const trimmed = text.trim();
    if (!trimmed) continue;
    paragraphs.push(trimmed);

    const chars = trimmed.replace(/\s/g, '').length;
    const rule = pp.lineRule ?? 'auto';
    const line = pp.line ?? 240;
    spacing.add(rule === 'auto' ? `m:${round2(line / 240)}` : `x:${round2(line / 20)}`, chars);

    const align = normalizeAlignment(pp.jc);
    alignAll.add(align, 1);
    if (trimmed.split(/\s+/).length >= 8) alignBody.add(align, 1);

    if (pStyle.names.some((n) => /^(title|heading ?1)$/i.test(n))) hasTitleStyle = true;
  }

  // Márgenes de la última sección
  const sects = body.getElementsByTagName('w:sectPr');
  const pgMar = child(sects[sects.length - 1], 'w:pgMar');
  const twipsToCm = (v: string | null) => round2((Math.abs(Number(v ?? 0)) / 1440) * 2.54);
  const marginsCm = pgMar
    ? {
        top: twipsToCm(pgMar.getAttribute('w:top')),
        right: twipsToCm(pgMar.getAttribute('w:right')),
        bottom: twipsToCm(pgMar.getAttribute('w:bottom')),
        left: twipsToCm(pgMar.getAttribute('w:left')),
      }
    : null;

  const font = fonts.top();
  const size = sizes.top();
  const sp = spacing.top();
  const al = alignBody.top() ?? alignAll.top();

  return {
    paragraphs,
    format: {
      font: font?.key ?? null,
      fontShare: font?.share ?? 0,
      fontSizePt: size ? Number(size.key) : null,
      fontSizeShare: size?.share ?? 0,
      lineSpacing: sp?.key.startsWith('m:') ? Number(sp.key.slice(2)) : null,
      lineSpacingShare: sp?.share ?? 0,
      lineSpacingExactPt: sp?.key.startsWith('x:') ? Number(sp.key.slice(2)) : null,
      alignment: (al?.key as Alignment) ?? null,
      alignmentShare: al?.share ?? 0,
      marginsCm,
      hasTitleStyle,
    },
  };
}

export async function readDocx(buffer: ArrayBuffer): Promise<{ paragraphs: string[]; format: DocxFormat }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('This file is not a valid .docx document.');
  }
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('This .docx file has no word/document.xml.');
  const stylesXml = (await zip.file('word/styles.xml')?.async('string')) ?? null;
  const themeXml = (await zip.file('word/theme/theme1.xml')?.async('string')) ?? null;
  return parseDocxXml(documentXml, stylesXml, themeXml);
}
