/**
 * Phase 2 — Executive Response Composer.
 * Luxury consultant voice: one-line per destination + optimization follow-up.
 */

import { findDestinationProfile } from '../../agent/reasoning/destinationCatalog'
import type { DestinationCandidate, TravelReasoningResult } from '../../agent/reasoning/types'
import type { AgentLocale, TripRequirements } from '../../agent/types'
import { executiveBudgetLine } from './budgetIntelligence'
import type { ExecutiveContext } from './types'

export function composeExecutiveDiscoveryReply(input: {
  result: TravelReasoningResult
  requirements: TripRequirements
  context: ExecutiveContext
}): string {
  const { result, requirements, context } = input
  const locale = result.locale
  const blocks: string[] = []

  blocks.push(opening(locale, requirements, context))

  const rows = collectShowcaseRows(result, 6)
  if (rows.length > 0) {
    blocks.push('')
    for (const row of rows) {
      blocks.push(formatExecutiveLine(locale, row))
    }
  }

  blocks.push('')
  blocks.push(optimizationFollowUp(locale, context))

  return blocks.filter(Boolean).join('\n')
}

function opening(
  locale: AgentLocale,
  requirements: TripRequirements,
  context: ExecutiveContext,
): string {
  const bits: string[] = []
  if (context.climateHint || requirements.weatherPreference) {
    bits.push(locale === 'ar'
      ? `طقس ${context.climateHint ?? requirements.weatherPreference}`
      : `${context.climateHint ?? requirements.weatherPreference} weather`)
  }
  if (requirements.startDate) {
    bits.push(locale === 'ar' ? `حوالي ${requirements.startDate}` : `around ${requirements.startDate}`)
  } else {
    bits.push(locale === 'ar' ? 'الشهر القادم' : 'next month')
  }

  if (locale === 'ar') {
    return bits.length
      ? `وجدت ${Math.min(6, countCandidates(requirements))} وجهات تناسب تفضيلك (${bits.join(' · ')}).`
      : 'وجدت عدة وجهات تناسبك — هذا ملخص سريع كمستشار سفر:'
  }
  return bits.length
    ? `I found destinations that match your ${bits.join(' · ')} preference.`
    : 'I found several destinations that fit — here is my executive summary:'
}

function countCandidates(_requirements: TripRequirements): number {
  return 6
}

function collectShowcaseRows(
  result: TravelReasoningResult,
  max: number,
): DestinationCandidate[] {
  const rows = [result.primary, ...result.alternatives].filter(
    (row): row is DestinationCandidate => Boolean(row),
  )
  const overBudget = result.rejected.filter((row) => row.budgetFit === 'over')
  const merged = [...rows]
  for (const row of overBudget) {
    if (!merged.some((hit) => hit.id === row.id)) merged.push(row)
  }
  return merged.slice(0, max)
}

function formatExecutiveLine(locale: AgentLocale, row: DestinationCandidate): string {
  const name = locale === 'ar' ? (row.nameAr || row.name) : row.name
  const highlight = pickHighlight(row, locale)
  const budgetLine = executiveBudgetLine(row, locale)
  const visaDelay = visaDelayLine(row, locale)

  if (budgetLine) return `${name} — ${budgetLine}.`
  if (visaDelay) return `${name} — ${visaDelay}.`
  return `${name} — ${highlight}.`
}

function pickHighlight(row: DestinationCandidate, locale: AgentLocale): string {
  const profile = findDestinationProfile(row.id)
  const tags = profile?.bestFor ?? []

  if (tags.includes('culture')) {
    return locale === 'ar' ? 'مثالية للثقافة' : 'ideal for culture'
  }
  if (tags.includes('nature')) {
    return locale === 'ar' ? 'مثالية للطبيعة' : 'ideal for nature'
  }
  if (tags.includes('adventure')) {
    return locale === 'ar' ? 'مثالية للمغامرة' : 'ideal for adventure'
  }
  if (tags.includes('family')) {
    return locale === 'ar' ? 'مناسبة للعائلة' : 'great for families'
  }
  if (tags.includes('beach')) {
    return locale === 'ar' ? 'مثالية للشواطئ' : 'ideal for beaches'
  }

  const why = row.whySelected[0]
  if (why) return why.replace(/^Climate matches.*$/i, locale === 'ar' ? 'طقس مناسب' : 'good climate fit')

  return locale === 'ar' ? 'خيار قوي ضمن معاييرك' : 'a strong fit for your criteria'
}

function visaDelayLine(row: DestinationCandidate, locale: AgentLocale): string | null {
  if (row.visa !== 'embassy') return null
  const risks = row.riskNotes ?? []
  if (risks.some((r) => r.includes('schengen') || r.includes('visa'))) {
    return locale === 'ar' ? 'قد تتأخر التأشيرة' : 'visa delays are likely'
  }
  if (row.visaGuidance?.ease === 'embassy') {
    return locale === 'ar' ? 'تحتاج تأشيرة مسبقة — احجز الموعد مبكراً' : 'has visa delays — book early'
  }
  return null
}

function optimizationFollowUp(locale: AgentLocale, context: ExecutiveContext): string {
  if (context.optimizationAxis === 'scenery') {
    return locale === 'ar'
      ? 'رتّبتها للمناظر. هل نثبّت وجهة أم تفضّل الأنشطة أو التكلفة؟'
      : 'I optimized for scenery. Should we lock one, or re-rank for activities or total cost?'
  }
  if (context.optimizationAxis === 'activities') {
    return locale === 'ar'
      ? 'رتّبتها للأنشطة. هل نثبّت وجهة أم تفضّل المناظر أو التكلفة؟'
      : 'I optimized for activities. Should we lock one, or re-rank for scenery or total cost?'
  }
  if (context.optimizationAxis === 'cost') {
    return locale === 'ar'
      ? 'رتّبتها لأقل تكلفة. هل نثبّت وجهة أم تفضّل المناظر أو الأنشطة؟'
      : 'I optimized for total cost. Should we lock one, or re-rank for scenery or activities?'
  }

  return locale === 'ar'
    ? 'هل تفضّل أن أُحسّن الترتيب للمناظر، الأنشطة، أم التكلفة الإجمالية؟'
    : 'Would you like me to optimize for scenery, activities, or total cost?'
}
