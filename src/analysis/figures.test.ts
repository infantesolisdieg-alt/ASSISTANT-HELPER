import { describe, expect, it } from 'vitest';
import { runFigureChecks } from './figures';

const byId = (r: ReturnType<typeof runFigureChecks>, id: string) => r.find((c) => c.id === id)!;

describe('runFigureChecks', () => {
  it('passes numbered tables and figures that are mentioned in the text', () => {
    const text = 'As Table 1 shows, sales grew. Figure 1 shows the trend.\n\nTable 1 Sales\n\nFigure 1 Trend';
    const r = runFigureChecks({
      kind: 'docx',
      text,
      tables: [{ rows: [['a']], caption: 'Table 1 Sales' }],
      figures: [{ kind: 'image', caption: 'Figure 1 Trend' }],
    });
    expect(byId(r, 'tables').outcome).toBe('passed');
    expect(byId(r, 'figures').outcome).toBe('passed');
  });

  it('flags missing titles, missing mentions and order', () => {
    const text = 'Table 2 Costs\n\nTable 1 Sales';
    const r = runFigureChecks({
      kind: 'docx',
      text,
      tables: [{ rows: [], caption: 'Table 2 Costs' }, { rows: [], caption: 'Table 1 Sales' }, { rows: [], caption: null }],
    });
    const t = byId(r, 'tables');
    expect(t.outcome).toBe('review');
    expect(t.instances!.join(' ')).toContain('position 3');
    expect(t.instances!.join(' ')).toContain('not mentioned');
    expect(t.instances!.join(' ')).toContain('not in order');
  });

  it('fails when no table has a title', () => {
    const r = runFigureChecks({ kind: 'pdf', text: 'x', tables: [{ rows: [], caption: null }] });
    expect(byId(r, 'tables').outcome).toBe('failed');
  });

  it('checks chart titles and axes', () => {
    const r = runFigureChecks({
      kind: 'docx',
      text: 'Figure 1 Sales',
      figures: [
        {
          kind: 'chart',
          caption: 'Figure 1 Sales',
          chart: { type: 'Column chart', title: null, categories: ['Q1'], series: [{ name: 'Sales', values: [1] }], axisTitles: [] },
        },
      ],
    });
    const c = byId(r, 'charts');
    expect(c.outcome).toBe('review');
    expect(c.instances!.join(' ')).toContain('axes are not labeled');
  });

  it('reports when there is nothing to check', () => {
    expect(runFigureChecks({ kind: 'docx', text: 'Hello' })[0]).toMatchObject({ id: 'tablesFigures', outcome: 'na' });
    expect(runFigureChecks({ kind: 'txt', text: 'Table 1' })[0].detail).toBe('Not available for this file type');
  });
});
