/**
 * Phase 3 Stage 3 — Build read-only proactive context from prior-layer bags.
 * Never mutates inputs.
 */

import type { ProactiveAdvisorInput, ProactiveContextBag, ProactiveLocale } from './types'
import { uniqueStrings } from './types'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function pickDestination(parts: Array<string | null | undefined>): string | null {
  for (const p of parts) {
    if (p && p.trim()) return p.trim()
  }
  return null
}

export function buildProactiveContext(
  input: ProactiveAdvisorInput,
): ProactiveContextBag {
  const locale: ProactiveLocale = input.locale === 'en' ? 'en' : 'ar'
  const userText = input.userText.trim()
  const lower = userText.toLowerCase()

  const memory = asRecord(input.memoryContext)
  const req = asRecord(memory?.requirements) ?? asRecord(input.memoryContext)
  const multi = asRecord(input.multiTurnSnapshot)
  const traveler = asRecord(input.travelerUnderstanding)
  const destination = asRecord(input.destinationUnderstanding)
  const strategy = asRecord(input.strategySummary)
  const unified = asRecord(input.unifiedResponse)
  const unifiedBody = asRecord(unified?.body)

  const dest = pickDestination([
    str(multi?.tripGoal)?.replace(/^trip:/i, ''),
    str(asRecord(multi)?.destination as unknown),
    str(req?.destination),
    strList(req?.destinations)[0],
    str(destination?.name),
    str(destination?.destination),
    extractDestinationHint(userText),
  ])

  const budgetAmount =
    num(req?.budgetAmount)
    ?? num(strategy?.budgetAmount)
    ?? extractBudget(userText)

  const durationDays =
    num(req?.durationDays)
    ?? num(strategy?.durationDays)
    ?? extractDays(userText)

  const adults =
    num(req?.travelers)
    ?? num(req?.adults)
    ?? num(traveler?.adults)

  const children = num(req?.children) ?? num(traveler?.children)
  const monthHint = num(req?.monthHint) ?? num(strategy?.monthHint) ?? extractMonth(userText)
  const tripPurpose =
    str(req?.tripPurpose)
    ?? str(req?.travelerType)
    ?? str(traveler?.tripPurpose)
    ?? null

  const interests = uniqueStrings([
    ...strList(req?.interests),
    ...strList(traveler?.interests),
  ])

  const hasFamilySignal =
    (children != null && children > 0)
    || /\b(family|kids?|children|toddler)\b/i.test(lower)
    || /عائل|أطفال|طفل/.test(userText)
    || /family/i.test(tripPurpose ?? '')

  const hasBusinessSignal =
    /\b(business|meeting|conference|client|executive|work trip)\b/i.test(lower)
    || /عمل|اجتماع|مؤتمر|رجال أعمال/.test(userText)
    || /business/i.test(tripPurpose ?? '')

  const hasAccessibilitySignal =
    /\b(wheelchair|accessibility|accessible|mobility)\b/i.test(lower)
    || /كرسي متحرك|إتاحة|وصولية|إعاقة/.test(userText)

  const hasDatesSignal =
    durationDays != null
    || monthHint != null
    || /\b(in \w+|april|may|june|july|august|september|october|november|december|january|february|march|\d{1,2}\s*days?)\b/i.test(
      lower,
    )
    || /أيام|ليلة|في\s+\w+|أبريل|مايو|يونيو|يوليو/.test(userText)

  const hasBudgetSignal =
    budgetAmount != null
    || /\b(budget|sar|usd|eur|\d{3,7})\b/i.test(lower)
    || /ميزانية|ريال/.test(userText)

  const hasDestinationSignal = Boolean(dest)

  return {
    locale,
    conversationId: input.conversationId.trim() || 'conversation',
    userText,
    destination: dest,
    origin: str(req?.origin) ?? str(traveler?.origin) ?? null,
    budgetAmount,
    budgetCurrency: str(req?.budgetCurrency) ?? str(strategy?.budgetCurrency) ?? null,
    durationDays,
    adults,
    children,
    monthHint,
    tripPurpose,
    interests,
    travelerNotes: strList(traveler?.notes).concat(strList(traveler?.summary)),
    destinationNotes: strList(destination?.notes).concat(strList(destination?.summary)),
    strategyNotes: strList(strategy?.notes).concat(strList(strategy?.summary)),
    unifiedSummary: strList(unifiedBody?.executiveSummary).concat(
      strList(unifiedBody?.primaryRecommendation),
    ),
    hasFamilySignal: Boolean(hasFamilySignal),
    hasBusinessSignal,
    hasAccessibilitySignal,
    hasDatesSignal,
    hasBudgetSignal,
    hasDestinationSignal,
  }
}

function extractDestinationHint(text: string): string | null {
  const map: Array<{ re: RegExp; name: string }> = [
    { re: /japan|اليابان/i, name: 'Japan' },
    { re: /bali|بالي/i, name: 'Bali' },
    { re: /paris|باريس/i, name: 'Paris' },
    { re: /dubai|دبي/i, name: 'Dubai' },
    { re: /london|لندن/i, name: 'London' },
    { re: /turkey|تركيا|istanbul|إسطنبول/i, name: 'Turkey' },
    { re: /maldives|المالديف/i, name: 'Maldives' },
  ]
  for (const row of map) {
    if (row.re.test(text)) return row.name
  }
  return null
}

function extractBudget(text: string): number | null {
  const m =
    text.match(/(\d{3,7})\s*(sar|usd|eur|ريال)/i)
    ?? text.match(/(?:budget|ميزانية)\D{0,12}(\d{3,7})/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

function extractDays(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*(?:days?|day|أيام|يوم|ليال[يى]|ليلة)/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 && n <= 60 ? n : null
}

function extractMonth(text: string): number | null {
  const months: Array<{ re: RegExp; month: number }> = [
    { re: /\bjan(uary)?\b|يناير/i, month: 1 },
    { re: /\bfeb(ruary)?\b|فبراير/i, month: 2 },
    { re: /\bmar(ch)?\b|مارس/i, month: 3 },
    { re: /\bapr(il)?\b|أبريل|ابريل/i, month: 4 },
    { re: /\bmay\b|مايو/i, month: 5 },
    { re: /\bjun(e)?\b|يونيو/i, month: 6 },
    { re: /\bjul(y)?\b|يوليو/i, month: 7 },
    { re: /\baug(ust)?\b|أغسطس|اغسطس/i, month: 8 },
    { re: /\bsep(t(ember)?)?\b|سبتمبر/i, month: 9 },
    { re: /\boct(ober)?\b|أكتوبر|اكتوبر/i, month: 10 },
    { re: /\bnov(ember)?\b|نوفمبر/i, month: 11 },
    { re: /\bdec(ember)?\b|ديسمبر/i, month: 12 },
  ]
  for (const row of months) {
    if (row.re.test(text)) return row.month
  }
  return null
}

export const ProactiveContext = {
  build: buildProactiveContext,
}
