// Gráficas ligeras hechas a mano (SVG/HTML), sin librerías externas.
// Los colores son de ESTADO (Clear/Review/High match, Approved/Pending...) y siempre van
// acompañados de texto, para no depender solo del color.

import { useState, type ReactNode } from 'react';
import { t } from '../i18n';

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

export const TONE_COLOR: Record<Tone, string> = {
  ok: 'var(--st-ok)',
  warn: 'var(--st-warn)',
  bad: 'var(--st-bad)',
  neutral: 'var(--st-neutral)',
};

/* ---------------- Tooltip ---------------- */

interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = (e: { currentTarget: Element }, content: ReactNode) => {
    const host = (e.currentTarget as Element).closest('.chart-host');
    if (!host) return;
    const hr = host.getBoundingClientRect();
    const r = (e.currentTarget as Element).getBoundingClientRect();
    setTip({ x: r.left - hr.left + r.width / 2, y: r.top - hr.top, content });
  };
  const hide = () => setTip(null);
  const node = tip ? (
    <div className="chart-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  ) : null;
  return { show, hide, node };
}

/* ---------------- Dona ---------------- */

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  tone: Tone;
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
  title,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  title: string;
}) {
  const { show, hide, node } = useTooltip();
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const size = 168;
  const r = 64;
  const stroke = 20;
  const C = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 2.5 : 0;
  let offset = 0;
  const activeSeg = segments.find((s) => s.key === active);

  return (
    <div className="donut chart-host">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {visible.map((s) => {
            const len = Math.max(0, (C * s.value) / total - gap);
            const el = (
              <circle
                key={s.key}
                className={`donut-seg${active && active !== s.key ? ' dim' : ''}`}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={TONE_COLOR[s.tone]}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                tabIndex={0}
                aria-label={`${s.label}: ${s.value}`}
                onMouseEnter={(e) => {
                  setActive(s.key);
                  show(e, (
                    <>
                      <strong>{s.label}</strong>
                      <span>
                        {s.value} of {total} ({Math.round((s.value / total) * 100)}%)
                      </span>
                    </>
                  ));
                }}
                onFocus={(e) => {
                  setActive(s.key);
                  show(e, (
                    <>
                      <strong>{s.label}</strong>
                      <span>
                        {s.value} of {total}
                      </span>
                    </>
                  ));
                }}
                onMouseLeave={() => {
                  setActive(null);
                  hide();
                }}
                onBlur={() => {
                  setActive(null);
                  hide();
                }}
              />
            );
            offset += (C * s.value) / total;
            return el;
          })}
        </g>
        <text x="50%" y="48%" textAnchor="middle" className="donut-value">
          {activeSeg ? activeSeg.value : centerValue}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="donut-label">
          {activeSeg ? activeSeg.label : centerLabel}
        </text>
      </svg>
      <ul className="chart-legend vertical">
        {segments.map((s) => (
          <li key={s.key} className={active && active !== s.key ? 'dim' : ''}>
            <span className="legend-swatch" style={{ background: TONE_COLOR[s.tone] }} aria-hidden="true" />
            <span className="legend-label">{s.label}</span>
            <span className="legend-value">{s.value}</span>
          </li>
        ))}
      </ul>
      {node}
    </div>
  );
}

/* ---------------- Barras horizontales de similitud ---------------- */

export interface BarRow {
  id: string;
  label: string;
  sublabel: string;
  value: number;
  tone: Tone;
  statusLabel: string;
  detail?: string;
}

export function SimilarityBars({
  rows,
  threshold,
  high,
  onSelect,
}: {
  rows: BarRow[];
  threshold: number;
  high: number;
  onSelect: (id: string) => void;
}) {
  const { show, hide, node } = useTooltip();
  // Escala: hasta 100 % o un poco por encima del valor máximo, para que las barras se lean bien
  const max = Math.min(100, Math.max(40, Math.ceil((Math.max(...rows.map((r) => r.value), 0) + 5) / 10) * 10));
  const pos = (v: number) => `${(Math.min(v, max) / max) * 100}%`;
  const ticks = [0, threshold, high, max].filter((v, i, a) => a.indexOf(v) === i && v <= max).sort((a, b) => a - b);

  return (
    <div className="bars chart-host">
      <div className="bars-plot" style={{ ['--threshold' as string]: pos(threshold), ['--high' as string]: pos(high) }}>
        <div className="bars-guides" aria-hidden="true">
          {threshold < high && <span className="guide guide-threshold" />}
          <span className="guide guide-high" />
        </div>
        {rows.map((r, i) => (
          <button
            key={r.id}
            type="button"
            className="bar-row"
            aria-label={t('{name}: {p}% similarity, {status}. Open review.', { name: r.label, p: Math.round(r.value), status: r.statusLabel })}
            onClick={() => onSelect(r.id)}
            onMouseEnter={(e) =>
              show(e, (
                <>
                  <strong>{r.label}</strong>
                  <span>{r.sublabel}</span>
                  <span>
                    {Math.round(r.value)}% · {r.statusLabel}
                  </span>
                  {r.detail && <span className="tip-muted">{r.detail}</span>}
                </>
              ))
            }
            onMouseLeave={hide}
            onFocus={(e) =>
              show(e, (
                <>
                  <strong>{r.label}</strong>
                  <span>
                    {Math.round(r.value)}% · {r.statusLabel}
                  </span>
                </>
              ))
            }
            onBlur={hide}
          >
            <span className="bar-name">{r.label}</span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ width: pos(r.value), background: TONE_COLOR[r.tone], animationDelay: `${i * 50}ms` }}
              />
            </span>
            <span className="bar-value">{Math.round(r.value)}%</span>
          </button>
        ))}
        <div className="bars-axis" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ left: pos(t) }}>
              {t}%
            </span>
          ))}
        </div>
      </div>
      {node}
    </div>
  );
}

/* ---------------- Indicador circular ---------------- */

export function Gauge({
  value,
  tone,
  label,
  marker,
  markerLabel,
}: {
  value: number;
  tone: Tone;
  label: string;
  /** Marca opcional (por ejemplo, el umbral de similitud), en %. */
  marker?: number;
  markerLabel?: string;
}) {
  const size = 132;
  const r = 52;
  const stroke = 12;
  const C = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const len = (C * v) / 100;
  const angle = marker !== undefined ? (marker / 100) * 2 * Math.PI - Math.PI / 2 : 0;
  const mx1 = size / 2 + Math.cos(angle) * (r - stroke / 2 - 3);
  const my1 = size / 2 + Math.sin(angle) * (r - stroke / 2 - 3);
  const mx2 = size / 2 + Math.cos(angle) * (r + stroke / 2 + 3);
  const my2 = size / 2 + Math.sin(angle) * (r + stroke / 2 + 3);

  return (
    <div className="gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${Math.round(v)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {v > 0 && (
          <circle
            className="gauge-arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={TONE_COLOR[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${len} ${C}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ ['--len' as string]: `${len}`, ['--circ' as string]: `${C}` }}
          />
        )}
        {marker !== undefined && (
          <line x1={mx1} y1={my1} x2={mx2} y2={my2} className="gauge-marker">
            {markerLabel && <title>{markerLabel}</title>}
          </line>
        )}
        <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" className="gauge-value">
          {Math.round(v)}%
        </text>
      </svg>
    </div>
  );
}

/* ---------------- Minibarra para tablas ---------------- */

export function MiniBar({ value, tone }: { value: number; tone: Tone }) {
  return (
    <span className="minibar" aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: TONE_COLOR[tone] }} />
    </span>
  );
}

/* ---------------- Barra de progreso segmentada ---------------- */

export function ProgressSegments({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="progress-seg" aria-hidden="true">
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: TONE_COLOR[s.tone] }} />
        ))}
    </div>
  );
}
