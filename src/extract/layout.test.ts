import { describe, expect, it } from 'vitest';
import { assembleLines, rectsForRange } from './layout';

const box = (x: number, w: number, y = 0) => ({ x, y, w, h: 10 });

describe('assembleLines', () => {
  it('builds paragraphs and keeps the position of every fragment', () => {
    const { text, paragraphs, boxesByPage } = assembleLines([
      { page: 1, paraStart: true, items: [{ str: 'Hello', box: box(0, 50) }, { str: ' ' }, { str: 'world.', box: box(60, 60) }] },
      { page: 1, paraStart: true, items: [{ str: 'Second', box: box(0, 60, 20) }] },
      { page: 2, paraStart: false, items: [{ str: 'line', box: box(0, 40) }] },
    ]);
    expect(text).toBe('Hello world.\n\nSecond\nline');
    expect(paragraphs).toEqual(['Hello world.', 'Second\nline']);
    const p1 = boxesByPage.get(1)!;
    expect(text.slice(p1[1].start, p1[1].end)).toBe('world.');
    const p2 = boxesByPage.get(2)!;
    expect(text.slice(p2[0].start, p2[0].end)).toBe('line');
  });

  it('joins long wrapped lines with a space and trims spaces', () => {
    const long = 'This is a long line of text that was wrapped by the page at a fixed';
    const { text, boxesByPage } = assembleLines([
      { page: 1, paraStart: true, items: [{ str: '  ' + long, box: box(0, 100) }] },
      { page: 1, paraStart: false, items: [{ str: 'width.', box: box(0, 30, 12) }] },
      { page: 1, paraStart: false, items: [{ str: '   ' }] },
      { page: 1, paraStart: false, items: [{ str: 'New paragraph', box: box(0, 30, 40) }] },
    ]);
    expect(text).toBe(`${long} width.\n\nNew paragraph`);
    const b = boxesByPage.get(1)![0];
    expect(text.slice(b.start, b.end)).toBe(long);
  });
});

describe('rectsForRange', () => {
  it('returns the proportional part of each box and merges neighbours', () => {
    const boxes = [
      { start: 0, end: 10, x: 0, y: 0, w: 100, h: 10 },
      { start: 11, end: 20, x: 105, y: 0, w: 90, h: 10 },
      { start: 21, end: 30, x: 0, y: 20, w: 90, h: 10 },
    ];
    const r = rectsForRange(boxes, 5, 15);
    expect(r).toHaveLength(1);
    expect(r[0].x).toBe(50);
    expect(r[0].w).toBeCloseTo(95);
    expect(rectsForRange(boxes, 0, 30)).toHaveLength(2);
    expect(rectsForRange(boxes, 40, 50)).toHaveLength(0);
  });
});
