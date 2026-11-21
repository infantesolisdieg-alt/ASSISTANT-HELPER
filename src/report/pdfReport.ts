// Exporta un reporte PDF de una entrega con jsPDF (se genera en el navegador).

import { jsPDF } from 'jspdf';
import { AI_DISCLAIMER } from '../analysis/ai';
import { AI_LEVEL_LABEL, OUTCOME_LABEL, STATUS_LABEL } from '../components/common';
import { APP_NAME, locale, t } from '../i18n';
import type { DocAnalysis } from '../analysis';
import type { Settings } from '../settings';
import { REVIEW_LABEL, type DocItem, type TeacherProfile } from '../types';

const RED = [139, 30, 45] as const;
const DARK = [42, 26, 28] as const;
const GREY = [107, 85, 88] as const;


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

/** Logo de la app como data URL para el encabezado del reporte (si no carga, el reporte sale sin logo). */
async function loadLogo(): Promise<string | undefined> {
  try {
    const blob = await (await fetch('/logo-512.png')).blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : undefined);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export async function exportReport(
  doc: DocItem,
  a: DocAnalysis,
  settings: Settings,
  labelOf: (id: string) => string,
  reviewer?: TeacherProfile | null,
): Promise<void> {
  const pdf = buildReport(doc, a, settings, labelOf, reviewer, await loadLogo());
  const safe = `${doc.studentName}-${doc.assignmentTitle}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  pdf.save(`${t('report')}-${safe || t('submission')}.pdf`);
}

export function buildReport(
  doc: DocItem,
  a: DocAnalysis,
  settings: Settings,
  labelOf: (id: string) => string,
  reviewer?: TeacherProfile | null,
  logo?: string,
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
  if (logo) {
    try {
      pdf.addImage(logo, 'PNG', pdf.internal.pageSize.getWidth() - margin - 46, margin - 14, 46, 46);
    } catch {
      // sin logo si la imagen no es válida
    }
  }
  text(`${APP_NAME} - ${t('Submission report')}`, { size: 18, bold: true, color: RED, gap: 6 });
  text(`${t('Student: {name}', { name: doc.studentName })}${doc.group ? `   ${t('Group: {group}', { group: doc.group })}` : ''}`, { size: 11 });
  text(t('Assignment: {title}', { title: doc.assignmentTitle }), { size: 11 });
  text(t('File: {file} ({n} words)', { file: doc.fileName, n: a.wordCount }), { size: 11 });
  if (reviewer) {
    const who = [reviewer.name, reviewer.role, reviewer.group].filter(Boolean).join(' - ');
    text(t('Reviewed by: {who}', { who }), { size: 11 });
  }
  text(t('Generated: {date}', { date: new Date().toLocaleString(locale()) }), { size: 10, color: GREY });
  text(t('Review status: {status}', { status: t(REVIEW_LABEL[doc.reviewStatus]) }), { size: 11, bold: true, gap: 4 });
  if (doc.finalComment) text(t('Final comment: {comment}', { comment: doc.finalComment }), { size: 11 });

  heading(t('Similarity'));
  text(
    t('Total similarity: {p}% - {status} (threshold {threshold}%)', {
      p: Math.round(a.similarity.percent),
      status: t(STATUS_LABEL[a.status]),
      threshold: settings.similarityThreshold,
    }),
    { bold: true, size: 11 },
  );
  if (a.similarity.matches.length === 0) text(t('No matching passages with other files in this session.'));
  for (const m of a.similarity.matches) text(`- ${labelOf(m.docId)}: ${Math.round(m.percent)}%`, { indent: 10 });
  text(t('Compared only with files uploaded in the same session.'), { color: GREY, size: 9 });

  heading(t('Format & writing'));
  if (a.checks.length === 0) text(t('All checks were turned off.'));
  for (const c of a.checks) {
    text(`${c.name}: ${t(OUTCOME_LABEL[c.outcome])}`, { bold: true, gap: 0 });
    text(c.detail, { indent: 10, color: GREY, gap: 4 });
  }

  heading(t('AI indicators'));
  text(t(AI_DISCLAIMER), { color: GREY, size: 9, gap: 6 });
  if (!a.ai) text(t('AI indicators were turned off.'));
  else {
    text(t('Indicator score: {p}% - {level}', { p: a.ai.percent, level: t(AI_LEVEL_LABEL[a.ai.level]) }), { bold: true, size: 11 });
    for (const s of a.ai.signals) {
      text(`- ${s.name}: ${s.score === null ? t('N/A') : Math.round(s.score * 100) + '%'} - ${s.detail}`, { indent: 10 });
    }
    if (a.ai.sentences.length) {
      text(t('Sentences that contribute most:'), { bold: true, gap: 0 });
      for (const s of a.ai.sentences) text(`"${s.text}" (${s.reasons.join('; ')})`, { indent: 10, color: GREY });
    }
  }

  heading(t('Teacher notes'));
  if (doc.notes.length === 0) text(t('No notes.'));
  for (const n of doc.notes) {
    text(`${new Date(n.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })} - ${n.text}`);
  }

  return pdf;
}
