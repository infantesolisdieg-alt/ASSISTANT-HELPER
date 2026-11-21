import type { AiLevel, SimilarityStatus } from '../analysis/types';
import { tk } from '../i18n';
import type { Tone } from './charts';

export const STATUS_TONE: Record<SimilarityStatus, Tone> = { clear: 'ok', review: 'warn', high: 'bad' };
/** Se muestran con t(STATUS_LABEL[estado]). */
export const STATUS_LABEL: Record<SimilarityStatus, string> = { clear: tk('Clear'), review: tk('Review'), high: tk('High match') };
export const AI_TONE: Record<AiLevel, Tone> = { Low: 'ok', Moderate: 'warn', Elevated: 'bad' };
