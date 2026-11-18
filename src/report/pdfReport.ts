// Exporta un reporte PDF de una entrega con jsPDF (se genera en el navegador).

import { jsPDF } from 'jspdf';
import { AI_DISCLAIMER } from '../analysis/ai';
import type { DocAnalysis } from '../analysis';
import type { Settings } from '../settings';
import { REVIEW_LABEL, type DocItem, type TeacherProfile } from '../types';

const RED = [139, 30, 45] as const;
const DARK = [42, 26, 28] as const;
const GREY = [107, 85, 88] as const;

const OUTCOME: Record<string, string> = { passed: 'Passed', review: 'Review', failed: 'Failed', na: 'N/A' };
const STATUS: Record<string, string> = { clear: 'Clear', review: 'Review', high: 'High match' };

// Las fuentes estándar de jsPDF solo cubren Latin-1: se reemplazan comillas y guiones tipográficos.
function clean(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/·/g, '-')
    .replace(/[^\x00-\xFF]/g, '');
}

export function exportReport(
  doc: DocItem,
  a: DocAnalysis,
  settings: Settings,
  labelOf: (id: string) => string,
  reviewer?: TeacherProfile | null,
): void {
  const pdf = buildReport(doc, a, settings, labelOf, reviewer);
  const safe = `${doc.studentName}-${doc.assignmentTitle}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  pdf.save(`report-${safe || 'submission'}.pdf`);
}

export function buildReport(
  doc: DocItem,
  a: DocAnalysis,
  settings: Settings,
  labelOf: (id: string) => string,
  reviewer?: TeacherProfile | null,
): jsPDF {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 56;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > bottom) {
      pdf.addPage();
      y = margin;
    }
  };
  const text = (s: string, opts: { size?: number; bold?: boolean; color?: readonly number[]; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    pdf.setFont('times', opts.bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...((opts.color ?? DARK) as [number, number, number]));
    const lines = pdf.splitTextToSize(clean(s), width - (opts.indent ?? 0)) as string[];
    for (const line of lines) {
      ensure(size * 1.35);
      pdf.text(line, margin + (opts.indent ?? 0), y + size);
      y += size * 1.35;
    }
    y += opts.gap ?? 2;
  };
  const heading = (s: string) => {
    ensure(40);
    y += 10;
    text(s, { size: 13, bold: true, color: RED, gap: 2 });
    pdf.setDrawColor(232, 218, 220);
    pdf.line(margin, y, margin + width, y);
    y += 8;
  };

  // Encabezado
  pdf.setFillColor(74, 13, 22);
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), 6, 'F');
  text('Assistant Helper - Submission report', { size: 18, bold: true, color: RED, gap: 6 });
  text(`Student: ${doc.studentName}`, { size: 11 });
  text(`Assignment: ${doc.assignmentTitle}`, { size: 11 });
  text(`File: ${doc.fileName} (${a.wordCount} words)`, { size: 11 });
  if (reviewer) {
    const who = [reviewer.name, reviewer.role, reviewer.group].filter(Boolean).join(' - ');
    text(`Reviewed by: ${who}`, { size: 11 });
  }
  text(`Generated: ${new Date().toLocaleString('en-US')}`, { size: 10, color: GREY });
  text(`Review status: ${REVIEW_LABEL[doc.reviewStatus]}`, { size: 11, bold: true, gap: 4 });
  if (doc.finalComment) text(`Final comment: ${doc.finalComment}`, { size: 11 });

  heading('Similarity');
  text(`Total similarity: ${Math.round(a.similarity.percent)}% - ${STATUS[a.status]} (threshold ${settings.similarityThreshold}%)`, {
    bold: true,
    size: 11,
  });
  if (a.similarity.matches.length === 0) text('No matching passages with other files in this session.');
  for (const m of a.similarity.matches) text(`- ${labelOf(m.docId)}: ${Math.round(m.percent)}%`, { indent: 10 });
  text('Compared only with files uploaded in the same session.', { color: GREY, size: 9 });

  heading('Format & writing');
  if (a.checks.length === 0) text('All checks were turned off.');
  for (const c of a.checks) {
    text(`${c.name}: ${OUTCOME[c.outcome]}`, { bold: true, gap: 0 });
    text(c.detail, { indent: 10, color: GREY, gap: 4 });
  }

  heading('AI indicators');
  text(AI_DISCLAIMER, { color: GREY, size: 9, gap: 6 });
  if (!a.ai) text('AI indicators were turned off.');
  else {
    text(`Indicator score: ${a.ai.percent}% - ${a.ai.level}`, { bold: true, size: 11 });
    for (const s of a.ai.signals) {
      text(`- ${s.name}: ${s.score === null ? 'N/A' : Math.round(s.score * 100) + '%'} - ${s.detail}`, { indent: 10 });
    }
    if (a.ai.sentences.length) {
      text('Sentences that contribute most:', { bold: true, gap: 0 });
      for (const s of a.ai.sentences) text(`"${s.text}" (${s.reasons.join('; ')})`, { indent: 10, color: GREY });
    }
  }

  heading('Teacher notes');
  if (doc.notes.length === 0) text('No notes.');
  for (const n of doc.notes) {
    text(`${new Date(n.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${n.text}`);
  }

  return pdf;
}
