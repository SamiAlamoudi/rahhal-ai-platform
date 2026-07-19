/**
 * Suggested conversation prompts — open AI chat immediately.
 */

import type { HomeLocale, SuggestedPrompt, SuggestedPromptId } from './types'

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    id: 'weekend',
    icon: '✈️',
    labelAr: 'سفر نهاية الأسبوع',
    labelEn: 'Travel next weekend',
    promptAr: 'أريد السفر نهاية الأسبوع القادم.',
    promptEn: 'I want to travel next weekend.',
  },
  {
    id: 'cheap_europe',
    icon: '🌍',
    labelAr: 'أرخص رحلات لأوروبا',
    labelEn: 'Cheapest flights to Europe',
    promptAr: 'ابحث عن أرخص الرحلات إلى أوروبا.',
    promptEn: 'Find the cheapest flights to Europe.',
  },
  {
    id: 'honeymoon',
    icon: '🏖',
    labelAr: 'شهر عسل',
    labelEn: 'Plan a honeymoon',
    promptAr: 'خطط لي شهر عسل رومانسي.',
    promptEn: 'Plan a honeymoon.',
  },
  {
    id: 'family',
    icon: '👨‍👩‍👧',
    labelAr: 'إجازة عائلية',
    labelEn: 'Family vacation',
    promptAr: 'أريد إجازة عائلية مناسبة للأطفال.',
    promptEn: 'I want a family vacation.',
  },
  {
    id: 'business',
    icon: '💼',
    labelAr: 'رحلة عمل',
    labelEn: 'Business trip',
    promptAr: 'أحتاج رحلة عمل سريعة.',
    promptEn: 'I need a business trip.',
  },
  {
    id: 'continue_booking',
    icon: '🎫',
    labelAr: 'متابعة حجزي',
    labelEn: 'Continue my booking',
    promptAr: 'أريد متابعة حجزي الحالي.',
    promptEn: 'Continue my booking.',
    resumeBooking: true,
  },
  {
    id: 'tokyo',
    icon: '🗼',
    labelAr: 'طوكيو',
    labelEn: 'Tokyo',
    promptAr: 'أريد السفر إلى طوكيو.',
    promptEn: 'I want to travel to Tokyo.',
  },
  {
    id: 'budget_5000',
    icon: '💰',
    labelAr: 'ميزانية ٥٠٠٠ ر.س',
    labelEn: '5000 SAR budget',
    promptAr: 'ميزانيتي ٥٠٠٠ ريال سعودي.',
    promptEn: 'I have 5000 SAR.',
  },
  {
    id: 'dubai_business',
    icon: '🏙️',
    labelAr: 'عمل في دبي',
    labelEn: 'Business in Dubai',
    promptAr: 'رحلة عمل إلى دبي.',
    promptEn: 'Business trip to Dubai.',
  },
]

export function listSuggestedPrompts(opts?: {
  includeContinue?: boolean
  limit?: number
}): SuggestedPrompt[] {
  const includeContinue = opts?.includeContinue ?? true
  let list = SUGGESTED_PROMPTS
  if (!includeContinue) {
    list = list.filter((p) => !p.resumeBooking)
  }
  if (opts?.limit != null) list = list.slice(0, opts.limit)
  return list
}

export function getSuggestedPrompt(id: SuggestedPromptId): SuggestedPrompt | null {
  return SUGGESTED_PROMPTS.find((p) => p.id === id) ?? null
}

export function promptText(prompt: SuggestedPrompt, locale: HomeLocale): string {
  return locale === 'ar' ? prompt.promptAr : prompt.promptEn
}

export function promptLabel(prompt: SuggestedPrompt, locale: HomeLocale): string {
  return locale === 'ar' ? prompt.labelAr : prompt.labelEn
}
