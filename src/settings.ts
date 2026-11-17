// Configuración de criterios. Vive solo en memoria; se exporta/importa como .json.

export type CitationStyle = 'APA 7' | 'MLA 9' | 'Chicago';
export type Alignment = 'left' | 'center' | 'right' | 'justify';
export type CustomRuleType = 'must-contain' | 'must-not-contain' | 'min-paragraphs';

export interface CustomRule {
  id: string;
  type: CustomRuleType;
  value: string;
}

export const CHECK_KEYS = [
  'font',
  'fontSize',
  'lineSpacing',
  'margins',
  'alignment',
  'wordCount',
  'title',
  'references',
  'citations',
  'passiveVoice',
  'longSentences',
  'repeatedWords',
  'aiIndicators',
] as const;

export type CheckKey = (typeof CHECK_KEYS)[number];

export const CHECK_LABELS: Record<CheckKey, string> = {
  font: 'Font',
  fontSize: 'Font size',
  lineSpacing: 'Line spacing',
  margins: 'Margins',
  alignment: 'Alignment',
  wordCount: 'Word count',
  title: 'Title',
  references: 'References section',
  citations: 'In-text citations',
  passiveVoice: 'Passive voice',
  longSentences: 'Long sentences',
  repeatedWords: 'Repeated words',
  aiIndicators: 'AI indicators',
};

export interface Settings {
  citationStyle: CitationStyle;
  similarityThreshold: 15 | 20 | 30;
  font: string;
  fontSizePt: number;
  lineSpacing: number;
  marginsCm: number;
  alignment: Alignment;
  minWords: number;
  maxWords: number;
  checks: Record<CheckKey, boolean>;
  customRules: CustomRule[];
}

export const DEFAULT_SETTINGS: Settings = {
  citationStyle: 'APA 7',
  similarityThreshold: 20,
  font: 'Times New Roman',
  fontSizePt: 12,
  lineSpacing: 2,
  marginsCm: 2.54,
  alignment: 'left',
  minWords: 150,
  maxWords: 600,
  checks: Object.fromEntries(CHECK_KEYS.map((k) => [k, true])) as Record<CheckKey, boolean>,
  customRules: [],
};

export const CITATION_STYLES: CitationStyle[] = ['APA 7', 'MLA 9', 'Chicago'];
export const THRESHOLDS: Settings['similarityThreshold'][] = [15, 20, 30];
export const LINE_SPACINGS = [1, 1.15, 1.5, 2];
export const ALIGNMENTS: Alignment[] = ['left', 'justify', 'center', 'right'];

export function ruleLabel(rule: CustomRule): string {
  switch (rule.type) {
    case 'must-contain':
      return `Must contain "${rule.value}"`;
    case 'must-not-contain':
      return `Must not contain "${rule.value}"`;
    case 'min-paragraphs':
      return `At least ${rule.value} paragraphs`;
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Valida un objeto importado desde .json. Los campos que falten toman el valor por defecto;
 * los campos con un valor inválido producen un error con un mensaje claro.
 */
export function parseSettings(raw: unknown): Settings {
  if (!isObj(raw)) throw new Error('The file does not contain a settings object.');
  const src = isObj(raw.settings) ? raw.settings : raw;
  const s: Settings = structuredClone(DEFAULT_SETTINGS);

  const num = (key: string, min: number, max: number): number | undefined => {
    const v = src[key];
    if (v === undefined) return undefined;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
      throw new Error(`"${key}" must be a number between ${min} and ${max}.`);
    }
    return v;
  };

  if (src.citationStyle !== undefined) {
    if (!CITATION_STYLES.includes(src.citationStyle as CitationStyle))
      throw new Error(`"citationStyle" must be one of: ${CITATION_STYLES.join(', ')}.`);
    s.citationStyle = src.citationStyle as CitationStyle;
  }
  if (src.similarityThreshold !== undefined) {
    if (!THRESHOLDS.includes(src.similarityThreshold as 15))
      throw new Error('"similarityThreshold" must be 15, 20 or 30.');
    s.similarityThreshold = src.similarityThreshold as Settings['similarityThreshold'];
  }
  if (src.font !== undefined) {
    if (typeof src.font !== 'string' || !src.font.trim()) throw new Error('"font" must be a font name.');
    s.font = src.font.trim();
  }
  s.fontSizePt = num('fontSizePt', 6, 32) ?? s.fontSizePt;
  s.lineSpacing = num('lineSpacing', 1, 3) ?? s.lineSpacing;
  s.marginsCm = num('marginsCm', 0.5, 6) ?? s.marginsCm;
  s.minWords = num('minWords', 0, 100000) ?? s.minWords;
  s.maxWords = num('maxWords', 1, 100000) ?? s.maxWords;
  if (s.minWords > s.maxWords) throw new Error('"minWords" cannot be greater than "maxWords".');

  if (src.alignment !== undefined) {
    if (!ALIGNMENTS.includes(src.alignment as Alignment))
      throw new Error(`"alignment" must be one of: ${ALIGNMENTS.join(', ')}.`);
    s.alignment = src.alignment as Alignment;
  }
  if (src.checks !== undefined) {
    if (!isObj(src.checks)) throw new Error('"checks" must be an object.');
    for (const k of CHECK_KEYS) {
      const v = src.checks[k];
      if (v === undefined) continue;
      if (typeof v !== 'boolean') throw new Error(`"checks.${k}" must be true or false.`);
      s.checks[k] = v;
    }
  }
  if (src.customRules !== undefined) {
    if (!Array.isArray(src.customRules)) throw new Error('"customRules" must be a list.');
    s.customRules = src.customRules.map((r, i) => {
      if (!isObj(r)) throw new Error(`Custom rule ${i + 1} is not valid.`);
      const type = r.type as CustomRuleType;
      if (!['must-contain', 'must-not-contain', 'min-paragraphs'].includes(type))
        throw new Error(`Custom rule ${i + 1} has an unknown type.`);
      const value = String(r.value ?? '').trim();
      if (!value) throw new Error(`Custom rule ${i + 1} has no value.`);
      if (type === 'min-paragraphs' && !(Number(value) >= 1))
        throw new Error(`Custom rule ${i + 1} needs a number of paragraphs.`);
      return { id: typeof r.id === 'string' ? r.id : `rule-${Date.now()}-${i}`, type, value };
    });
  }
  return s;
}

export function serializeSettings(s: Settings): string {
  return JSON.stringify({ app: 'Assistant Helper', version: 1, settings: s }, null, 2);
}
