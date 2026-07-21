/**
 * Sprint 81 — agent bridge for Price Intelligence & Booking Timing.
 * Additive post-decision enrichment — RahhalBrain unchanged.
 */

import {
  runBookingTiming,
  type BookingTimingResult,
  type PriceIntelligenceInput,
  type PriceObservation,
} from '../../../core'
import type { AgentMemory, TripPlan } from '../types'
import { isPriceIntelligenceEnabled } from './feature'

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function collectOfferPrices(
  flightOffers?: Array<Record<string, unknown>>,
  hotelStays?: Array<Record<string, unknown>>,
): { totals: number[]; currency: string; seats: number | null; rooms: number | null } {
  const totals: number[] = []
  let currency = 'SAR'
  let seats: number | null = null
  let rooms: number | null = null

  for (const offer of flightOffers ?? []) {
    const price = num(offer.price) ?? num(offer.total) ?? num(offer.amount)
    if (price != null) totals.push(price)
    if (typeof offer.currency === 'string' && offer.currency) currency = offer.currency
    const seatVal = num(offer.seatsRemaining) ?? num(offer.availableSeats)
    if (seatVal != null) seats = seats == null ? seatVal : Math.min(seats, seatVal)
  }
  for (const stay of hotelStays ?? []) {
    const price = num(stay.total) ?? num(stay.price) ?? num(stay.amount)
    if (price != null) totals.push(price)
    if (typeof stay.currency === 'string' && stay.currency) currency = stay.currency
    const roomVal = num(stay.roomsRemaining) ?? num(stay.availability)
    if (roomVal != null) rooms = rooms == null ? roomVal : Math.min(rooms, roomVal)
  }

  return { totals, currency, seats, rooms }
}

function tripPlanTotal(tripPlan: TripPlan): { total: number | null; currency: string } {
  const budgetAmount = tripPlan.estimatedBudget?.amount
  if (typeof budgetAmount === 'number' && budgetAmount > 0) {
    return {
      total: budgetAmount,
      currency: tripPlan.estimatedBudget.currency || 'SAR',
    }
  }
  let total = 0
  let currency = 'SAR'
  let any = false
  for (const f of tripPlan.flights) {
    if (typeof f.estimatedCost === 'number') {
      total += f.estimatedCost
      any = true
      if (f.currency) currency = f.currency
    }
  }
  for (const a of tripPlan.accommodations) {
    if (typeof a.estimatedNightly === 'number') {
      const nights = Math.max(1, (tripPlan.durationDays || 1) - 1 || 1)
      total += a.estimatedNightly * nights
      any = true
      if (a.currency) currency = a.currency
    }
  }
  return { total: any ? total : null, currency }
}

function buildHistorical(
  totals: number[],
  currency: string,
): PriceObservation[] {
  const now = Date.now()
  return totals.map((price, i) => ({
    price,
    currency,
    observedAt: new Date(now - (totals.length - i) * 86_400_000).toISOString(),
    source: 'offer_pool',
  }))
}

export function buildPriceIntelligenceInput(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  decisionBestTotal?: number | null
}): PriceIntelligenceInput | null {
  const pool = collectOfferPrices(input.flightOffers, input.hotelStays)
  const fromPlan = tripPlanTotal(input.tripPlan)
  const cheapest = pool.totals.length ? Math.min(...pool.totals) : null
  const premium = pool.totals.length ? Math.max(...pool.totals) : null

  let current = input.decisionBestTotal
    ?? fromPlan.total
    ?? (cheapest != null && premium != null
      ? (cheapest + premium) / 2
      : cheapest)

  // Prefer combined flight+hotel when both pools exist: cheapest flight + cheapest hotel.
  const flightPrices = (input.flightOffers ?? [])
    .map((o) => num(o.price) ?? num(o.total))
    .filter((n): n is number => n != null)
  const hotelPrices = (input.hotelStays ?? [])
    .map((o) => num(o.total) ?? num(o.price))
    .filter((n): n is number => n != null)
  if (current == null && flightPrices.length && hotelPrices.length) {
    current = Math.min(...flightPrices) + Math.min(...hotelPrices)
  }
  if (current == null || current <= 0) return null

  const currency = fromPlan.currency || pool.currency
  const comboTotals: number[] = []
  if (flightPrices.length && hotelPrices.length) {
    for (const f of flightPrices.slice(0, 6)) {
      for (const h of hotelPrices.slice(0, 6)) {
        comboTotals.push(f + h)
      }
    }
  }
  const historySource = comboTotals.length > 0 ? comboTotals : pool.totals

  const departureDate = input.memory.requirements.startDate
    ?? input.tripPlan.startDate
    ?? null

  const demandRaw = input.memory.requirements.travelerType === 'family'
    || input.memory.requirements.tripPurpose === 'family'
    ? 'high' as const
    : null

  return {
    currentPrice: current,
    currency,
    cheapestPrice: comboTotals.length ? Math.min(...comboTotals) : cheapest,
    premiumPrice: comboTotals.length ? Math.max(...comboTotals) : premium,
    historicalObservations: buildHistorical(
      historySource.length ? historySource : [current],
      currency,
    ),
    budgetCap: input.memory.requirements.budgetAmount ?? null,
    departureDate,
    seatsRemaining: pool.seats,
    roomsRemaining: pool.rooms,
    demandIndicator: demandRaw,
    destination: input.memory.requirements.destination ?? null,
  }
}

export function enrichWithPriceIntelligence(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  enabled?: boolean
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  decisionBestTotal?: number | null
}): {
  tripPlan: TripPlan
  priceIntelligence: BookingTimingResult | null
} {
  if (!isPriceIntelligenceEnabled({ enabled: input.enabled })) {
    return { tripPlan: input.tripPlan, priceIntelligence: null }
  }

  const timingInput = buildPriceIntelligenceInput(input)
  if (!timingInput) {
    return { tripPlan: input.tripPlan, priceIntelligence: null }
  }

  const result = runBookingTiming(timingInput)
  const rec = result.recommendation
  const note = `Price intelligence: ${rec.action} · conf ${Math.round(rec.confidence)}% — ${rec.explanation}`

  return {
    tripPlan: {
      ...input.tripPlan,
      notes: [...input.tripPlan.notes, note],
    },
    priceIntelligence: result,
  }
}

export type { BookingTimingResult }
