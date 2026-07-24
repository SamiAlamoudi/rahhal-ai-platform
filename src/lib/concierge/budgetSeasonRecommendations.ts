/**
 * AI Concierge Sprint 1 — budget + season destination framing.
 *
 * Reuses Travel Reasoning + DESTINATION_CATALOG. Does not invent destinations
 * or silently invent traveler counts for traveler-facing copy.
 */

import { runTravelReasoning } from '../agent/reasoning'
import type { AgentLocale, TripRequirements } from '../agent/types'

export type BudgetSeasonRecommendation = {
  valueBrief: string[]
  framingNote: string
  preferenceQuestion: string
  /** Consultant confidence for this beat (drives ask vs recommend). */
  confidence: 'high' | 'medium' | 'low'
  rationale: string
}

/**
 * When destination is unknown but budget + timing exist, lead with ranked
 * catalog destinations instead of asking "Where do you want to go?"
 */
export function recommendDestinationsForBudgetSeason(input: {
  requirements: TripRequirements
  locale: AgentLocale
  userText: string
}): BudgetSeasonRecommendation | null {
  const { requirements: req, locale, userText } = input
  if (req.destination || req.destinations[0]) return null
  const hasBudget = req.budgetAmount != null || req.budgetFlexible === true
  const hasTiming = Boolean(req.startDate || req.endDate || req.durationDays != null)
  if (!hasBudget || !hasTiming) return null

  const reasoning = runTravelReasoning({
    locale,
    requirements: req,
    userText,
    maxResults: 3,
  })

  const picks = [reasoning.primary, ...reasoning.alternatives]
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .slice(0, 3)

  if (picks.length === 0) return null

  const ar = locale === 'ar'
  const valueBrief = picks.map((row) => {
    const why = row.pros[0]
      || row.whySelected.find((line) => !/traveler|مسافر/i.test(line))
      || row.whySelected[0]
      || (ar ? 'قيمة جيدة لهذا الموسم' : 'Strong value for this season')
    const name = ar ? row.nameAr : row.name
    return `${name} — ${why}`
  })

  const amount = req.budgetAmount
  const currency = req.budgetCurrency || (ar ? 'ر.س' : 'SAR')
  const when = formatTiming(req, ar)

  const framingNote = amount != null
    ? (ar
      ? `بميزانية حول ${amount.toLocaleString('en-US')} ${currency} والسفر ${when}، عندك عدة خيارات قوية.`
      : `With a budget around ${amount.toLocaleString('en-US')} ${currency} in ${when}, you have several strong options.`)
    : (ar
      ? `مع مرونة بالميزانية والسفر ${when}، هذه وجهات تعطي أفضل توازن بين الطقس والتكلفة.`
      : `With a flexible budget for ${when}, these destinations balance weather and cost well.`)

  const preferenceQuestion = ar
    ? 'عشان أضيّق التوصيات: بتسافر لوحدك، ولا مع آخرين؟'
    : 'To narrow these recommendations, will you be travelling alone or with others?'

  return {
    valueBrief,
    framingNote,
    preferenceQuestion,
    confidence: 'medium',
    rationale: 'Budget + timing known without destination — recommend catalog destinations before intake.',
  }
}

function formatTiming(req: TripRequirements, ar: boolean): string {
  if (req.startDate) {
    const month = monthLabel(req.startDate, ar)
    if (month) return month
    return ar ? `حوالي ${req.startDate}` : `${req.startDate}`
  }
  if (req.durationDays != null) {
    return ar ? `خلال ${req.durationDays} أيام تقريباً` : `about ${req.durationDays} days`
  }
  return ar ? 'الفترة المذكورة' : 'that window'
}

function monthLabel(isoDate: string, ar: boolean): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate)
  if (!match) return null
  const month = Number(match[2])
  const en = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const arNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ]
  if (month < 1 || month > 12) return null
  return ar ? arNames[month - 1]! : en[month - 1]!
}
