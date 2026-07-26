/**
 * User-facing AI progress — natural consultant feedback (never chain-of-thought).
 */

export type ThinkingStepId =
  | 'considering_options'
  | 'comparing_destinations'
  | 'reviewing_budget'
  | 'checking_pace'
  | 'shaping_stay'
  | 'crafting_reply'

export interface ThinkingStep {
  id: ThinkingStepId
  labelAr: string
  labelEn: string
}

export const THINKING_STEPS: readonly ThinkingStep[] = [
  {
    id: 'considering_options',
    labelAr: 'أفكر في أفضل الخيارات…',
    labelEn: 'Thinking through the best options…',
  },
  {
    id: 'comparing_destinations',
    labelAr: 'أقارن بين الوجهات…',
    labelEn: 'Comparing destinations…',
  },
  {
    id: 'reviewing_budget',
    labelAr: 'أراجع الميزانية…',
    labelEn: 'Reviewing the budget…',
  },
  {
    id: 'checking_pace',
    labelAr: 'أضبط إيقاع الرحلة…',
    labelEn: 'Tuning the pace of the trip…',
  },
  {
    id: 'shaping_stay',
    labelAr: 'أختار إقامة تناسب أسلوبك…',
    labelEn: 'Shaping a stay that fits your style…',
  },
  {
    id: 'crafting_reply',
    labelAr: 'أجهّز توصيتي لك…',
    labelEn: 'Preparing my recommendation…',
  },
] as const

/** Pick progressive consultant steps from user/assistant text hints. */
export function selectThinkingSteps(seedText: string): ThinkingStep[] {
  const text = seedText.toLowerCase()
  const picked: ThinkingStep[] = []
  const take = (id: ThinkingStepId) => {
    const step = THINKING_STEPS.find((s) => s.id === id)
    if (step && !picked.some((p) => p.id === id)) picked.push(step)
  }

  take('considering_options')
  if (/morocco|japan|italy|spain|dubai|paris|tokyo|مراكش|المغرب|اليابان|باريس|دبي|وجهة|destination/.test(text)) {
    take('comparing_destinations')
  }
  if (/budget|ميزانية|ريال|sar|usd|\$|price|سعر/.test(text)) take('reviewing_budget')
  if (/beach|بحر|شاطئ|quiet|هدوء|family|عائلت|honeymoon|شهر/.test(text)) take('checking_pace')
  if (/hotel|فندق|إقامة|stay|resort/.test(text)) take('shaping_stay')

  if (picked.length === 1) {
    take('comparing_destinations')
    take('reviewing_budget')
  }
  take('crafting_reply')
  return picked
}

export function thinkingLabel(step: ThinkingStep, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? step.labelAr : step.labelEn
}
