/**
 * User-facing AI progress steps — never chain-of-thought.
 */

export type ThinkingStepId =
  | 'searching_flights'
  | 'comparing_hotels'
  | 'checking_weather'
  | 'finding_offers'
  | 'building_itinerary'
  | 'crafting_reply'

export interface ThinkingStep {
  id: ThinkingStepId
  labelAr: string
  labelEn: string
}

export const THINKING_STEPS: readonly ThinkingStep[] = [
  {
    id: 'searching_flights',
    labelAr: 'أبحث عن أفضل الرحلات…',
    labelEn: 'Searching flights…',
  },
  {
    id: 'comparing_hotels',
    labelAr: 'أقارن الفنادق…',
    labelEn: 'Comparing hotels…',
  },
  {
    id: 'checking_weather',
    labelAr: 'أتحقق من الطقس…',
    labelEn: 'Checking weather…',
  },
  {
    id: 'finding_offers',
    labelAr: 'أبحث عن أفضل العروض…',
    labelEn: 'Finding best offers…',
  },
  {
    id: 'building_itinerary',
    labelAr: 'أبني خطة الرحلة…',
    labelEn: 'Building itinerary…',
  },
  {
    id: 'crafting_reply',
    labelAr: 'أصيغ توصيتي لك…',
    labelEn: 'Preparing your recommendation…',
  },
] as const

/** Pick progressive steps from user/assistant text hints (friendly only). */
export function selectThinkingSteps(seedText: string): ThinkingStep[] {
  const text = seedText.toLowerCase()
  const picked: ThinkingStep[] = []
  const take = (id: ThinkingStepId) => {
    const step = THINKING_STEPS.find((s) => s.id === id)
    if (step && !picked.some((p) => p.id === id)) picked.push(step)
  }

  if (/flight|طيران|رحلة|ticket|تذكر/.test(text)) take('searching_flights')
  if (/hotel|فندق|إقامة|stay/.test(text)) take('comparing_hotels')
  if (/weather|طقس|climate/.test(text)) take('checking_weather')
  if (/budget|ميزانية|offer|عرض|price|سعر/.test(text)) take('finding_offers')
  if (/itinerary|خطة|plan|أيام|days/.test(text)) take('building_itinerary')

  if (picked.length === 0) {
    take('searching_flights')
    take('comparing_hotels')
    take('finding_offers')
    take('building_itinerary')
  }
  take('crafting_reply')
  return picked
}

export function thinkingLabel(step: ThinkingStep, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? step.labelAr : step.labelEn
}
