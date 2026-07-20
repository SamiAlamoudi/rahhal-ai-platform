/**
 * Consultant-style reasoning replies (AR/EN).
 * Feels like an AI travel advisor proposing options — not a form.
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

  blocks.push(opening(locale, result, requirements))

  const rows = [result.primary, ...result.alternatives].filter(
    (row): row is DestinationCandidate => Boolean(row),
  )

  if (rows.length > 0) {
    blocks.push(locale === 'ar' ? 'ترشيحاتي:' : 'My recommendations:')
    rows.forEach((row, index) => {
      blocks.push(formatCandidate(locale, row, index + 1))
    })
  }

  if (result.rationale.length > 0) {
    blocks.push('')
    blocks.push(locale === 'ar' ? 'لماذا هذه الخيارات؟' : 'Why these options?')
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
      ? 'أي وجهة نثبّتها؟ قل الاسم أو «الأولى»، وأبني لك خطة كاملة.'
      : 'Which destination should we lock? Say the name or “the first one”, and I will build a full plan.')
  }

  return blocks.filter(Boolean).join('\n')
}

function opening(
  locale: AgentLocale,
  _result: TravelReasoningResult,
  requirements: TripRequirements,
): string {
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
      ? `فهمت طلبك (${bits.join(' · ')}). بحثت عن وجهات تناسبك بدون ما أطلب منك تعبئة نموذج.`
      : 'خلّني أفكر كمستشار سفر وأقترح وجهات مناسبة.'
  }
  return bits.length
    ? `Understood (${bits.join(' · ')}). I reasoned through destinations that fit — no form filling.`
    : 'Let me think like a travel consultant and suggest fitting destinations.'
}

function formatCandidate(locale: AgentLocale, row: DestinationCandidate, index: number): string {
  const title = locale === 'ar' ? row.nameAr : row.name
  const why = row.whySelected[0]
  const cost = row.estimatedTripCostSar != null
    ? (locale === 'ar'
      ? `تقدير ≈ ${row.estimatedTripCostSar} ر.س`
      : `est. ≈ ${row.estimatedTripCostSar} SAR`)
    : null
  const visa = row.visa !== 'unknown'
    ? (locale === 'ar' ? `تأشيرة: ${row.visa}` : `visa: ${row.visa}`)
    : null
  const pros = row.pros[0]
  const cons = row.cons[0]

  const parts = [
    `${index}) ${title}`,
    why,
    cost,
    visa,
    pros ? (locale === 'ar' ? `إيجابي: ${pros}` : `pro: ${pros}`) : null,
    cons ? (locale === 'ar' ? `تنبيه: ${cons}` : `note: ${cons}`) : null,
  ].filter(Boolean)

  return parts.join(' — ')
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
          ? 'كم يوم تتخيّل للرحلة؟ (مثلاً 5–7 أيام تناسب هذا النوع من الميزانيات)'
          : 'How many days are you imagining? (5–7 often fits this budget band)'
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
      ? `حتى أضبط الترشيح: ${questions[0]}`
      : `To fine-tune this: ${questions[0]}`
  }
  return [
    locale === 'ar' ? 'سؤالان سريعان قبل ما نثبّت الوجهة:' : 'Two quick questions before we lock a destination:',
    ...questions.map((q) => `• ${q}`),
  ].join('\n')
}
