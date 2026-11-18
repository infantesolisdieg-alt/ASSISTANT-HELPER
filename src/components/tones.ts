import type { AiLevel, SimilarityStatus } from '../analysis/types';
import type { Tone } from './charts';

export const STATUS_TONE: Record<SimilarityStatus, Tone> = { clear: 'ok', review: 'warn', high: 'bad' };
export const STATUS_LABEL: Record<SimilarityStatus, string> = { clear: 'Clear', review: 'Review', high: 'High match' };
export const AI_TONE: Record<AiLevel, Tone> = { Low: 'ok', Moderate: 'warn', Elevated: 'bad' };
