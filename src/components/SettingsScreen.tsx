import { useEffect, useRef, useState } from 'react';
import { CITATION_EXAMPLE } from '../analysis/citations';
import { lineSpacingLabel } from '../analysis/format';
import {
  ALIGNMENTS,
  CHECK_KEYS,
  CHECK_LABELS,
  CITATION_STYLES,
  DEFAULT_SETTINGS,
  LINE_SPACINGS,
  THRESHOLDS,
  parseSettings,
  ruleLabel,
  serializeSettings,
  type CustomRuleType,
  type Settings,
} from '../settings';
import { newId, useStore } from '../state/store';

/**
 * Campo numérico que permite borrar y escribir libremente: guarda el valor solo cuando es
 * un número válido dentro del rango, y al salir del campo regresa al último valor válido.
 */
function NumberField({
  id,
  value,
  min,
  max,
  step,
  onCommit,
  label,
  invalid,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
  label?: string;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const n = Number(draft);
  const bad = draft.trim() === '' || !Number.isFinite(n) || n < min || n > max;
  return (
    <>
      <input
        id={id}
        className={`input${invalid || bad ? ' input-invalid' : ''}`}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        aria-label={label}
        aria-invalid={bad || undefined}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= min && v <= max) onCommit(v);
        }}
        onBlur={() => setDraft(String(value))}
      />
    </>
  );
}

const FONTS = ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Georgia', 'Garamond', 'Verdana', 'Aptos'];

export function SettingsScreen() {
  const { state, dispatch, notify } = useStore();
  const s = state.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [ruleType, setRuleType] = useState<CustomRuleType>('must-contain');
  const [ruleValue, setRuleValue] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const update = (patch: Partial<Settings>) => dispatch({ type: 'setSettings', settings: { ...s, ...patch } });
  const addRule = () => {
    const value = ruleValue.trim();
    if (!value) return;
    if (ruleType === 'min-paragraphs' && !(Number(value) >= 1)) return;
    update({ customRules: [...s.customRules, { id: newId('rule'), type: ruleType, value }] });
    setRuleValue('');
  };

  const exportSettings = () => {
    const blob = new Blob([serializeSettings(s)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assistant-helper-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = async (file: File) => {
    try {
      const parsed = parseSettings(JSON.parse(await file.text()));
      dispatch({ type: 'setSettings', settings: parsed });
      setImportError(null);
      notify('Settings imported. Results were updated with the new criteria.');
    } catch (err) {
      setImportError(err instanceof SyntaxError ? 'The file is not valid JSON.' : (err as Error).message);
    }
  };

  const wordRangeInvalid = s.minWords > s.maxWords;

  return (
    <div className="page settings-page">
      <section className="card">
        <div className="card-header">
          <div>
            <h2>Review criteria</h2>
            <p className="muted-text small">
              Changes apply immediately to every submission. Settings are not saved automatically: use “Export settings” to
              keep a copy and “Import settings” next time.
            </p>
          </div>
          <div className="button-row">
            <button type="button" className="button button-secondary" onClick={() => fileRef.current?.click()}>
              Import settings
            </button>
            <button type="button" className="button button-primary" onClick={exportSettings}>
              Export settings
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importSettings(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        {importError && (
          <div className="alert alert-bad" role="alert">
            <strong>Settings were not imported.</strong> {importError}
          </div>
        )}

        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="citation-style">
              Citation style
            </label>
            <select
              id="citation-style"
              className="input select"
              value={s.citationStyle}
              onChange={(e) => update({ citationStyle: e.target.value as Settings['citationStyle'] })}
            >
              {CITATION_STYLES.map((c) => (
                <option key={c} value={c}>
                  {c} — {CITATION_EXAMPLE[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="threshold">
              Similarity threshold
            </label>
            <select
              id="threshold"
              className="input select"
              value={s.similarityThreshold}
              onChange={(e) => update({ similarityThreshold: Number(e.target.value) as Settings['similarityThreshold'] })}
            >
              {THRESHOLDS.map((t) => (
                <option key={t} value={t}>
                  {t}%
                </option>
              ))}
            </select>
            <p className="form-hint">Below the threshold = Clear; from the threshold to 29% = Review; 30% or more = High match.</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="font">
              Expected font
            </label>
            <input
              id="font"
              className="input"
              list="font-options"
              value={s.font}
              onChange={(e) => update({ font: e.target.value })}
              onBlur={(e) => !e.target.value.trim() && update({ font: DEFAULT_SETTINGS.font })}
            />
            <datalist id="font-options">
              {FONTS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="font-size">
              Font size (pt)
            </label>
            <NumberField id="font-size" value={s.fontSizePt} min={6} max={32} step={0.5} onCommit={(v) => update({ fontSizePt: v })} />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="line-spacing">
              Line spacing
            </label>
            <select
              id="line-spacing"
              className="input select"
              value={s.lineSpacing}
              onChange={(e) => update({ lineSpacing: Number(e.target.value) })}
            >
              {LINE_SPACINGS.map((l) => (
                <option key={l} value={l}>
                  {lineSpacingLabel(l)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="margins">
              Margins (cm, all sides)
            </label>
            <NumberField id="margins" value={s.marginsCm} min={0.5} max={6} step={0.01} onCommit={(v) => update({ marginsCm: v })} />
            <p className="form-hint">2.54 cm = 1 inch.</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="alignment">
              Alignment
            </label>
            <select
              id="alignment"
              className="input select"
              value={s.alignment}
              onChange={(e) => update({ alignment: e.target.value as Settings['alignment'] })}
            >
              {ALIGNMENTS.map((a) => (
                <option key={a} value={a}>
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="field-label" id="word-range-label">
              Word count
            </span>
            <div className="inline-fields" role="group" aria-labelledby="word-range-label">
              <NumberField
                id="min-words"
                label="Minimum words"
                invalid={wordRangeInvalid}
                value={s.minWords}
                min={0}
                max={100000}
                step={10}
                onCommit={(v) => update({ minWords: v })}
              />
              <span>to</span>
              <NumberField
                id="max-words"
                label="Maximum words"
                invalid={wordRangeInvalid}
                value={s.maxWords}
                min={1}
                max={100000}
                step={10}
                onCommit={(v) => update({ maxWords: v })}
              />
            </div>
            {wordRangeInvalid && <p className="form-hint text-bad">The minimum is greater than the maximum.</p>}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Checks</h2>
        <p className="muted-text small">Turn off the checks that do not apply to the current assignment.</p>
        <div className="toggle-grid">
          {CHECK_KEYS.map((k) => (
            <label key={k} className="checkbox">
              <input
                type="checkbox"
                checked={s.checks[k]}
                onChange={(e) => update({ checks: { ...s.checks, [k]: e.target.checked } })}
              />
              {CHECK_LABELS[k]}
            </label>
          ))}
        </div>
        <p className="form-hint">Font, font size, line spacing, margins and alignment can only be checked in .docx files.</p>
      </section>

      <section className="card">
        <h2>Custom rules</h2>
        <p className="muted-text small">Add your own simple requirements. They appear under “Custom rules” in each review.</p>
        <div className="rule-form">
          <div className="field">
            <label className="field-label" htmlFor="rule-type">
              Rule
            </label>
            <select
              id="rule-type"
              className="input select"
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as CustomRuleType)}
            >
              <option value="must-contain">Must contain word or section</option>
              <option value="must-not-contain">Must not contain</option>
              <option value="min-paragraphs">Minimum number of paragraphs</option>
            </select>
          </div>
          <div className="field grow">
            <label className="field-label" htmlFor="rule-value">
              {ruleType === 'min-paragraphs' ? 'Paragraphs' : 'Text'}
            </label>
            <input
              id="rule-value"
              className="input"
              type={ruleType === 'min-paragraphs' ? 'number' : 'text'}
              min={1}
              value={ruleValue}
              placeholder={ruleType === 'min-paragraphs' ? 'e.g. 4' : 'e.g. Sincerely'}
              onChange={(e) => setRuleValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRule()}
            />
          </div>
          <button type="button" className="button button-primary" disabled={!ruleValue.trim()} onClick={addRule}>
            Add custom rule
          </button>
        </div>
        {s.customRules.length === 0 ? (
          <p className="empty-inline">No custom rules yet.</p>
        ) : (
          <ul className="rule-list">
            {s.customRules.map((r) => (
              <li key={r.id}>
                <span>{ruleLabel(r)}</span>
                <button
                  type="button"
                  className="button button-link"
                  aria-label={`Remove rule: ${ruleLabel(r)}`}
                  onClick={() => update({ customRules: s.customRules.filter((x) => x.id !== r.id) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="button-row">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            dispatch({ type: 'setSettings', settings: structuredClone(DEFAULT_SETTINGS) });
            notify('Settings restored to the defaults.');
          }}
        >
          Restore defaults
        </button>
      </div>
    </div>
  );
}
