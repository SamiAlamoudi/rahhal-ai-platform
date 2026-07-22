/**
 * Sprint 96 — Alternative Scenarios (Best Price / Comfort / Fastest / Value / Luxury / Family).
 */

import type {
  ConciergeAlternativeScenario,
  ConciergeOfferFacts,
  ConciergeScenarioKind,
  ConciergeTripFacts,
} from './types'

const LABELS: Record<ConciergeScenarioKind, string> = {
  best_price: 'Best Price',
  best_comfort: 'Best Comfort',
  fastest: 'Fastest',
  best_value: 'Best Value',
  luxury: 'Luxury',
  family_friendly: 'Family Friendly',
}

function kindFromLabels(labels: string[] | undefined): ConciergeScenarioKind | null {
  const joined = (labels ?? []).join(' ').toLowerCase()
  if (/cheap|budget|lowest|price/.test(joined)) return 'best_price'
  if (/comfort|premium_economy|business cabin/.test(joined)) return 'best_comfort'
  if (/fast|direct|nonstop/.test(joined)) return 'fastest'
  if (/value|balanced|best overall|recommended/.test(joined)) return 'best_value'
  if (/luxury|five.?star|first/.test(joined)) return 'luxury'
  if (/family|kids|child/.test(joined)) return 'family_friendly'
  return null
}

function baseCost(offers: ConciergeOfferFacts, currency: string): { amount: number | null; currency: string } {
  const pkg = offers.packages?.[0]
  if (pkg?.totalPrice != null) {
    return { amount: pkg.totalPrice, currency: (pkg.currency || currency).toUpperCase() }
  }
  const flight = offers.flights?.[0]?.price ?? 0
  const hotel = offers.hotels?.[0]?.price ?? 0
  const total = flight + hotel
  return {
    amount: total > 0 ? total : null,
    currency: (offers.flights?.[0]?.currency || offers.hotels?.[0]?.currency || currency).toUpperCase(),
  }
}

function scenario(
  kind: ConciergeScenarioKind,
  explanation: string,
  highlights: string[],
  cost: number | null,
  currency: string,
  confidence: number,
  optionId: string | null,
): ConciergeAlternativeScenario {
  return {
    kind,
    label: LABELS[kind],
    estimatedCost: cost,
    currency,
    confidence: Math.max(0, Math.min(1, confidence)),
    explanation,
    highlights,
    optionId,
  }
}

export function buildConciergeAlternatives(input: {
  trip: ConciergeTripFacts
  offers?: ConciergeOfferFacts
}): ConciergeAlternativeScenario[] {
  const trip = input.trip
  const offers = input.offers ?? {}
  const currency = (trip.currency || 'SAR').toUpperCase()
  const { amount, currency: costCurrency } = baseCost(offers, currency)
  const destination = trip.destination?.trim() || 'your destination'
  const decision = offers.decision
  const out: ConciergeAlternativeScenario[] = []
  const seen = new Set<ConciergeScenarioKind>()

  const push = (s: ConciergeAlternativeScenario) => {
    if (seen.has(s.kind)) return
    seen.add(s.kind)
    out.push(s)
  }

  for (const pkg of offers.packages ?? []) {
    const kind = kindFromLabels(pkg.labels) ?? 'best_value'
    push(scenario(
      kind,
      pkg.explanation?.trim() || `${LABELS[kind]} option for ${destination}.`,
      pkg.labels?.slice(0, 4) ?? [LABELS[kind]],
      pkg.totalPrice ?? amount,
      (pkg.currency || costCurrency).toUpperCase(),
      pkg.confidence ?? 0.75,
      pkg.id,
    ))
  }

  if (decision?.bestBudgetId) {
    push(scenario(
      'best_price',
      `Lowest-cost shortlist option while still reaching ${destination}.`,
      ['lowest total', 'budget fit'],
      amount != null ? Math.round(amount * 0.88) : null,
      costCurrency,
      0.72,
      decision.bestBudgetId,
    ))
  }
  if (decision?.bestComfortId) {
    push(scenario(
      'best_comfort',
      `More comfortable routing and stay quality for a smoother trip to ${destination}.`,
      ['fewer hassles', 'higher comfort'],
      amount != null ? Math.round(amount * 1.12) : null,
      costCurrency,
      0.78,
      decision.bestComfortId,
    ))
  }
  if (decision?.fastestId) {
    push(scenario(
      'fastest',
      `Minimizes travel time with fewer stops where possible.`,
      ['shorter duration', 'time priority'],
      amount != null ? Math.round(amount * 1.05) : null,
      costCurrency,
      0.74,
      decision.fastestId,
    ))
  }
  if (decision?.bestOverallId) {
    push(scenario(
      'best_value',
      decision.explanation?.trim() || `Best overall balance of price, time, and quality for ${destination}.`,
      ['balanced', 'recommended'],
      amount,
      costCurrency,
      decision.confidence ?? 0.82,
      decision.bestOverallId,
    ))
  }

  const defaults: Array<{
    kind: ConciergeScenarioKind
    explanation: string
    highlights: string[]
    mult: number
    conf: number
  }> = [
    { kind: 'best_price', explanation: `Lean package focused on the lowest workable total for ${destination}.`, highlights: ['save money'], mult: 0.85, conf: 0.7 },
    { kind: 'best_comfort', explanation: `Comfort-first itinerary with better cabin/hotel quality.`, highlights: ['comfort'], mult: 1.15, conf: 0.76 },
    { kind: 'fastest', explanation: `Time-first option that reduces journey hours.`, highlights: ['speed'], mult: 1.08, conf: 0.73 },
    { kind: 'best_value', explanation: `Balanced recommendation across price, duration, and hotel quality.`, highlights: ['value'], mult: 1, conf: 0.84 },
    { kind: 'luxury', explanation: `Premium stay and flight experience for ${destination}.`, highlights: ['premium'], mult: 1.45, conf: 0.68 },
    { kind: 'family_friendly', explanation: `Family-oriented pacing, roomier stay, and simpler connections.`, highlights: ['family'], mult: 1.1, conf: 0.75 },
  ]

  for (const d of defaults) {
    push(scenario(
      d.kind,
      d.explanation,
      d.highlights,
      amount != null ? Math.round(amount * d.mult) : null,
      costCurrency,
      d.conf,
      null,
    ))
  }

  if ((trip.travelerType || '').toLowerCase() === 'family') {
    const family = out.find((s) => s.kind === 'family_friendly')
    if (family) family.confidence = Math.min(1, family.confidence + 0.05)
  }

  return out.slice(0, 6)
}
