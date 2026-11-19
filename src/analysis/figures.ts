// Revisión de tablas, figuras y gráficas: que tengan título numerado ("Table 1", "Figure 1"),
// que se mencionen en el texto y, en las gráficas de Word, que tengan título y ejes con nombre.

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
  const instances = [
    ...missing.map((i) => `${label} in position ${i} has no numbered title (e.g. “${label} ${i}”).`),
    ...notMentioned.map((n) => `${label} ${n} is not mentioned in the text.`),
    ...(outOfOrder ? [`${label} numbers are not in order: ${numbers.join(', ')}.`] : []),
  ];
  const noun = label.toLowerCase();
  const plural = items.length === 1 ? noun : `${noun}s`;
  let outcome: CheckResult['outcome'] = 'passed';
  if (missing.length === items.length) outcome = 'failed';
  else if (instances.length) outcome = 'review';
  const detail =
    outcome === 'passed'
      ? `${items.length} ${plural} found, all with a numbered title and mentioned in the text.`
      : missing.length === items.length
        ? `${items.length} ${plural} found without a numbered title (“${label} 1”).`
        : `${items.length} ${plural} found. ${instances.length} detail${instances.length === 1 ? '' : 's'} to review.`;
  return { id, name, outcome, detail, instances, group: 'figures' };
}

export function runFigureChecks(input: FiguresInput): CheckResult[] {
  const { kind, text } = input;
  if (kind === 'txt' || kind === 'image') {
    return [
      {
        id: 'tablesFigures',
        name: 'Tables & figures',
        outcome: 'na',
        detail: 'Not available for this file type',
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
        name: 'Tables & figures',
        outcome: 'na',
        detail: 'No tables, figures or charts were found in this document.',
        group: 'figures',
      },
    ];
  }
  if (tables.length) out.push(captionCheck('tables', 'Tables', tables, 'Table', text));
  if (figures.length) out.push(captionCheck('figures', 'Figures & charts', figures, 'Figure', text));

  const charts = figures.filter((f) => f.kind === 'chart' && f.chart);
  if (charts.length) {
    const instances: string[] = [];
    charts.forEach((f, i) => {
      const c = f.chart!;
      const label = c.title ? `“${c.title}”` : `Chart ${i + 1}`;
      if (!c.title && !f.caption) instances.push(`${label} (${c.type.toLowerCase()}) has no title.`);
      const needsAxes = !/pie|doughnut/i.test(c.type);
      if (needsAxes && c.axisTitles.length < 2) instances.push(`${label}: axes are not labeled (${c.axisTitles.length} of 2 axis titles).`);
      if (c.series.length > 1 && c.series.some((s) => /^series \d+$/i.test(s.name)))
        instances.push(`${label}: some series still have default names (“Series 1”).`);
    });
    out.push({
      id: 'charts',
      name: 'Charts',
      outcome: instances.length ? 'review' : 'passed',
      detail: instances.length
        ? `${charts.length} chart${charts.length === 1 ? '' : 's'} read from the file. ${instances.length} detail${instances.length === 1 ? '' : 's'} to review.`
        : `${charts.length} chart${charts.length === 1 ? '' : 's'} with title and labeled axes.`,
      instances,
      group: 'figures',
    });
  }
  return out;
}
