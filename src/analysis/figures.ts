// Revisión de tablas, figuras y gráficas: que tengan título numerado ("Table 1", "Figure 1"),
// que se mencionen en el texto y, en las gráficas de Word, que tengan título y ejes con nombre.

import { t, tn } from '../i18n';
import type { FigureInfo, FileKind, TableInfo } from '../extract/types';
import type { CheckResult } from './types';

export interface FiguresInput {
  kind: FileKind;
  text: string;
  tables?: TableInfo[];
  figures?: FigureInfo[];
}

const numberOf = (caption: string | null, re: RegExp) => {
  const m = caption?.match(re);
  return m ? Number(m[1]) : null;
};

/** ¿El texto menciona "Table 2" / "Figure 2" fuera de su propio título? */
function mentioned(text: string, label: 'Table' | 'Figure', n: number): boolean {
  const re =
    label === 'Table'
      ? new RegExp(`\\btable\\s+${n}\\b`, 'gi')
      : new RegExp(`\\b(figure|fig\\.?)\\s*${n}\\b`, 'gi');
  return (text.match(re)?.length ?? 0) >= 2;
}

function captionCheck(
  id: string,
  name: string,
  items: { caption: string | null }[],
  label: 'Table' | 'Figure',
  text: string,
): CheckResult {
  const re = label === 'Table' ? /^table\s+(\d+)/i : /^(?:figure|fig\.?|chart|graph)\s*(\d+)/i;
  const missing: number[] = [];
  const notMentioned: number[] = [];
  const numbers: number[] = [];
  items.forEach((it, i) => {
    const n = numberOf(it.caption, re);
    if (n === null) missing.push(i + 1);
    else {
      numbers.push(n);
      if (!mentioned(text, label, n)) notMentioned.push(n);
    }
  });
  const outOfOrder = numbers.some((n, i) => i > 0 && n <= numbers[i - 1]);
  // Los títulos de ejemplo ("Table 1") van en inglés: es el idioma del documento del alumno
  const isTable = label === 'Table';
  const instances = [
    ...missing.map((i) =>
      isTable
        ? t('Table in position {i} has no numbered title (e.g. “Table {i}”).', { i })
        : t('Figure in position {i} has no numbered title (e.g. “Figure {i}”).', { i }),
    ),
    ...notMentioned.map((n) => (isTable ? t('Table {n} is not mentioned in the text.', { n }) : t('Figure {n} is not mentioned in the text.', { n }))),
    ...(outOfOrder
      ? [isTable ? t('Table numbers are not in order: {list}.', { list: numbers.join(', ') }) : t('Figure numbers are not in order: {list}.', { list: numbers.join(', ') })]
      : []),
  ];
  let outcome: CheckResult['outcome'] = 'passed';
  if (missing.length === items.length) outcome = 'failed';
  else if (instances.length) outcome = 'review';
  const found = isTable
    ? tn(items.length, '{n} table found', '{n} tables found')
    : tn(items.length, '{n} figure found', '{n} figures found');
  const detail =
    outcome === 'passed'
      ? t('{found}, all with a numbered title and mentioned in the text.', { found })
      : missing.length === items.length
        ? isTable
          ? t('{found} without a numbered title (“Table 1”).', { found })
          : t('{found} without a numbered title (“Figure 1”).', { found })
        : `${t('{found}.', { found })} ${tn(instances.length, '{n} detail to review.', '{n} details to review.')}`;
  return { id, name, outcome, detail, instances, group: 'figures' };
}

export function runFigureChecks(input: FiguresInput): CheckResult[] {
  const { kind, text } = input;
  if (kind === 'txt' || kind === 'image') {
    return [
      {
        id: 'tablesFigures',
        name: t('Tables & figures'),
        outcome: 'na',
        detail: t('Not available for this file type'),
        group: 'figures',
      },
    ];
  }
  const tables = input.tables ?? [];
  const figures = input.figures ?? [];
  const out: CheckResult[] = [];

  if (!tables.length && !figures.length) {
    return [
      {
        id: 'tablesFigures',
        name: t('Tables & figures'),
        outcome: 'na',
        detail: t('No tables, figures or charts were found in this document.'),
        group: 'figures',
      },
    ];
  }
  if (tables.length) out.push(captionCheck('tables', t('Tables'), tables, 'Table', text));
  if (figures.length) out.push(captionCheck('figures', t('Figures & charts'), figures, 'Figure', text));

  const charts = figures.filter((f) => f.kind === 'chart' && f.chart);
  if (charts.length) {
    const instances: string[] = [];
    charts.forEach((f, i) => {
      const c = f.chart!;
      const label = c.title ? `“${c.title}”` : t('Chart {n}', { n: i + 1 });
      if (!c.title && !f.caption) instances.push(t('{label} ({type}) has no title.', { label, type: t(c.type).toLowerCase() }));
      const needsAxes = !/pie|doughnut/i.test(c.type);
      if (needsAxes && c.axisTitles.length < 2)
        instances.push(t('{label}: axes are not labeled ({count} of 2 axis titles).', { label, count: c.axisTitles.length }));
      if (c.series.length > 1 && c.series.some((s) => /^(series|serie) \d+$/i.test(s.name)))
        instances.push(t('{label}: some series still have default names (“Series 1”).', { label }));
    });
    out.push({
      id: 'charts',
      name: t('Charts'),
      outcome: instances.length ? 'review' : 'passed',
      detail: instances.length
        ? `${tn(charts.length, '{n} chart read from the file.', '{n} charts read from the file.')} ${tn(instances.length, '{n} detail to review.', '{n} details to review.')}`
        : tn(charts.length, '{n} chart with title and labeled axes.', '{n} charts with title and labeled axes.'),
      instances,
      group: 'figures',
    });
  }
  return out;
}
