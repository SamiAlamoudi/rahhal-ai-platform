/**
 * Sprint 31 — Build planner context from conversation text + memory/orchestrator hints.
 */

import type { UnifiedTravelPlannerContext } from './types'

const CITY_ALIASES: Record<string, string> = {
  riyadh: 'Riyadh',
  jeddah: 'Jeddah',
  dubai: 'Dubai',
  'abu dhabi': 'Abu Dhabi',
  doha: 'Doha',
  cairo: 'Cairo',
  istanbul: 'Istanbul',
  london: 'London',
  paris: 'Paris',
  tokyo: 'Tokyo',
  japan: 'Japan',
  morocco: 'Morocco',
  casablanca: 'Casablanca',
  bahrain: 'Manama',
  kuwait: 'Kuwait City',
  amman: 'Amman',
}

const AIRLINE_HINTS = [
  'saudia',
  'emirates',
  'etihad',
  'qatar',
  'flynas',
  'flyadeal',
  'turkish',
  'british airways',
]

const HOTEL_HINTS = [
  'hilton',
  'marriott',
  'hyatt',
  'sheraton',
  'radisson',
  'novotel',
  'intercontinental',
  'rotana',
  'resort',
]

const LOYALTY_HINTS = [
  'alfursan',
  'skywards',
  'etihad guest',
  'privilege club',
  'miles',
]

export function emptyUnifiedContext(
  locale: 'ar' | 'en' = 'en',
): UnifiedTravelPlannerContext {
  return {
    destination: null,
    origin: null,
    startDate: null,
    endDate: null,
    nights: 3,
    adults: 2,
    children: 0,
    currency: 'SAR',
    budgetAmount: null,
    preferredAirlines: [],
    preferredHotels: [],
    loyaltyPrograms: [],
    cabinClass: null,
    activities: [],
    locale,
  }
}

export function extractContextFromUserText(
  userText: string,
  locale: 'ar' | 'en' = 'en',
): Partial<UnifiedTravelPlannerContext> {
  const lower = userText.toLowerCase()
  const partial: Partial<UnifiedTravelPlannerContext> = { locale }

  const fromTo = lower.match(
    /(?:from|depart(?:ing)?\s+from)\s+([a-z\s]+?)\s+(?:to|→|->)\s+([a-z\s]+?)(?:\s|,|\.|$|for|with|budget)/i,
  )
  if (fromTo) {
    partial.origin = normalizeCity(fromTo[1])
    partial.destination = normalizeCity(fromTo[2])
  } else {
    const toMatch = lower.match(
      /(?:to|visit(?:ing)?|trip to|travel to|fly to)\s+([a-z\s]{3,20}?)(?:\s|,|\.|$|for|with|budget|from)/i,
    )
    if (toMatch) {
      const candidate = normalizeCity(toMatch[1])
      if (!isTravelVerb(candidate)) partial.destination = candidate
    }
    const fromMatch = lower.match(
      /(?:from|leaving)\s+([a-z\s]{3,20}?)(?:\s|,|\.|$|to|for)/i,
    )
    if (fromMatch) {
      const candidate = normalizeCity(fromMatch[1])
      if (!isTravelVerb(candidate)) partial.origin = candidate
    }
  }

  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) {
      // Require an intentional destination cue — bare "to" in "to travel" is not enough.
      if (!partial.destination && /\b(visit|trip to|travel to|fly to|going to)\b/.test(lower)) {
        partial.destination = city
      }
    }
  }

  const nightsMatch = lower.match(/(\d+)\s*(?:nights?|days?)/)
  if (nightsMatch) {
    partial.nights = Math.max(1, Number(nightsMatch[1]))
  }

  const isoDates = userText.match(/\d{4}-\d{2}-\d{2}/g)
  if (isoDates?.[0]) partial.startDate = isoDates[0]
  if (isoDates?.[1]) partial.endDate = isoDates[1]

  const adultsMatch = lower.match(/(\d+)\s*adults?/)
  if (adultsMatch) partial.adults = Math.max(1, Number(adultsMatch[1]))
  const childrenMatch = lower.match(/(\d+)\s*children/)
  if (childrenMatch) partial.children = Math.max(0, Number(childrenMatch[1]))
  if (/\bsolo\b/.test(lower)) partial.adults = 1
  if (/\bcouple\b/.test(lower)) partial.adults = 2

  const budgetMatch = lower.match(
    /budget\s*(?:of|is|:)?\s*(?:(sar|usd|aed|eur)\s*)?(\d[\d,]*)\s*(sar|usd|aed|eur)?/i,
  )
  if (budgetMatch) {
    partial.budgetAmount = Number(budgetMatch[2].replace(/,/g, ''))
    const currency = budgetMatch[1] || budgetMatch[3]
    if (currency) partial.currency = currency.toUpperCase()
  } else if (/\bsar\b/.test(lower)) {
    partial.currency = 'SAR'
  }

  if (/\bbusiness\b/.test(lower)) partial.cabinClass = 'business'
  else if (/\bfirst\b/.test(lower)) partial.cabinClass = 'first'
  else if (/premium\s*economy/.test(lower)) partial.cabinClass = 'premium-economy'
  else if (/\beconomy\b/.test(lower)) partial.cabinClass = 'economy'

  partial.preferredAirlines = AIRLINE_HINTS.filter((a) => lower.includes(a)).map(
    titleCase,
  )
  partial.preferredHotels = HOTEL_HINTS.filter((h) => lower.includes(h)).map(titleCase)
  partial.loyaltyPrograms = LOYALTY_HINTS.filter((l) => lower.includes(l)).map(titleCase)

  const activities: string[] = []
  if (/beach|pool/.test(lower)) activities.push('beach')
  if (/museum|culture|history/.test(lower)) activities.push('culture')
  if (/shopping|mall/.test(lower)) activities.push('shopping')
  if (/food|dining|restaurant/.test(lower)) activities.push('dining')
  if (activities.length) partial.activities = activities

  return partial
}

export function mergeUnifiedContext(
  base: UnifiedTravelPlannerContext,
  ...patches: Array<Partial<UnifiedTravelPlannerContext> | null | undefined>
): UnifiedTravelPlannerContext {
  let next = { ...base }
  for (const patch of patches) {
    if (!patch) continue
    next = {
      ...next,
      ...Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined && v !== null && v !== ''),
      ),
      preferredAirlines: unique([
        ...next.preferredAirlines,
        ...(patch.preferredAirlines ?? []),
      ]),
      preferredHotels: unique([
        ...next.preferredHotels,
        ...(patch.preferredHotels ?? []),
      ]),
      loyaltyPrograms: unique([
        ...next.loyaltyPrograms,
        ...(patch.loyaltyPrograms ?? []),
      ]),
      activities: unique([...next.activities, ...(patch.activities ?? [])]),
    } as UnifiedTravelPlannerContext
  }

  if (next.startDate && next.endDate) {
    next.nights = Math.max(1, nightsBetween(next.startDate, next.endDate))
  } else if (!next.nights || next.nights < 1) {
    next.nights = 3
  }

  if (!next.startDate) next.startDate = daysFromToday(14)
  if (!next.endDate) next.endDate = addDays(next.startDate, next.nights)

  return next
}

export function contextFromMemoryLike(memory: unknown): Partial<UnifiedTravelPlannerContext> {
  if (!memory || typeof memory !== 'object') return {}
  const m = memory as Record<string, unknown>
  const working =
    (m.workingMemory as Record<string, unknown> | undefined)
    ?? (m.context as { workingMemory?: Record<string, unknown> } | undefined)?.workingMemory
    ?? m

  const travelDates = (working.travelDates as Record<string, unknown> | undefined) ?? {}
  const travelers = (working.travelers as Record<string, unknown> | undefined) ?? {}
  const budget = (working.budget as Record<string, unknown> | undefined) ?? {}
  const loyalty = Array.isArray(working.loyaltyPrograms)
    ? working.loyaltyPrograms.map((entry) => {
      if (typeof entry === 'string') return entry
      if (entry && typeof entry === 'object' && 'name' in entry) {
        return String((entry as { name: unknown }).name)
      }
      return ''
    }).filter(Boolean)
    : []

  return {
    destination: str(working.destination) ?? str((working.destinations as string[] | undefined)?.[0]),
    origin: str(working.origin),
    startDate: str(travelDates.startDate),
    endDate: str(travelDates.endDate),
    nights: num(travelDates.durationDays) ?? undefined,
    adults: Math.max(1, num(travelers.adults) ?? num(travelers.count) ?? 2),
    children: num(travelers.children) ?? 0,
    currency: str(working.currency) ?? str(budget.currency) ?? undefined,
    budgetAmount: num(budget.amount),
    preferredAirlines: arr(working.airlinePreferences),
    preferredHotels: arr(working.hotelPreferences),
    loyaltyPrograms: loyalty,
    cabinClass: str(working.cabinClass),
    activities: arr(working.activities),
  }
}

function normalizeCity(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  return CITY_ALIASES[cleaned] ?? titleCase(cleaned)
}

function isTravelVerb(value: string): boolean {
  return /^(travel|travelling|traveling|fly|flying|go|going|visit|visiting|trip|plan|planning|book|booking)$/i.test(
    value.trim(),
  )
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = v.toLowerCase()
    if (!v || seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function nightsBetween(start: string, end: string): number {
  const a = Date.parse(start)
  const b = Date.parse(end)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1
  return Math.max(1, Math.round((b - a) / 86_400_000))
}

function daysFromToday(offset: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t || null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function arr(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}
