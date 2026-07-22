/**
 * Sprint 97 — adapt existing engine outputs into ConciergeOfferFacts (read-only).
 * Does not modify SearchPlanner, DecisionEngine, Packages, or Booking.
 */

import type { ConciergeOfferFacts, ConciergeTripFacts } from '../../../core'
import type { AgentMemory } from '../types'

export function tripFactsFromMemory(memory: AgentMemory | null | undefined): ConciergeTripFacts {
  const r = memory?.requirements
  return {
    destination: r?.destination ?? null,
    origin: r?.origin ?? null,
    startDate: r?.startDate ?? null,
    endDate: r?.endDate ?? null,
    durationDays: r?.durationDays ?? null,
    travelers: r?.travelers ?? null,
    travelerType: r?.travelerType ?? null,
    budgetAmount: r?.budgetAmount ?? null,
    currency: r?.budgetCurrency ?? 'SAR',
    interests: r?.interests ?? [],
    mission: r?.destination ? `Visit ${r.destination}` : null,
  }
}

/** Structural adapters — accept unknown engine shapes without importing their modules. */
export function offersFromEngineSnapshots(input: {
  flightOffers?: Array<Record<string, unknown>> | null
  hotelOffers?: Array<Record<string, unknown>> | null
  packageSelected?: Record<string, unknown> | null
  packageRanked?: Array<Record<string, unknown>> | null
  decision?: {
    explanation?: string | null
    confidence?: number | null
    bestOverallId?: string | null
    bestBudgetId?: string | null
    fastestId?: string | null
    bestComfortId?: string | null
  } | null
  priceTimingNote?: string | null
  priceConfidence?: number | null
}): ConciergeOfferFacts {
  const flights = (input.flightOffers ?? []).map((f, i) => ({
    id: String(f.id ?? `flight_${i}`),
    airline: typeof f.airline === 'string' ? f.airline : null,
    origin: typeof f.origin === 'string' ? f.origin : null,
    destination: typeof f.destination === 'string' ? f.destination : null,
    price: typeof f.price === 'number' ? f.price : null,
    currency: typeof f.currency === 'string' ? f.currency : null,
    durationMinutes: typeof f.durationMinutes === 'number' ? f.durationMinutes : null,
    stops: typeof f.stops === 'number' ? f.stops : null,
    cabin: typeof f.cabin === 'string' ? f.cabin : null,
  }))

  const hotels = (input.hotelOffers ?? []).map((h, i) => ({
    id: String(h.id ?? `hotel_${i}`),
    name: typeof h.name === 'string' ? h.name : null,
    price: typeof h.price === 'number' ? h.price : null,
    currency: typeof h.currency === 'string' ? h.currency : null,
    stars: typeof h.stars === 'number' ? h.stars : null,
    rating: typeof h.rating === 'number' ? h.rating : null,
  }))

  const packages: NonNullable<ConciergeOfferFacts['packages']> = []
  if (input.packageSelected) {
    const p = input.packageSelected
    packages.push({
      id: String(p.id ?? 'pkg_selected'),
      title: typeof p.title === 'string' ? p.title : null,
      totalPrice: typeof p.totalPrice === 'number'
        ? p.totalPrice
        : typeof p.total === 'number'
          ? p.total
          : null,
      currency: typeof p.currency === 'string' ? p.currency : null,
      confidence: typeof p.confidence === 'number' ? p.confidence : null,
      labels: Array.isArray(p.labels) ? p.labels.map(String) : ['best overall', 'value'],
      explanation: typeof p.explanation === 'string'
        ? p.explanation
        : typeof p.summary === 'string'
          ? p.summary
          : null,
    })
  }
  for (const p of input.packageRanked ?? []) {
    if (packages.some((x) => x.id === String(p.id))) continue
    packages.push({
      id: String(p.id ?? `pkg_${packages.length}`),
      title: typeof p.title === 'string' ? p.title : null,
      totalPrice: typeof p.totalPrice === 'number' ? p.totalPrice : null,
      currency: typeof p.currency === 'string' ? p.currency : null,
      confidence: typeof p.confidence === 'number' ? p.confidence : null,
      labels: Array.isArray(p.labels) ? p.labels.map(String) : [],
      explanation: typeof p.explanation === 'string' ? p.explanation : null,
    })
  }

  return {
    flights,
    hotels,
    packages,
    decision: input.decision ?? null,
    priceTimingNote: input.priceTimingNote ?? null,
    priceConfidence: input.priceConfidence ?? null,
  }
}
