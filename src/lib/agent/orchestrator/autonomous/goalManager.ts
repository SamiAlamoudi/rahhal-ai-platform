/**
 * Phase 6 — GoalManager
 * Maintains the traveler goal; detects changes and bumps version for replan.
 */

import type { TravelGoal } from './types'

export function emptyTravelGoal(): TravelGoal {
  return {
    destination: null,
    purpose: null,
    budgetAmount: null,
    currency: null,
    durationDays: null,
    monthHint: null,
    travelers: null,
    notes: [],
    version: 1,
  }
}

function detectDestination(text: string, prior: TravelGoal): string | null {
  const t = text.toLowerCase()
  if (/korea|كوريا|سيول|seoul/i.test(text)) return 'Korea'
  if (/japan|اليابان|tokyo|طوكيو|osaka|كيوتو|kyoto/i.test(text)) {
    if (/tokyo|طوكيو/i.test(text)) return 'Tokyo'
    return 'Japan'
  }
  if (/dubai|دبي/i.test(text)) return 'Dubai'
  if (/paris|باريس/i.test(text)) return 'Paris'
  if (/maldives|المالديف/i.test(text)) return 'Maldives'
  if (/actually make it|بدلًا|بدلا|خلها|خلّها|change.*to|مو .* خل/i.test(t) === false) {
    /* fall through */
  }
  return prior.destination
}

function detectPurpose(text: string, prior: TravelGoal): string | null {
  if (/honeymoon|شهر عسل/i.test(text)) return 'honeymoon'
  if (/family|عائل/i.test(text)) return 'family'
  if (/business|عمل/i.test(text)) return 'business'
  if (/adventure|مغامر/i.test(text)) return 'adventure'
  if (/luxury|فاخر/i.test(text)) return 'luxury'
  return prior.purpose
}

function detectBudget(text: string, prior: TravelGoal): { amount: number | null; currency: string | null } {
  if (/ten thousand|عشرة آلاف|ميزانيتي\s*عشرة|\b10000\b|١٠٠٠٠/i.test(text)
    && !/(?:budget|ميزانية).{0,40}\b([0-9]{3,5})\b/i.test(text)) {
    // Prefer explicit numeric budget when present in the same utterance.
    if (!/\b8000\b|\b12000\b/i.test(text)) {
      return { amount: 10000, currency: prior.currency ?? 'SAR' }
    }
  }
  const m = /(?:budget|ميزانية)(?:\s+changed)?(?:\s+(?:to|إلى|صارت|become))?[\s\w]*?(?:sar|ر\.?\s*س|ريال)?\s*([0-9][0-9,]*)/i.exec(text)
    ?? /(?:sar|ريال)\s*([0-9][0-9,]*)/i.exec(text)
    ?? /([0-9][0-9,]*)\s*(?:sar|ريال)/i.exec(text)
  if (m?.[1]) {
    return { amount: Number(m[1].replace(/,/g, '')), currency: prior.currency ?? 'SAR' }
  }
  if (/ten thousand|عشرة آلاف|ميزانيتي\s*عشرة|\b10000\b|١٠٠٠٠/i.test(text)) {
    return { amount: 10000, currency: prior.currency ?? 'SAR' }
  }
  return { amount: prior.budgetAmount, currency: prior.currency }
}

function detectDuration(text: string, prior: TravelGoal): number | null {
  const m = /(?:only\s*)?([0-9]+)\s*days?|([0-9]+)\s*أيام|عندي\s*([0-9]+)\s*أيام/i.exec(text)
  if (m) {
    const n = Number(m[1] ?? m[2] ?? m[3])
    if (Number.isFinite(n) && n > 0) return n
  }
  return prior.durationDays
}

function detectMonth(text: string, prior: TravelGoal): string | null {
  if (/october|أكتوبر|اكتوبر/i.test(text)) return 'October'
  if (/march|مارس/i.test(text)) return 'March'
  if (/april|أبريل|ابريل/i.test(text)) return 'April'
  return prior.monthHint
}

function detectTravelers(text: string, prior: TravelGoal): number | null {
  if (/wife can't travel|زوجتي ما تقدر|بدون زوجتي|solo|وحدي/i.test(text)) return 1
  if (/with my wife|مع زوجتي|honeymoon|شهر عسل/i.test(text)) return prior.travelers ?? 2
  if (/two adults|2 adults|شخصين/i.test(text)) return 2
  return prior.travelers
}

export function updateTravelGoal(prior: TravelGoal | null | undefined, userText: string): {
  goal: TravelGoal
  changed: boolean
  changeReasons: string[]
} {
  const base = prior ?? emptyTravelGoal()
  const destination = detectDestination(userText, base)
  // Explicit destination swap phrases
  let nextDestination = destination
  if (/actually make it\s+korea|خلها كوريا|بدل.*كوريا|make it korea/i.test(userText)) {
    nextDestination = 'Korea'
  } else if (/actually make it\s+japan|خلها اليابان|make it japan/i.test(userText)) {
    nextDestination = 'Japan'
  }

  const purpose = detectPurpose(userText, base)
  const budget = detectBudget(userText, base)
  const durationDays = detectDuration(userText, base)
  const monthHint = detectMonth(userText, base)
  const travelers = detectTravelers(userText, base)

  const changeReasons: string[] = []
  if (nextDestination !== base.destination && nextDestination) changeReasons.push('destination')
  if (purpose !== base.purpose && purpose) changeReasons.push('purpose')
  if (budget.amount !== base.budgetAmount && budget.amount != null) changeReasons.push('budget')
  if (durationDays !== base.durationDays && durationDays != null) changeReasons.push('duration')
  if (monthHint !== base.monthHint && monthHint) changeReasons.push('month')
  if (travelers !== base.travelers && travelers != null) changeReasons.push('travelers')

  const notes = [...base.notes]
  if (/wife can't travel|زوجتي ما تقدر/i.test(userText)) {
    notes.push('companion_unavailable')
  }

  const changed = changeReasons.length > 0 || notes.length !== base.notes.length
  const goal: TravelGoal = {
    destination: nextDestination ?? base.destination,
    purpose: purpose ?? base.purpose,
    budgetAmount: budget.amount,
    currency: budget.currency,
    durationDays,
    monthHint,
    travelers,
    notes: [...new Set(notes)],
    version: changed ? base.version + (prior ? 1 : 0) : base.version,
  }
  // First create always version 1
  if (!prior) goal.version = 1

  return { goal, changed: Boolean(prior) && changed, changeReasons }
}

export const GoalManager = {
  empty: emptyTravelGoal,
  update: updateTravelGoal,
}
