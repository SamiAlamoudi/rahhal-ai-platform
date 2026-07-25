/**
 * Evolution Sprint 8 — strategy narrative formatter (templates only, no LLM).
 */

import type { StrategyLocale, TravelStrategyOption, TravelStrategyResult } from './strategyTypes'

function isAr(locale: StrategyLocale): boolean {
  return locale !== 'en'
}

export function formatStrategyBrief(option: TravelStrategyOption, locale: StrategyLocale): string {
  const ar = isAr(locale)
  const conf = `${Math.round(option.confidence * 100)}%`
  if (ar) {
    return `${option.title}: ${option.summary} (ثقة ${conf})`
  }
  return `${option.title}: ${option.summary} (confidence ${conf})`
}

export function formatStrategyResult(result: TravelStrategyResult): {
  locale: StrategyLocale
  headline: string
  primaryBrief: string
  alternativeBriefs: string[]
  clarification: string[]
} {
  const ar = isAr(result.locale)
  return {
    locale: result.locale,
    headline:
      result.action === 'collect_information'
        ? (ar ? 'اجمع معلومات قبل اعتماد استراتيجية السفر' : 'Collect information before locking a travel strategy')
        : (ar ? 'استراتيجية سفر مقترحة' : 'Proposed travel strategy'),
    primaryBrief: formatStrategyBrief(result.primary, result.locale),
    alternativeBriefs: result.alternatives.map((a) => formatStrategyBrief(a, result.locale)),
    clarification: result.suggestedClarification,
  }
}

export const StrategyFormatter = {
  brief: formatStrategyBrief,
  result: formatStrategyResult,
}
