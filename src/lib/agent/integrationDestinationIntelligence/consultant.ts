/**
 * Integration Sprint 5 — natural consultant summaries (never encyclopedic dumps).
 */

import type { DestinationIntelligenceResult, DestinationRecommendation } from './types'

function tipLine(rec: DestinationRecommendation, locale: 'ar' | 'en'): string {
  if (locale === 'ar') {
    const tip = rec.knowledge.hiddenTipsAr[0]
    const avoid = rec.knowledge.touristTrapAvoidAr[0]
    return [tip ? `نصيحة: ${tip}` : null, avoid ? `تجنّب: ${avoid}` : null]
      .filter(Boolean)
      .join(' · ')
  }
  const tip = rec.knowledge.hiddenTipsEn[0]
  const avoid = rec.knowledge.touristTrapAvoidEn[0]
  return [tip ? `Tip: ${tip}` : null, avoid ? `Avoid: ${avoid}` : null]
    .filter(Boolean)
    .join(' · ')
}

export function buildDestinationConsultantSummary(
  result: Pick<
    DestinationIntelligenceResult,
    'mode' | 'primary' | 'alternatives' | 'comparison' | 'queryThemes'
  >,
  _locale: 'ar' | 'en' = 'ar',
): { ar: string; en: string } {
  if (result.mode === 'compare' && result.comparison) {
    const c = result.comparison
    const en = [
      `${c.left.knowledge.nameEn} vs ${c.right.knowledge.nameEn}:`,
      c.differencesEn[0],
      c.verdictEn,
    ].join(' ')
    const ar = [
      `${c.left.knowledge.nameAr} مقابل ${c.right.knowledge.nameAr}:`,
      c.differencesAr[0],
      c.verdictAr,
    ].join(' ')
    return { ar, en }
  }

  const primary = result.primary
  if (!primary) {
    return {
      ar: 'أخبرني بميزانيتك أو نوع الرحلة (عائلة، أعمال، شاطئ…) لأقترح وجهة مناسبة.',
      en: 'Tell me your budget or trip style (family, business, beach…) and I will suggest a fit.',
    }
  }

  const alt = result.alternatives[0]
  const weatherAr = primary.weather.readinessAr
  const weatherEn = primary.weather.readinessEn
  const costAr = primary.cost.explanationAr.split('·')[0]?.trim() ?? ''
  const costEn = primary.cost.explanationEn.split('·')[0]?.trim() ?? ''

  const enParts = [
    `I’d start with ${primary.knowledge.nameEn} — ${primary.whyEn}`,
    `Weather: ${weatherEn}`,
    costEn,
    tipLine(primary, 'en'),
    alt
      ? `Alternative: ${alt.knowledge.nameEn} if you want a different tone (${alt.score}/100).`
      : null,
  ].filter(Boolean)

  const arParts = [
    `أقترح نبدأ بـ ${primary.knowledge.nameAr} — ${primary.whyAr}`,
    `الطقس: ${weatherAr}`,
    costAr,
    tipLine(primary, 'ar'),
    alt
      ? `بديل: ${alt.knowledge.nameAr} إذا أردت نبرة مختلفة (${alt.score}/100).`
      : null,
  ].filter(Boolean)

  return {
    ar: arParts.join(' '),
    en: enParts.join(' '),
  }
}
