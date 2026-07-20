/**
 * Consultant-style reasoning replies (AR/EN).
 * Warm, confident travel-advisor voice — not a form or raw data dump.
 */

import type { AgentLocale, TripRequirements } from '../types'
import type { DestinationCandidate, TravelReasoningResult } from './types'

export function formatReasoningReply(input: {
  result: TravelReasoningResult
  requirements: TripRequirements
}): string {
  const { result, requirements } = input
  const locale = result.locale
  const blocks: string[] = []

  blocks.push(opening(locale, requirements))

  const rows = [result.primary, ...result.alternatives].filter(
    (row): row is DestinationCandidate => Boolean(row),
  )

  if (rows.length > 0) {
    blocks.push('')
    blocks.push(locale === 'ar' ? 'ترشيحاتي كمستشار سفر:' : 'My picks as your travel consultant:')
    rows.forEach((row, index) => {
      blocks.push('')
      blocks.push(formatCandidate(locale, row, index + 1))
    })
  }

  if (result.rationale.length > 0) {
    blocks.push('')
    blocks.push(locale === 'ar' ? 'كيف فكّرت فيها؟' : 'How I reasoned about this:')
    for (const line of result.rationale.slice(0, 4)) {
      blocks.push(`• ${line}`)
    }
  }

  const followUp = followUpBlock(locale, result.followUpFields, requirements)
  if (followUp) {
    blocks.push('')
    blocks.push(followUp)
  } else {
    blocks.push('')
    blocks.push(locale === 'ar'
      ? 'أي وجهة نثبّتها؟ قل الاسم أو «الأولى» — وأبني لك خطة كاملة مع الطيران والفنادق.'
      : 'Which destination should we lock? Say the name or “the first one” — I will build a full plan with flights and hotels.')
  }

  return blocks.filter(Boolean).join('\n')
}

function opening(locale: AgentLocale, requirements: TripRequirements): string {
  const bits: string[] = []
  if (requirements.weatherPreference) {
    bits.push(locale === 'ar'
      ? `طقس ${requirements.weatherPreference}`
      : `${requirements.weatherPreference} weather`)
  }
  if (requirements.budgetAmount != null) {
    bits.push(locale === 'ar'
      ? `ميزانية ≈ ${requirements.budgetAmount} ${requirements.budgetCurrency || 'SAR'}`
      : `budget ≈ ${requirements.budgetAmount} ${requirements.budgetCurrency || 'SAR'}`)
  }
  if (requirements.startDate) {
    bits.push(locale === 'ar' ? `حوالي ${requirements.startDate}` : `around ${requirements.startDate}`)
  }

  if (locale === 'ar') {
    return bits.length
      ? `تمام — فهمت (${bits.join(' · ')}). رتّبت لك وجهات مناسبة مع الطقس والميزانية والتأشيرة — بدون أي نموذج.`
      : 'خلّني أفكّر كمستشار سفر وأقترح وجهات تناسبك.'
  }
  return bits.length
    ? `Got it (${bits.join(' · ')}). I ranked destinations for climate, budget, and visa fit — no forms, just options.`
    : 'Let me think like your travel consultant and short-list fitting destinations.'
}

function formatCandidate(locale: AgentLocale, row: DestinationCandidate, index: number): string {
  const title = locale === 'ar' ? row.nameAr : row.name
  const lines: string[] = [
    locale === 'ar' ? `${index}) ${title}` : `${index}) ${title}`,
  ]

  if (row.whySelected[0]) {
    lines.push(`   ${locale === 'ar' ? 'لماذا' : 'Why'}: ${row.whySelected[0]}`)
  }

  if (row.estimatedTripCostSar != null) {
    lines.push(locale === 'ar'
      ? `   تقدير الرحلة: ≈ ${row.estimatedTripCostSar} ر.س`
      : `   Trip estimate: ≈ ${row.estimatedTripCostSar} SAR`)
  }

  if (row.visaGuidance) {
    lines.push(`   ${locale === 'ar' ? 'التأشيرة' : 'Visa'}: ${row.visaGuidance.summary}`)
    if (row.visaGuidance.processingDays) {
      lines.push(locale === 'ar'
        ? `   المدة: ${row.visaGuidance.processingDays}`
        : `   Timing: ${row.visaGuidance.processingDays}`)
    }
  }

  if (row.advisoryNotes[0]) {
    lines.push(`   ${locale === 'ar' ? 'تنبيه' : 'Advisory'}: ${row.advisoryNotes[0]}`)
  }

  if (row.pros[0]) {
    lines.push(`   ${locale === 'ar' ? 'إيجابي' : 'Plus'}: ${row.pros[0]}`)
  }
  if (row.cons[0]) {
    lines.push(`   ${locale === 'ar' ? 'انتبه' : 'Watch'}: ${row.cons[0]}`)
  }

  return lines.join('\n')
}

function followUpBlock(
  locale: AgentLocale,
  fields: Array<keyof TripRequirements>,
  requirements: TripRequirements,
): string | null {
  if (fields.length === 0) return null
  const questions = fields.slice(0, 2).map((field) => {
    switch (field) {
      case 'durationDays':
        return locale === 'ar'
          ? 'كم يوم تتخيّل؟ (5–7 أيام غالباً مناسبة لهذا النوع من الرحلات)'
          : 'How many days are you imagining? (5–7 often works for this kind of trip)'
      case 'travelers':
        return locale === 'ar' ? 'كم عدد المسافرين؟' : 'How many travelers?'
      case 'travelerType':
        return locale === 'ar'
          ? 'سفر فردي، زوجين، عائلة، أصدقاء، أم عمل؟'
          : 'Solo, couple, family, friends, or business?'
      default:
        return locale === 'ar' ? 'هل توضّح هذا التفصيل؟' : 'Could you clarify that detail?'
    }
  })

  void requirements
  if (questions.length === 1) {
    return locale === 'ar'
      ? `سؤال واحد فقط قبل ما نثبّت: ${questions[0]}`
      : `One quick question before we lock in: ${questions[0]}`
  }
  return [
    locale === 'ar' ? 'سؤالان سريعان قبل ما نثبّت الوجهة:' : 'Two quick questions before we lock a destination:',
    ...questions.map((q) => `• ${q}`),
  ].join('\n')
}
