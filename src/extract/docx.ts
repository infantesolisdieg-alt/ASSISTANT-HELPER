// Lectura de .docx: texto por párrafo, formato efectivo, y la estructura del documento
// (párrafos, tablas, imágenes y gráficas en orden) para mostrarlo como el original.
// Lee word/document.xml, word/styles.xml, word/theme/theme1.xml, las relaciones y los medios.
// Herencia de formato: docDefaults → estilo de párrafo (basedOn) → pPr directo → estilo de carácter → rPr directo.

import JSZip from 'jszip';
import type { Alignment } from '../settings';
import { parseChartXml } from './chart';
import type { DocBlock, DocxFormat, ExtractedFile, FigureInfo, TableInfo } from './types';

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

/** Referencia a una imagen o gráfica del documento (se resuelve con las relaciones). */
export interface FigureRef {
  kind: 'image' | 'chart';
  rId: string;
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
const TABLE_CAPTION = /^table\s+\d+/i;
const FIGURE_CAPTION = /^(figure|fig\.?|chart|graph)\s*\d+/i;

export function parseDocxXml(
  documentXml: string,
  stylesXml: string | null,
  themeXml: string | null,
): {
  paragraphs: string[];
  format: DocxFormat;
  blocks: DocBlock[];
  tables: TableInfo[];
  figures: (FigureInfo & { ref: FigureRef })[];
} {
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
  const blocks: DocBlock[] = [];
  const tables: TableInfo[] = [];
  const figures: (FigureInfo & { ref: FigureRef })[] = [];
  const fonts = new Tally();
  const sizes = new Tally();
  const spacing = new Tally();
  const alignAll = new Tally();
  const alignBody = new Tally();
  let hasTitleStyle = false;

  /** Procesa un párrafo. Devuelve el índice del párrafo (o null si no tiene texto) y sus figuras. */
  const handleParagraph = (
    p: Element,
    inTable: boolean,
  ): { index: number | null; style: 'title' | 'heading' | 'caption' | 'normal'; align: Alignment; figs: number[] } => {
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

    // Imágenes y gráficas dentro del párrafo
    const figs: number[] = [];
    for (const g of Array.from(p.getElementsByTagName('a:graphicData'))) {
      if (hasAncestor(g, 'mc:Fallback', p)) continue;
      const chartEl = g.getElementsByTagName('c:chart')[0];
      const blip = g.getElementsByTagName('a:blip')[0];
      const rId = chartEl?.getAttribute('r:id') ?? blip?.getAttribute('r:embed');
      if (!rId) continue;
      figures.push({ kind: chartEl ? 'chart' : 'image', caption: null, ref: { kind: chartEl ? 'chart' : 'image', rId } });
      figs.push(figures.length - 1);
    }

    // Si el estilo no está definido en styles.xml, se usa su id ("Title", "Heading1")
    const names = [...pStyle.names, styleId ?? ''].map((n) => n.toLowerCase());
    const style: 'title' | 'heading' | 'caption' | 'normal' = names.some((n) => n === 'title')
      ? 'title'
      : names.some((n) => /^heading ?\d$/.test(n))
        ? 'heading'
        : names.some((n) => n === 'caption')
          ? 'caption'
          : 'normal';
    const align = normalizeAlignment(pp.jc);
    const trimmed = text.trim();
    if (!trimmed) return { index: null, style, align, figs };

    paragraphs.push(trimmed);
    const chars = trimmed.replace(/\s/g, '').length;
    const rule = pp.lineRule ?? 'auto';
    const line = pp.line ?? 240;
    if (!inTable) {
      spacing.add(rule === 'auto' ? `m:${round2(line / 240)}` : `x:${round2(line / 20)}`, chars);
      alignAll.add(align, 1);
      if (trimmed.split(/\s+/).length >= 8) alignBody.add(align, 1);
    }
    if (names.some((n) => /^(title|heading ?1)$/i.test(n))) hasTitleStyle = true;
    return { index: paragraphs.length - 1, style, align, figs };
  };

  // Recorre el cuerpo en orden: párrafos, tablas y controles de contenido
  const walk = (node: Element) => {
    for (const el of Array.from(node.children)) {
      if (el.tagName === 'w:p') {
        const r = handleParagraph(el, false);
        if (r.index !== null) blocks.push({ type: 'p', para: r.index, style: r.style, align: r.align });
        for (const f of r.figs) blocks.push({ type: 'figure', figure: f });
      } else if (el.tagName === 'w:tbl') {
        const rows: number[][][] = [];
        const textRows: string[][] = [];
        for (const tr of Array.from(el.children).filter((c) => c.tagName === 'w:tr')) {
          const cells: number[][] = [];
          const textCells: string[] = [];
          for (const tc of Array.from(tr.children).filter((c) => c.tagName === 'w:tc')) {
            const paras: number[] = [];
            for (const p of Array.from(tc.getElementsByTagName('w:p'))) {
              if (hasAncestor(p, 'mc:Fallback', tc)) continue;
              const r = handleParagraph(p, true);
              if (r.index !== null) paras.push(r.index);
            }
            cells.push(paras);
            textCells.push(paras.map((i) => paragraphs[i]).join(' '));
          }
          rows.push(cells);
          textRows.push(textCells);
        }
        tables.push({ rows: textRows, caption: null });
        blocks.push({ type: 'table', table: tables.length - 1, rows });
      } else if (el.tagName === 'w:sdt') {
        const content = child(el, 'w:sdtContent');
        if (content) walk(content);
      } else if (el.tagName === 'mc:AlternateContent') {
        const choice = child(el, 'mc:Choice');
        if (choice) walk(choice);
      }
    }
  };
  walk(body);

  // Títulos de tablas (normalmente arriba) y de figuras (normalmente abajo)
  const paraText = (b: DocBlock | undefined) => (b && b.type === 'p' ? paragraphs[b.para] : null);
  const near = (k: number, order: number[], re: RegExp): string | null => {
    for (const d of order) {
      const t = paraText(blocks[k + d]);
      if (t && re.test(t.trim())) return t.trim().split('\n')[0];
    }
    return null;
  };
  blocks.forEach((b, k) => {
    if (b.type === 'table') tables[b.table].caption = near(k, [-1, -2, 1], TABLE_CAPTION);
    if (b.type === 'figure') figures[b.figure].caption = near(k, [1, 2, -1, -2], FIGURE_CAPTION);
  });

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
    blocks,
    tables,
    figures,
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

/** Relaciones del documento: rId → ruta dentro del .docx (por ejemplo "word/media/image1.png"). */
export function parseRels(relsXml: string): Map<string, string> {
  const doc = new DOMParser().parseFromString(relsXml, 'application/xml');
  const map = new Map<string, string>();
  for (const r of Array.from(doc.getElementsByTagName('Relationship'))) {
    const id = r.getAttribute('Id');
    const target = r.getAttribute('Target');
    if (!id || !target || r.getAttribute('TargetMode') === 'External') continue;
    const clean = target.replace(/^\.?\//, '');
    map.set(id, clean.startsWith('word/') ? clean : `word/${clean}`);
  }
  return map;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export async function readDocx(buffer: ArrayBuffer): Promise<ExtractedFile> {
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
  const relsXml = (await zip.file('word/_rels/document.xml.rels')?.async('string')) ?? null;
  const parsed = parseDocxXml(documentXml, stylesXml, themeXml);
  const rels = relsXml ? parseRels(relsXml) : new Map<string, string>();

  const figures: FigureInfo[] = [];
  for (const f of parsed.figures) {
    const { ref, ...info } = f;
    const path = rels.get(ref.rId);
    const entry = path ? zip.file(path) : null;
    if (entry && ref.kind === 'image') {
      const ext = path!.split('.').pop()?.toLowerCase() ?? '';
      // Los formatos que el navegador no puede mostrar (EMF/WMF) se listan sin vista previa
      if (MIME[ext]) {
        const blob = new Blob([await entry.async('arraybuffer')], { type: MIME[ext] });
        info.src = URL.createObjectURL(blob);
      }
    } else if (entry && ref.kind === 'chart') {
      info.chart = parseChartXml(await entry.async('string')) ?? undefined;
    }
    figures.push(info);
  }

  return {
    kind: 'docx',
    paragraphs: parsed.paragraphs,
    docxFormat: parsed.format,
    blocks: parsed.blocks,
    tables: parsed.tables,
    figures,
  };
}
