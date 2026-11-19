// Lectura de gráficas nativas de Word (word/charts/chartN.xml): tipo, título, series y valores.

import type { ChartData } from './types';

const TYPE_LABEL: Record<string, string> = {
  'c:barChart': 'Bar chart',
  'c:bar3DChart': 'Bar chart (3D)',
  'c:lineChart': 'Line chart',
  'c:line3DChart': 'Line chart (3D)',
  'c:pieChart': 'Pie chart',
  'c:pie3DChart': 'Pie chart (3D)',
  'c:doughnutChart': 'Doughnut chart',
  'c:areaChart': 'Area chart',
  'c:area3DChart': 'Area chart (3D)',
  'c:scatterChart': 'Scatter chart',
  'c:radarChart': 'Radar chart',
  'c:bubbleChart': 'Bubble chart',
};

function child(el: Element | null | undefined, tag: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) if (c.tagName === tag) return c;
  return null;
}

function richText(el: Element | null): string | null {
  if (!el) return null;
  const parts = Array.from(el.getElementsByTagName('a:t')).map((t) => t.textContent ?? '');
  const txt = parts.join('').trim();
  if (txt) return txt;
  const v = el.getElementsByTagName('c:v')[0]?.textContent?.trim();
  return v || null;
}

function points(el: Element | null): string[] {
  if (!el) return [];
  const pts = Array.from(el.getElementsByTagName('c:pt'));
  const out: string[] = [];
  for (const pt of pts) {
    const idx = Number(pt.getAttribute('idx') ?? out.length);
    out[idx] = child(pt, 'c:v')?.textContent ?? '';
  }
  return Array.from(out, (v) => v ?? '');
}

export function parseChartXml(xml: string): ChartData | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return null;
  const chart = doc.getElementsByTagName('c:chart')[0];
  const plot = doc.getElementsByTagName('c:plotArea')[0];
  if (!chart || !plot) return null;

  const typeEl = Array.from(plot.children).find((c) => c.tagName in TYPE_LABEL);
  let type = typeEl ? TYPE_LABEL[typeEl.tagName] : 'Chart';
  if (typeEl?.tagName === 'c:barChart' || typeEl?.tagName === 'c:bar3DChart') {
    const dir = child(typeEl, 'c:barDir')?.getAttribute('val');
    if (dir === 'col') type = type.replace('Bar', 'Column');
  }

  const deleted = child(chart, 'c:autoTitleDeleted')?.getAttribute('val') === '1';
  let title = richText(child(chart, 'c:title'));

  const series: ChartData['series'] = [];
  let categories: string[] = [];
  for (const ser of Array.from(plot.getElementsByTagName('c:ser'))) {
    const name = richText(child(ser, 'c:tx')) ?? `Series ${series.length + 1}`;
    const cats = points(child(ser, 'c:cat') ?? child(ser, 'c:xVal'));
    if (cats.length > categories.length) categories = cats;
    const values = points(child(ser, 'c:val') ?? child(ser, 'c:yVal')).map((v) => Number(v));
    series.push({ name, values });
  }
  // Word muestra el nombre de la única serie como título automático
  if (!title && !deleted && series.length === 1 && child(chart, 'c:title')) title = series[0].name;

  const axisTitles: string[] = [];
  for (const tag of ['c:catAx', 'c:valAx', 'c:dateAx', 'c:serAx']) {
    for (const ax of Array.from(plot.getElementsByTagName(tag))) {
      const t = richText(child(ax, 'c:title'));
      if (t) axisTitles.push(t);
    }
  }

  return { type, title, categories, series, axisTitles };
}
