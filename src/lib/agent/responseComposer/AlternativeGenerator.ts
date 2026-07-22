/**
 * Sprint 106 — AlternativeGenerator
 * Build recommendation groups from provider offer facts only.
 */

import {
  createRecommendationReasoner,
  type RecommendationReasoner,
} from './RecommendationReasoner'
import type {
  ResponseAlternativeGroup,
  ResponseComposerFlightFacts,
  ResponseRecommendation,
  ResponseRecommendationKind,
} from './types'

const GROUP_DEFS: Array<{
  kind: ResponseRecommendationKind
  label: string
}> = [
  { kind: 'best_overall', label: 'Best Overall' },
  { kind: 'cheapest', label: 'Cheapest' },
  { kind: 'fastest', label: 'Fastest' },
  { kind: 'most_comfortable', label: 'Most Comfortable' },
  { kind: 'business', label: 'Business' },
  { kind: 'flexible', label: 'Flexible' },
]

function pickCheapest(
  flights: ResponseComposerFlightFacts[],
): ResponseComposerFlightFacts | null {
  const priced = flights.filter((f) => f.price != null)
  if (priced.length === 0) return null
  return [...priced].sort((a, b) => (a.price! - b.price!) || a.id.localeCompare(b.id))[0] ?? null
}

function pickFastest(
  flights: ResponseComposerFlightFacts[],
): ResponseComposerFlightFacts | null {
  const timed = flights.filter((f) => f.durationMinutes != null)
  if (timed.length === 0) return null
  return [...timed].sort(
    (a, b) =>
      (a.durationMinutes! - b.durationMinutes!)
      || (a.stops ?? 99) - (b.stops ?? 99)
      || a.id.localeCompare(b.id),
  )[0] ?? null
}

function pickMostComfortable(
  flights: ResponseComposerFlightFacts[],
): ResponseComposerFlightFacts | null {
  if (flights.length === 0) return null
  return [...flights].sort((a, b) => {
    const stopsA = a.stops ?? 99
    const stopsB = b.stops ?? 99
    if (stopsA !== stopsB) return stopsA - stopsB
    const cabinScore = (c: string | null | undefined) => {
      if (!c) return 0
      if (/first/i.test(c)) return 3
      if (/business/i.test(c)) return 2
      if (/premium/i.test(c)) return 1
      return 0
    }
    const cabinDiff = cabinScore(b.cabin) - cabinScore(a.cabin)
    if (cabinDiff !== 0) return cabinDiff
    const durA = a.durationMinutes ?? 9_999
    const durB = b.durationMinutes ?? 9_999
    return durA - durB || a.id.localeCompare(b.id)
  })[0] ?? null
}

function pickBusiness(
  flights: ResponseComposerFlightFacts[],
): ResponseComposerFlightFacts | null {
  const business = flights.filter((f) => f.cabin && /business|first/i.test(f.cabin))
  if (business.length > 0) return pickMostComfortable(business)
  return null
}

function pickFlexible(
  flights: ResponseComposerFlightFacts[],
): ResponseComposerFlightFacts | null {
  const refundable = flights.filter((f) => f.refundable === true)
  if (refundable.length > 0) return pickCheapest(refundable) ?? refundable[0] ?? null
  return null
}

function pickBestValue(
  flights: ResponseComposerFlightFacts[],
): ResponseComposerFlightFacts | null {
  const scored = flights.filter((f) => f.price != null && f.durationMinutes != null)
  if (scored.length === 0) return pickCheapest(flights)
  return [...scored].sort((a, b) => {
    // Lower price × duration proxy = better value
    const va = a.price! * (1 + (a.durationMinutes! / 600))
    const vb = b.price! * (1 + (b.durationMinutes! / 600))
    return va - vb || a.id.localeCompare(b.id)
  })[0] ?? null
}

function pickBestOverall(
  flights: ResponseComposerFlightFacts[],
  labeledId?: string | null,
): ResponseComposerFlightFacts | null {
  if (labeledId) {
    const hit = flights.find((f) => f.id === labeledId)
    if (hit) return hit
  }
  const withScore = flights.filter((f) => f.score != null)
  if (withScore.length > 0) {
    return [...withScore].sort(
      (a, b) => (b.score! - a.score!) || a.id.localeCompare(b.id),
    )[0] ?? null
  }
  return pickBestValue(flights)
}

function pickPremium(
  flights: ResponseComposerFlightFacts[],
): ResponseComposerFlightFacts | null {
  const priced = flights.filter((f) => f.price != null)
  if (priced.length === 0) return pickBusiness(flights)
  return [...priced].sort((a, b) => (b.price! - a.price!) || a.id.localeCompare(b.id))[0] ?? null
}

function toRecommendation(
  kind: ResponseRecommendationKind,
  label: string,
  flight: ResponseComposerFlightFacts,
  pool: ResponseComposerFlightFacts[],
  reasoner: RecommendationReasoner,
): ResponseRecommendation {
  const explained = reasoner.explain({ selected: flight, pool, kind })
  return {
    kind,
    label,
    optionId: flight.id,
    title: flight.title
      ?? ([flight.airline, flight.origin, flight.destination].filter(Boolean).join(' ')
        || flight.id),
    price: flight.price ?? null,
    currency: flight.currency ?? 'SAR',
    durationMinutes: flight.durationMinutes ?? null,
    stops: flight.stops ?? null,
    cabin: flight.cabin ?? null,
    airline: flight.airline ?? null,
    reason: explained.reason,
    reasons: explained.reasons,
    highlights: explained.highlights,
  }
}

export interface AlternativeGeneratorOptions {
  labeled?: {
    bestOverallId?: string | null
    cheapestId?: string | null
    fastestId?: string | null
    bestComfortId?: string | null
    bestValueId?: string | null
  } | null
  reasoner?: RecommendationReasoner
}

function pickByLabeledId(
  flights: ResponseComposerFlightFacts[],
  id: string | null | undefined,
  fallback: () => ResponseComposerFlightFacts | null,
): ResponseComposerFlightFacts | null {
  if (id) {
    const hit = flights.find((f) => f.id === id)
    if (hit) return hit
  }
  return fallback()
}

export function generateAlternatives(
  flights: ResponseComposerFlightFacts[],
  options: AlternativeGeneratorOptions = {},
): {
  recommendations: ResponseRecommendation[]
  alternatives: ResponseAlternativeGroup[]
} {
  const reasoner = options.reasoner ?? createRecommendationReasoner()
  const labeled = options.labeled

  const picks: Partial<Record<ResponseRecommendationKind, ResponseComposerFlightFacts | null>> = {
    best_overall: pickBestOverall(flights, labeled?.bestOverallId),
    cheapest: pickByLabeledId(flights, labeled?.cheapestId, () => pickCheapest(flights)),
    fastest: pickByLabeledId(flights, labeled?.fastestId, () => pickFastest(flights)),
    best_value: pickByLabeledId(flights, labeled?.bestValueId, () => pickBestValue(flights)),
    premium: pickPremium(flights),
    most_comfortable: pickByLabeledId(
      flights,
      labeled?.bestComfortId,
      () => pickMostComfortable(flights),
    ),
    business: pickBusiness(flights),
    flexible: pickFlexible(flights),
  }

  const primaryKinds: ResponseRecommendationKind[] = [
    'best_overall',
    'cheapest',
    'fastest',
    'best_value',
    'premium',
  ]

  const recommendations: ResponseRecommendation[] = []

  for (const kind of primaryKinds) {
    const flight = picks[kind]
    if (!flight) continue
    const label =
      GROUP_DEFS.find((g) => g.kind === kind)?.label
      ?? kind.replace(/_/g, ' ')
    const rec = toRecommendation(kind, label, flight, flights, reasoner)
    recommendations.push(rec)
  }

  const alternatives: ResponseAlternativeGroup[] = []
  for (const def of GROUP_DEFS) {
    const flight = picks[def.kind]
    if (!flight) continue
    const rec = toRecommendation(def.kind, def.label, flight, flights, reasoner)
    alternatives.push({
      kind: def.kind,
      label: def.label,
      recommendations: [rec],
    })
  }

  return { recommendations, alternatives }
}

export class AlternativeGenerator {
  private readonly reasoner: RecommendationReasoner

  constructor(reasoner: RecommendationReasoner = createRecommendationReasoner()) {
    this.reasoner = reasoner
  }

  generate(
    flights: ResponseComposerFlightFacts[],
    labeled?: AlternativeGeneratorOptions['labeled'],
  ) {
    return generateAlternatives(flights, { labeled, reasoner: this.reasoner })
  }
}

export function createAlternativeGenerator(): AlternativeGenerator {
  return new AlternativeGenerator()
}
