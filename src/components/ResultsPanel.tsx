import { useState } from 'react';
import { AI_DISCLAIMER } from '../analysis/ai';
import type { DocAnalysis } from '../analysis';
import { HIGH_MATCH_PERCENT } from '../analysis/similarity';
import type { CheckResult } from '../analysis/types';
import { docLabel, newId, useStore } from '../state/store';
import type { DocItem } from '../types';
import { Gauge, MiniBar } from './charts';
import { AiBadge, OutcomeBadge, SimilarityBadge, percentText } from './common';
import { Icon } from './icons';
import { AI_TONE, STATUS_TONE } from './tones';

function thresholdText(threshold: number): string {
  if (threshold >= HIGH_MATCH_PERCENT) return `Clear: below ${threshold}% · High match: ${HIGH_MATCH_PERCENT}% or more`;
  return `Clear: below ${threshold}% · Review: ${threshold}–${HIGH_MATCH_PERCENT - 1}% · High match: ${HIGH_MATCH_PERCENT}% or more`;
}

function CheckRow({ check }: { check: CheckResult }) {
  return (
    <li className="check">
      <div className="check-head">
        <span className="check-name">
          <span className={`check-dot dot-${check.outcome}`} aria-hidden="true">
            {check.outcome === 'passed' ? '✓' : check.outcome === 'failed' ? '✕' : check.outcome === 'review' ? '!' : '–'}
          </span>
          {check.name}
        </span>
        <OutcomeBadge outcome={check.outcome} />
      </div>
      <p className="check-detail">{check.detail}</p>
      {check.instances && check.instances.length > 0 && (
        <details className="check-instances">
          <summary>Show {check.instances.length} example{check.instances.length === 1 ? '' : 's'}</summary>
          <ul>
            {check.instances.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

export function ResultsPanel({
  doc,
  analysis,
  focusedSource,
  onFocusSource,
  onJumpToSource,
}: {
  doc: DocItem;
  analysis: DocAnalysis;
  focusedSource?: string | null;
  onFocusSource?: (id: string | null) => void;
  onJumpToSource?: (id: string) => void;
}) {
  const { state, dispatch, docById } = useStore();
  const [note, setNote] = useState('');
  const { similarity, checks, ai } = analysis;

  const groups: { key: CheckResult['group']; title: string }[] = [
    { key: 'format', title: 'Format' },
    { key: 'writing', title: 'Writing quality' },
    { key: 'custom', title: 'Custom rules' },
  ];

  const addNote = () => {
    const text = note.trim();
    if (!text) return;
    dispatch({ type: 'addNote', id: doc.id, note: { id: newId('note'), text, at: Date.now() } });
    setNote('');
  };

  return (
    <div className="results">
      <section className="card result-section" aria-labelledby="sim-title">
        <h3 id="sim-title">Similarity</h3>
        <div className="metric-row">
          <Gauge
            value={similarity.percent}
            tone={STATUS_TONE[analysis.status]}
            label="Similarity"
            marker={state.settings.similarityThreshold}
            markerLabel={`Threshold ${state.settings.similarityThreshold}%`}
          />
          <div className="metric-text">
            <SimilarityBadge status={analysis.status} />
            <p className="small muted-text">{thresholdText(state.settings.similarityThreshold)}</p>
            <p className="small muted-text">The tick on the ring marks your threshold.</p>
          </div>
        </div>
        {similarity.matches.length === 0 ? (
          <p className="small">No matching passages with other files in this session.</p>
        ) : (
          <>
            <ul className="match-list">
              {similarity.matches.map((m) => (
                <li key={m.docId}>
                  <button
                    type="button"
                    className={`match-item${focusedSource === m.docId ? ' active' : ''}`}
                    aria-pressed={focusedSource === m.docId}
                    onMouseEnter={() => onFocusSource?.(m.docId)}
                    onMouseLeave={() => onFocusSource?.(null)}
                    onFocus={() => onFocusSource?.(m.docId)}
                    onBlur={() => onFocusSource?.(null)}
                    onClick={() => onJumpToSource?.(m.docId)}
                  >
                    <span className="match-name">{docLabel(docById(m.docId))}</span>
                    <MiniBar value={m.percent} tone={STATUS_TONE[analysis.status]} />
                    <span className="num strong">{percentText(m.percent)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="small muted-text">Point at a document to outline its passages; click to jump to them.</p>
          </>
        )}
        <p className="small muted-text">Compared only with files uploaded in this session, never with the internet.</p>
      </section>

      <section className="card result-section" aria-labelledby="fmt-title">
        <h3 id="fmt-title">Format &amp; writing</h3>
        {checks.length > 0 && (
          <div className="check-summary" aria-label="Check summary">
            {(['passed', 'review', 'failed', 'na'] as const).map((o) => {
              const n = checks.filter((c) => c.outcome === o).length;
              return n ? (
                <span key={o} className="cell-flex">
                  <OutcomeBadge outcome={o} /> <span className="num strong">{n}</span>
                </span>
              ) : null;
            })}
          </div>
        )}
        {checks.length === 0 && <p className="small">All format and writing checks are turned off in Settings.</p>}
        {groups.map((g) => {
          const items = checks.filter((c) => c.group === g.key);
          if (!items.length) return null;
          return (
            <div key={g.key} className="check-group">
              <h4>{g.title}</h4>
              <ul className="check-list">
                {items.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="card result-section" aria-labelledby="ai-title">
        <h3 id="ai-title">AI indicators</h3>
        <p className="disclaimer">{AI_DISCLAIMER}</p>
        {!ai ? (
          <p className="small">AI indicators are turned off in Settings.</p>
        ) : (
          <>
            <div className="metric-row">
              <Gauge value={ai.percent} tone={AI_TONE[ai.level]} label="AI indicator score" />
              <div className="metric-text">
                <AiBadge level={ai.level} />
                <p className="small muted-text">Low below 25% · Moderate 25–44% · Elevated 45% or more</p>
                {!ai.reliable && <p className="small text-warn">This text is short, so the indicators are less reliable.</p>}
              </div>
            </div>
            <ul className="signal-list">
              {ai.signals.map((s) => (
                <li key={s.id}>
                  <div className="signal-head">
                    <span>{s.name}</span>
                    <span className="num">{s.score === null ? 'N/A' : `${Math.round(s.score * 100)}%`}</span>
                  </div>
                  <div className="meter" aria-hidden="true">
                    <span style={{ width: `${Math.round((s.score ?? 0) * 100)}%` }} />
                  </div>
                  <p className="small muted-text">{s.detail}</p>
                </li>
              ))}
            </ul>
            {ai.sentences.length > 0 && (
              <details className="check-instances">
                <summary>Sentences that contribute most ({ai.sentences.length})</summary>
                <ul>
                  {ai.sentences.map((s) => (
                    <li key={s.start}>
                      “{s.text}” <span className="muted-text">— {s.reasons.join('; ')}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      <section className="card result-section" aria-labelledby="notes-title">
        <h3 id="notes-title">Teacher notes</h3>
        <p className="small muted-text">Notes are kept only during this session.</p>
        {doc.notes.length > 0 && (
          <ul className="notes">
            {doc.notes.map((n) => (
              <li key={n.id}>
                <time className="note-time" dateTime={new Date(n.at).toISOString()}>
                  {new Date(n.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </time>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        )}
        <label className="field-label" htmlFor="note-input">
          New note
        </label>
        <textarea
          id="note-input"
          className="input textarea"
          rows={3}
          value={note}
          placeholder="Write a note about this submission…"
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote();
          }}
        />
        <div className="button-row">
          <button type="button" className="button button-secondary" disabled={!note.trim()} onClick={addNote}>
            <Icon name="pen" size={16} /> Add note
          </button>
        </div>
      </section>
    </div>
  );
}
