/**
 * Sprint 110 — TripBuilderComposer
 * Generates candidate trips from flight × hotel offer pools.
 */

import type { RahhalFlightSearchOffer } from '../liveFlightSearch/types'
import type { HotelOffer } from '../liveHotelSearch/types'
import { assessTripCompatibility } from './TripCompatibility'
import { calculateTripCost } from './TripCostCalculator'
import { explainTrip } from './TripExplainer'
import {
  computeTripScore,
  estimateTravelQuality,
  estimateTripConfidence,
} from './TripMetadata'
import type { TripBuilderPreferences, TripCandidate } from './types'

export interface TripComposeContext {
  destination: string
  departureDate: string
  returnDate: string | null
  checkInDate: string
  checkOutDate: string
  budget: number | null
  currency: string
  preferences?: TripBuilderPreferences | null
  maxCandidates: number
}

function sortFlights(flights: RahhalFlightSearchOffer[]): RahhalFlightSearchOffer[] {
  return [...flights].sort((a, b) => {
    const pa = a.price ?? Number.POSITIVE_INFINITY
    const pb = b.price ?? Number.POSITIVE_INFINITY
    const sa = a.stops ?? 99
    const sb = b.stops ?? 99
    return pa - pb || sa - sb || a.id.localeCompare(b.id)
  })
}

function sortHotels(hotels: HotelOffer[]): HotelOffer[] {
  return [...hotels].sort((a, b) => {
    const pa = a.price ?? Number.POSITIVE_INFINITY
    const pb = b.price ?? Number.POSITIVE_INFINITY
    const stars = (b.stars ?? 0) - (a.stars ?? 0)
    return pa - pb || stars || a.id.localeCompare(b.id)
  })
}

export function composeTripCandidates(
  flights: RahhalFlightSearchOffer[],
  hotels: HotelOffer[],
  ctx: TripComposeContext,
): TripCandidate[] {
  if (flights.length === 0 || hotels.length === 0) return []

  const flightPool = sortFlights(flights).slice(0, 12)
  const hotelPool = sortHotels(hotels).slice(0, 12)

  // First pass: build raw combinations with costs for peer average
  type Raw = {
    flight: RahhalFlightSearchOffer
    hotel: HotelOffer
    nights: number
    compatible: boolean
    validationErrors: string[]
  }

  const raw: Raw[] = []
  for (const flight of flightPool) {
    for (const hotel of hotelPool) {
      const compat = assessTripCompatibility({
        flight,
        hotel,
        departureDate: ctx.departureDate,
        returnDate: ctx.returnDate,
        checkInDate: ctx.checkInDate,
        checkOutDate: ctx.checkOutDate,
        preferences: ctx.preferences,
      })
      raw.push({
        flight,
        hotel,
        nights: compat.nights,
        compatible: compat.compatible,
        validationErrors: compat.errors,
      })
    }
  }

  const peerTotals: number[] = []
  for (const row of raw) {
    if (!row.compatible) continue
    const cost = calculateTripCost({
      flight: row.flight,
      hotel: row.hotel,
      nights: row.nights,
      budget: ctx.budget,
      currency: ctx.currency,
    })
    if (cost.totalCost > 0) peerTotals.push(cost.totalCost)
  }
  const peerAverageTotal =
    peerTotals.length > 0
      ? peerTotals.reduce((s, n) => s + n, 0) / peerTotals.length
      : null

  const candidates: TripCandidate[] = []
  for (const row of raw) {
    const cost = calculateTripCost({
      flight: row.flight,
      hotel: row.hotel,
      nights: row.nights,
      budget: ctx.budget,
      currency: ctx.currency,
      peerAverageTotal,
    })

    // Soft budget filter: keep over-budget trips but they score lower;
    // hard-drop only when budget set and total is wildly over (3×).
    if (
      ctx.budget != null
      && cost.totalCost > ctx.budget * 3
      && row.compatible
    ) {
      continue
    }

    const travelQuality = estimateTravelQuality({
      flightStops: row.flight.stops,
      flightDurationMinutes: row.flight.durationMinutes,
      cabin: row.flight.cabin,
      hotelStars: row.hotel.stars,
      freeCancellation: row.hotel.freeCancellation,
      refundableFlight: row.flight.refundable,
      nights: row.nights,
    })

    const confidence = estimateTripConfidence({
      compatible: row.compatible,
      travelQuality,
      underBudget: cost.underBudget,
      hasPrices: row.flight.price != null && row.hotel.price != null,
      providerConfidence: row.flight.providerConfidence,
    })

    const score = computeTripScore({
      travelQuality,
      confidence,
      totalCost: cost.totalCost,
      budget: ctx.budget,
      compatible: row.compatible,
    })

    const { explanation, reasons } = explainTrip({
      flight: row.flight,
      hotel: row.hotel,
      cost,
      nights: row.nights,
      travelQuality,
      confidence,
      destination: ctx.destination,
      compatible: row.compatible,
      validationErrors: row.validationErrors,
    })

    const id = `trip_${row.flight.id}__${row.hotel.id}`
    const title =
      `${ctx.destination}: ${row.flight.airline ?? row.flight.title} + ${row.hotel.hotelName}`

    candidates.push({
      id,
      title,
      destination: ctx.destination,
      departureDate: ctx.departureDate,
      returnDate: ctx.returnDate,
      checkInDate: ctx.checkInDate,
      checkOutDate: ctx.checkOutDate,
      nights: row.nights,
      flight: row.flight,
      hotel: row.hotel,
      cost,
      travelQuality,
      confidence,
      explanation,
      reasons,
      labels: [],
      compatible: row.compatible,
      validationErrors: row.validationErrors,
      score,
    })
  }

  // Prefer compatible, then score
  candidates.sort((a, b) => {
    if (a.compatible !== b.compatible) return a.compatible ? -1 : 1
    return b.score - a.score || a.id.localeCompare(b.id)
  })

  return candidates.slice(0, ctx.maxCandidates)
}

export class TripBuilderComposer {
  compose(
    flights: RahhalFlightSearchOffer[],
    hotels: HotelOffer[],
    ctx: TripComposeContext,
  ): TripCandidate[] {
    return composeTripCandidates(flights, hotels, ctx)
  }
}

export function createTripBuilderComposer(): TripBuilderComposer {
  return new TripBuilderComposer()
}
