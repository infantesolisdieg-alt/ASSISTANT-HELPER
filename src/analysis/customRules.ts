// Reglas personalizadas definidas por la docente (complementos al análisis).

import { t, tn } from '../i18n';
import { ruleLabel, type CustomRule } from '../settings';
import { splitParagraphs } from './text';
import type { CheckResult } from './types';

function contains(text: string, value: string): boolean {
  const escaped = value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  // Límites de palabra solo cuando el valor empieza/termina con letra o número
  const pre = /^[\p{L}\p{N}]/u.test(value.trim()) ? '(?<![\\p{L}\\p{N}])' : '';
  const post = /[\p{L}\p{N}]$/u.test(value.trim()) ? '(?![\\p{L}\\p{N}])' : '';
  return new RegExp(pre + escaped + post, 'iu').test(text);
}

export function runCustomRules(text: string, rules: CustomRule[]): CheckResult[] {
  return rules.map((rule): CheckResult => {
    const name = ruleLabel(rule);
    if (rule.type === 'min-paragraphs') {
      const min = Number(rule.value);
      const count = splitParagraphs(text).length;
      return {
        id: rule.id,
        name,
        outcome: count >= min ? 'passed' : 'failed',
        detail: tn(count, '{n} paragraph found (minimum {min}).', '{n} paragraphs found (minimum {min}).', { min }),
        group: 'custom',
      };
    }
    const found = contains(text, rule.value);
    const passed = rule.type === 'must-contain' ? found : !found;
    return {
      id: rule.id,
      name,
      outcome: passed ? 'passed' : 'failed',
      detail: found
        ? t('“{value}” was found in the text.', { value: rule.value })
        : t('“{value}” was not found in the text.', { value: rule.value }),
      group: 'custom',
    };
  });
}
