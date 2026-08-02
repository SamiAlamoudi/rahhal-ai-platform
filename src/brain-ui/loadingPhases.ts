import type { BrainLoadingPhase } from './types'

export const BRAIN_LOADING_SEQUENCE: BrainLoadingPhase[] = [
  'thinking',
  'reasoning',
  'planning',
  'comparing',
  'choosing',
  'preparing',
]

export const LOADING_PHASE_LABELS: Record<BrainLoadingPhase, { en: string; ar: string }> = {
  idle: { en: 'Ready', ar: 'جاهز' },
  thinking: { en: 'Thinking…', ar: 'يفكّر…' },
  reasoning: { en: 'Reasoning…', ar: 'يستنتج…' },
  planning: { en: 'Planning…', ar: 'يخطّط…' },
  comparing: { en: 'Comparing…', ar: 'يقارن…' },
  choosing: { en: 'Choosing…', ar: 'يختار…' },
  preparing: { en: 'Preparing recommendation…', ar: 'يجهّز التوصية…' },
}

export function phaseLabel(phase: BrainLoadingPhase, locale: 'ar' | 'en'): string {
  return LOADING_PHASE_LABELS[phase][locale]
}
