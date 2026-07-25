/**
 * Phase 3 Stage 4 — Generate travel alternatives for evaluation.
 * Heuristic candidates only. Never invents real prices or visa outcomes.
 */

import { DEFAULT_MAX_ALTERNATIVES } from './intelligenceRegistry'
import type { IntelligenceContext, TravelAlternative } from './types'
import { clamp01 } from './types'

const PEER_DESTINATIONS: Record<string, string[]> = {
  japan: ['Korea', 'Taiwan'],
  bali: ['Thailand', 'Maldives'],
  paris: ['Italy', 'Spain'],
  dubai: ['Turkey', 'Maldives'],
  london: ['Paris', 'Amsterdam'],
  turkey: ['Georgia', 'Dubai'],
  maldives: ['Bali', 'Dubai'],
}

const PROFILE: Record<
  string,
  Partial<
    Pick<
      TravelAlternative,
      | 'priceSignal'
      | 'convenience'
      | 'visaDifficulty'
      | 'weatherSuitability'
      | 'familyFriendliness'
      | 'businessSuitability'
      | 'accessibility'
    >
  >
> = {
  Japan: {
    priceSignal: 0.72,
    convenience: 0.7,
    visaDifficulty: 0.45,
    weatherSuitability: 0.65,
    familyFriendliness: 0.7,
    businessSuitability: 0.75,
    accessibility: 0.7,
  },
  Korea: {
    priceSignal: 0.62,
    convenience: 0.72,
    visaDifficulty: 0.4,
    weatherSuitability: 0.6,
    familyFriendliness: 0.68,
    businessSuitability: 0.72,
    accessibility: 0.68,
  },
  Taiwan: {
    priceSignal: 0.55,
    convenience: 0.68,
    visaDifficulty: 0.35,
    weatherSuitability: 0.62,
    familyFriendliness: 0.66,
    businessSuitability: 0.6,
    accessibility: 0.65,
  },
  Bali: {
    priceSignal: 0.5,
    convenience: 0.55,
    visaDifficulty: 0.3,
    weatherSuitability: 0.75,
    familyFriendliness: 0.72,
    businessSuitability: 0.35,
    accessibility: 0.45,
  },
  Thailand: {
    priceSignal: 0.42,
    convenience: 0.6,
    visaDifficulty: 0.28,
    weatherSuitability: 0.7,
    familyFriendliness: 0.7,
    businessSuitability: 0.4,
    accessibility: 0.5,
  },
  Maldives: {
    priceSignal: 0.85,
    convenience: 0.5,
    visaDifficulty: 0.25,
    weatherSuitability: 0.8,
    familyFriendliness: 0.55,
    businessSuitability: 0.3,
    accessibility: 0.4,
  },
  Paris: {
    priceSignal: 0.7,
    convenience: 0.75,
    visaDifficulty: 0.55,
    weatherSuitability: 0.55,
    familyFriendliness: 0.65,
    businessSuitability: 0.8,
    accessibility: 0.7,
  },
  Italy: {
    priceSignal: 0.65,
    convenience: 0.68,
    visaDifficulty: 0.55,
    weatherSuitability: 0.7,
    familyFriendliness: 0.68,
    businessSuitability: 0.6,
    accessibility: 0.6,
  },
  Spain: {
    priceSignal: 0.58,
    convenience: 0.7,
    visaDifficulty: 0.55,
    weatherSuitability: 0.75,
    familyFriendliness: 0.72,
    businessSuitability: 0.55,
    accessibility: 0.65,
  },
  Dubai: {
    priceSignal: 0.68,
    convenience: 0.8,
    visaDifficulty: 0.35,
    weatherSuitability: 0.45,
    familyFriendliness: 0.7,
    businessSuitability: 0.85,
    accessibility: 0.75,
  },
  Turkey: {
    priceSignal: 0.48,
    convenience: 0.65,
    visaDifficulty: 0.3,
    weatherSuitability: 0.65,
    familyFriendliness: 0.7,
    businessSuitability: 0.55,
    accessibility: 0.55,
  },
  London: {
    priceSignal: 0.75,
    convenience: 0.78,
    visaDifficulty: 0.6,
    weatherSuitability: 0.45,
    familyFriendliness: 0.68,
    businessSuitability: 0.88,
    accessibility: 0.8,
  },
  Amsterdam: {
    priceSignal: 0.68,
    convenience: 0.76,
    visaDifficulty: 0.55,
    weatherSuitability: 0.5,
    familyFriendliness: 0.7,
    businessSuitability: 0.75,
    accessibility: 0.85,
  },
  Georgia: {
    priceSignal: 0.4,
    convenience: 0.55,
    visaDifficulty: 0.2,
    weatherSuitability: 0.6,
    familyFriendliness: 0.6,
    businessSuitability: 0.4,
    accessibility: 0.45,
  },
}

let seq = 0

export function generateTravelAlternatives(input: {
  context: IntelligenceContext
  candidateDestinations?: string[]
  maxAlternatives?: number
}): TravelAlternative[] {
  const max = input.maxAlternatives ?? DEFAULT_MAX_ALTERNATIVES
  const primary =
    input.context.destination
    ?? input.candidateDestinations?.[0]
    ?? null

  const names: string[] = []
  if (primary) names.push(primary)

  for (const c of input.candidateDestinations ?? []) {
    if (c && !names.some((n) => n.toLowerCase() === c.toLowerCase())) {
      names.push(c)
    }
  }

  if (primary) {
    const peers = PEER_DESTINATIONS[primary.toLowerCase()] ?? []
    for (const p of peers) {
      if (!names.some((n) => n.toLowerCase() === p.toLowerCase())) names.push(p)
    }
  }

  if (names.length === 0) {
    // No destination cue — cannot invent destinations; return empty.
    return []
  }

  return names.slice(0, max).map((destination, index) =>
    buildAlternative(destination, index, input.context, index === 0 && Boolean(primary)),
  )
}

function buildAlternative(
  destination: string,
  index: number,
  context: IntelligenceContext,
  isPrimary: boolean,
): TravelAlternative {
  seq += 1
  const profile = PROFILE[destination] ?? {}
  const preferenceFit = scorePreferenceFit(destination, context)
  const conversationFit = isPrimary ? 0.85 : 0.55

  return {
    id: `alt-${seq}-${index}`,
    label: isPrimary ? `${destination} (current focus)` : `${destination} (alternative)`,
    destination,
    priceSignal: clamp01(profile.priceSignal ?? 0.55),
    durationDays: context.durationDays,
    convenience: clamp01(profile.convenience ?? 0.6),
    visaDifficulty: clamp01(profile.visaDifficulty ?? 0.45),
    weatherSuitability: clamp01(
      adjustWeather(profile.weatherSuitability ?? 0.6, context.monthHint),
    ),
    familyFriendliness: clamp01(
      (profile.familyFriendliness ?? 0.6) + (context.hasFamilySignal ? 0.05 : 0),
    ),
    businessSuitability: clamp01(
      (profile.businessSuitability ?? 0.5) + (context.hasBusinessSignal ? 0.05 : 0),
    ),
    accessibility: clamp01(
      (profile.accessibility ?? 0.55) + (context.hasAccessibilitySignal ? 0.05 : 0),
    ),
    preferenceFit,
    conversationFit,
    notes: [
      isPrimary ? 'anchored_to_conversation' : 'peer_alternative',
      ...(context.interests.slice(0, 3).map((i) => `interest:${i}`)),
    ],
  }
}

function scorePreferenceFit(
  destination: string,
  context: IntelligenceContext,
): number {
  let score = 0.5
  const lower = destination.toLowerCase()
  for (const interest of context.interests) {
    const i = interest.toLowerCase()
    if (i === 'food' && /japan|italy|paris|thailand|korea/.test(lower)) score += 0.08
    if (i === 'beach' && /bali|maldives|thailand|spain/.test(lower)) score += 0.1
    if (i === 'culture' && /japan|paris|italy|turkey|london/.test(lower)) score += 0.08
    if (i === 'adventure' && /georgia|bali|thailand/.test(lower)) score += 0.07
  }
  if (context.hasFamilySignal && /bali|spain|dubai|japan|thailand/.test(lower)) score += 0.06
  if (context.hasBusinessSignal && /dubai|london|paris|japan|korea/.test(lower)) score += 0.06
  return clamp01(score)
}

function adjustWeather(base: number, monthHint: number | null): number {
  if (monthHint == null) return base
  // Mild heuristic only — not a weather forecast.
  if (monthHint >= 6 && monthHint <= 8) return clamp01(base - 0.05)
  if (monthHint === 12 || monthHint <= 2) return clamp01(base - 0.03)
  return base
}

export function buildIntelligenceContext(input: {
  locale?: 'ar' | 'en'
  conversationId: string
  userText: string
  memoryContext?: unknown
  travelerPreferences?: unknown
  conversationContext?: unknown
}): IntelligenceContext {
  const locale = input.locale === 'en' ? 'en' : 'ar'
  const userText = input.userText.trim()
  const lower = userText.toLowerCase()
  const memory = asRecord(input.memoryContext)
  const req = asRecord(memory?.requirements) ?? memory
  const prefs = asRecord(input.travelerPreferences)
  const conv = asRecord(input.conversationContext)

  const destination =
    str(req?.destination)
    ?? strList(req?.destinations)[0]
    ?? str(conv?.destination)
    ?? extractDestination(userText)

  const interests = unique([
    ...strList(req?.interests),
    ...strList(prefs?.interests),
  ])

  const children = num(req?.children)
  const hasFamilySignal =
    (children != null && children > 0)
    || /\b(family|kids?|children)\b/i.test(lower)
    || /عائل|أطفال/.test(userText)

  const hasBusinessSignal =
    /\b(business|meeting|conference|executive|work trip)\b/i.test(lower)
    || /عمل|اجتماع|مؤتمر/.test(userText)
    || /business/i.test(str(req?.tripPurpose) ?? '')

  const hasAccessibilitySignal =
    /\b(wheelchair|accessibility|accessible|mobility)\b/i.test(lower)
    || /كرسي متحرك|وصولية|إتاحة/.test(userText)

  return {
    locale,
    conversationId: input.conversationId.trim() || 'conversation',
    userText,
    destination,
    budgetAmount: num(req?.budgetAmount) ?? extractBudget(userText),
    durationDays: num(req?.durationDays) ?? extractDays(userText),
    adults: num(req?.travelers) ?? num(req?.adults),
    children,
    tripPurpose: str(req?.tripPurpose) ?? str(prefs?.tripPurpose),
    interests,
    hasFamilySignal,
    hasBusinessSignal,
    hasAccessibilitySignal,
    monthHint: num(req?.monthHint) ?? extractMonth(userText),
    conversationNotes: strList(conv?.notes).concat(strList(conv?.summary)),
  }
}

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

function unique(items: string[]): string[] {
  return [...new Set(items)]
}

function extractDestination(text: string): string | null {
  const map: Array<{ re: RegExp; name: string }> = [
    { re: /japan|اليابان/i, name: 'Japan' },
    { re: /bali|بالي/i, name: 'Bali' },
    { re: /paris|باريس/i, name: 'Paris' },
    { re: /dubai|دبي/i, name: 'Dubai' },
    { re: /london|لندن/i, name: 'London' },
    { re: /turkey|تركيا|istanbul|إسطنبول/i, name: 'Turkey' },
    { re: /maldives|المالديف/i, name: 'Maldives' },
    { re: /thailand|تايلند|تايلاند/i, name: 'Thailand' },
    { re: /korea|كوريا/i, name: 'Korea' },
    { re: /italy|إيطاليا/i, name: 'Italy' },
    { re: /spain|إسبانيا/i, name: 'Spain' },
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

export const AlternativeGenerator = {
  generate: generateTravelAlternatives,
  buildContext: buildIntelligenceContext,
}
