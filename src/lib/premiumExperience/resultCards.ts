import type { TripPlan } from '../agent/types'

/**
 * Travel result cards — presentation models only.
 * Demo / fake itinerary cards were removed. Cards must come from the live conversation
 * (structured provider meta / trip plan), never from hardcoded Riyadh→Dubai seeds.
 */

export type ResultCardKind =
  | 'flight'
  | 'hotel'
  | 'activity'
  | 'map'
  | 'restaurant'
  | 'transport'
  | 'weather'
  | 'budget'
  | 'visa'
  | 'timeline'

export interface DynamicResultCard {
  id: string
  kind: ResultCardKind
  titleAr: string
  titleEn: string
  subtitleAr: string
  subtitleEn: string
  metaAr?: string
  metaEn?: string
  accent?: string
  /** Destination scope — used to drop unrelated cards (e.g. Morocco-only). */
  destinationKey?: string
}

/**
 * @deprecated Demo seed cards removed. Always returns [].
 * Prefer structured cards from Conversation Experience / trip plan meta.
 */
export function buildDynamicResultCards(_seedText: string, _limit = 4): DynamicResultCard[] {
  return []
}

/** Build destination-scoped cards from a completed trip plan (conversation-first). */
export function buildResultCardsFromTripPlan(
  plan: TripPlan | null | undefined,
  options?: { destinationHint?: string | null; limit?: number },
): DynamicResultCard[] {
  if (!plan) return []
  const limit = options?.limit ?? 6
  const destHint = normalizeDestinationKey(options?.destinationHint || plan.destinations?.[0] || '')
  const cards: DynamicResultCard[] = []

  const isPlaceholderLabel = (value: string) =>
    /mock\s*hotel|\bold\s*town\b|\bmarket\b|\bviewpoint\b|\bplaceholder\b/i.test(value)

  for (const flight of plan.flights ?? []) {
    const toKey = normalizeDestinationKey(flight.to)
    if (destHint && toKey && !destinationMatches(toKey, destHint) && !destinationMatches(flight.to, destHint)) {
      const destList = (plan.destinations ?? []).map(normalizeDestinationKey)
      if (!destList.some((d) => destinationMatches(d, destHint) || destinationMatches(toKey, d))) {
        continue
      }
    }
    const currencyAr = (flight.currency || 'SAR').replace(/^SAR$/i, 'ريال').replace(/^USD$/i, 'دولار')
    cards.push({
      id: `flight-${flight.from}-${flight.to}-${cards.length}`,
      kind: 'flight',
      titleAr: `${flight.from} → ${flight.to}`,
      titleEn: `${flight.from} → ${flight.to}`,
      subtitleAr: flight.airline || 'رحلة مقترحة',
      subtitleEn: flight.airline || 'Suggested flight',
      metaAr: flight.estimatedCost != null
        ? `من ${flight.estimatedCost.toLocaleString('ar-SA')} ${currencyAr}`
        : undefined,
      metaEn: flight.estimatedCost != null
        ? `From ${flight.estimatedCost.toLocaleString('en-US')} ${flight.currency || 'SAR'}`
        : undefined,
      accent: 'sky',
      destinationKey: toKey || destHint || undefined,
    })
  }

  for (const hotel of plan.accommodations ?? []) {
    if (isPlaceholderLabel(`${hotel.name} ${hotel.area}`)) continue
    const areaKey = normalizeDestinationKey(`${hotel.name} ${hotel.area}`)
    if (destHint && areaKey && !destinationMatches(areaKey, destHint) && !destinationMatches(hotel.area, destHint)) {
      const destList = (plan.destinations ?? []).map(normalizeDestinationKey)
      if (destList.length && !destList.some((e) => destinationMatches(areaKey, e) || destinationMatches(hotel.area, e))) {
        continue
      }
    }
    const currencyAr = (hotel.currency || 'SAR').replace(/^SAR$/i, 'ريال').replace(/^USD$/i, 'دولار')
    cards.push({
      id: `hotel-${hotel.name}-${cards.length}`,
      kind: 'hotel',
      titleAr: hotel.name,
      titleEn: hotel.name,
      subtitleAr: hotel.area || hotel.category || 'إقامة',
      subtitleEn: hotel.area || hotel.category || 'Stay',
      metaAr: hotel.estimatedNightly != null
        ? `${hotel.estimatedNightly.toLocaleString('ar-SA')} ${currencyAr} / ليلة`
        : undefined,
      metaEn: hotel.estimatedNightly != null
        ? `${hotel.estimatedNightly.toLocaleString('en-US')} ${hotel.currency || 'SAR'} / night`
        : undefined,
      accent: 'teal',
      destinationKey: destHint || undefined,
    })
  }

  for (const attraction of (plan.attractions ?? []).slice(0, 3)) {
    const label = attraction.title
    if (!label || isPlaceholderLabel(label)) continue
    cards.push({
      id: `activity-${label}-${cards.length}`,
      kind: 'activity',
      titleAr: label,
      titleEn: label,
      subtitleAr: plan.destinations?.[0] || 'نشاط',
      subtitleEn: plan.destinations?.[0] || 'Activity',
      accent: 'rose',
      destinationKey: destHint || undefined,
    })
  }

  const budget = plan.estimatedBudget || plan.estimatedCosts
  if (budget) {
    const currency = budget.currency || 'SAR'
    const currencyAr = currency.replace(/^SAR$/i, 'ريال').replace(/^USD$/i, 'دولار')
    const top = budget.breakdown?.[0]
    const topLabel = top?.label || ''
    if (!isPlaceholderLabel(topLabel) && !/^stay$/i.test(topLabel)) {
      cards.push({
        id: 'budget-live',
        kind: 'budget',
        titleAr: 'ملخص الميزانية',
        titleEn: 'Budget snapshot',
        subtitleAr: top ? `${top.label}: ${top.amount.toLocaleString('ar-SA')} ${currencyAr}` : 'تقدير من هذه المحادثة',
        subtitleEn: top ? `${top.label}: ${top.amount.toLocaleString('en-US')} ${currency}` : 'Estimate from this conversation',
        metaAr: `≈ ${budget.amount.toLocaleString('ar-SA')} ${currencyAr}`,
        metaEn: `≈ ${budget.amount.toLocaleString('en-US')} ${currency}`,
        accent: 'emerald',
        destinationKey: destHint || undefined,
      })
    }
  }

  return filterCardsToDestination(cards, destHint).slice(0, limit)
}

export function filterCardsToDestination(
  cards: DynamicResultCard[],
  destinationHint: string | null | undefined,
): DynamicResultCard[] {
  const hint = normalizeDestinationKey(destinationHint || '')
  if (!hint) return cards
  return cards.filter((card) => {
    const blob = normalizeDestinationKey(
      [card.destinationKey, card.titleAr, card.titleEn, card.subtitleAr, card.subtitleEn].filter(Boolean).join(' '),
    )
    if (card.kind === 'budget') return true
    return destinationMatches(blob, hint)
  })
}

export function normalizeDestinationKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function destinationMatches(candidate: string, hint: string): boolean {
  const a = normalizeDestinationKey(candidate)
  const b = normalizeDestinationKey(hint)
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  const aliases: Record<string, string[]> = {
    morocco: ['morocco', 'المغرب', 'marrakech', 'مراكش', 'agadir', 'أغادير', 'اغادير', 'fes', 'فاس', 'casablanca', 'الدار البيضاء'],
    dubai: ['dubai', 'دبي', 'dxb'],
    riyadh: ['riyadh', 'الرياض', 'ruh'],
    japan: ['japan', 'اليابان', 'tokyo', 'طوكيو', 'kyoto', 'osaka'],
  }
  for (const group of Object.values(aliases)) {
    const hintHit = group.some((g) => b.includes(g) || g.includes(b))
    const candHit = group.some((g) => a.includes(g) || g.includes(a))
    if (hintHit && candHit) return true
  }
  return false
}

export function resultCardTitle(card: DynamicResultCard, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? card.titleAr : card.titleEn
}

export function resultCardSubtitle(card: DynamicResultCard, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? card.subtitleAr : card.subtitleEn
}

export function resultCardMeta(card: DynamicResultCard, locale: 'ar' | 'en'): string | undefined {
  return locale === 'ar' ? card.metaAr : card.metaEn
}

export function resultCardKindLabel(kind: ResultCardKind, locale: 'ar' | 'en'): string {
  const map: Record<ResultCardKind, { ar: string; en: string }> = {
    flight: { ar: 'طيران', en: 'Flight' },
    hotel: { ar: 'فندق', en: 'Hotel' },
    activity: { ar: 'نشاط', en: 'Activity' },
    map: { ar: 'خريطة', en: 'Map' },
    restaurant: { ar: 'مطعم', en: 'Restaurant' },
    transport: { ar: 'مواصلات', en: 'Transport' },
    weather: { ar: 'طقس', en: 'Weather' },
    budget: { ar: 'ميزانية', en: 'Budget' },
    visa: { ar: 'تأشيرة', en: 'Visa' },
    timeline: { ar: 'خط زمني', en: 'Timeline' },
  }
  return locale === 'ar' ? map[kind].ar : map[kind].en
}
