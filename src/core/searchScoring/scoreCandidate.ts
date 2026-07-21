/**
 * Sprint 79 — configurable weighted scoring for SearchCandidate.
 */

import type {
  FlightCandidateFacts,
  HotelCandidateFacts,
  ScoringDimension,
  ScoringWeights,
  SearchScore,
} from '../types'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function priceScore(price: number, budgetCap: number | null): number {
  if (budgetCap == null || budgetCap <= 0) {
    // Lower price is better relative to a soft baseline
    if (price <= 1500) return 92
    if (price <= 3000) return 80
    if (price <= 6000) return 65
    if (price <= 10000) return 48
    return 30
  }
  const ratio = price / budgetCap
  if (ratio <= 0.55) return 95
  if (ratio <= 0.75) return 85
  if (ratio <= 0.95) return 72
  if (ratio <= 1.05) return 58
  if (ratio <= 1.25) return 38
  return 18
}

function durationScore(minutes: number | null): number {
  if (minutes == null) return 60
  if (minutes <= 180) return 95
  if (minutes <= 360) return 82
  if (minutes <= 600) return 68
  if (minutes <= 900) return 48
  return 28
}

function layoverScore(stops: number, layoverMinutes: number | null): number {
  let score = stops === 0 ? 95 : stops === 1 ? 70 : 40
  if (layoverMinutes != null) {
    if (layoverMinutes > 0 && layoverMinutes < 55) score -= 20
    else if (layoverMinutes > 300) score -= 18
    else if (layoverMinutes >= 60 && layoverMinutes <= 150) score += 6
  }
  return clamp(score)
}

function hourScore(hour: number | null, idealStart: number, idealEnd: number): number {
  if (hour == null) return 65
  if (hour >= idealStart && hour <= idealEnd) return 90
  if (hour >= idealStart - 2 && hour <= idealEnd + 2) return 72
  if (hour <= 5 || hour >= 23) return 35
  return 55
}

export function scoreItinerary(input: {
  flight: FlightCandidateFacts
  hotel: HotelCandidateFacts
  totalPrice: number
  weights: ScoringWeights
  budgetCap?: number | null
}): SearchScore {
  const { flight, hotel, totalPrice, weights, budgetCap = null } = input

  const dimensions: Record<ScoringDimension, number> = {
    price: priceScore(totalPrice, budgetCap),
    duration: durationScore(flight.durationMinutes),
    layovers: layoverScore(flight.stops, flight.layoverMinutes),
    airport_quality: clamp(flight.airportQuality ?? 70),
    departure_time: hourScore(flight.departureHour, 7, 11),
    arrival_time: hourScore(flight.arrivalHour, 9, 18),
    hotel_rating: clamp(
      hotel.rating != null
        ? hotel.rating > 5
          ? hotel.rating * 10
          : hotel.rating * 20
        : (hotel.stars ?? 3) * 18,
    ),
    walking_distance: clamp(
      hotel.walkMinutes == null
        ? 65
        : hotel.walkMinutes <= 8
          ? 95
          : hotel.walkMinutes <= 15
            ? 85
            : hotel.walkMinutes <= 30
              ? 65
              : 35,
    ),
    review_quality: clamp(hotel.reviewQuality ?? (hotel.rating != null ? (hotel.rating > 5 ? hotel.rating * 10 : hotel.rating * 20) : 60)),
    refund_policy: flight.refundable || hotel.refundable ? 88 : 55,
    baggage: flight.baggageIncluded ? 90 : 50,
    overall_convenience: clamp(
      (flight.stops === 0 ? 30 : 10)
        + (hotel.walkMinutes != null && hotel.walkMinutes <= 20 ? 25 : 10)
        + (flight.cabin === 'business' || flight.cabin === 'first' ? 20 : 8)
        + 20,
    ),
  }

  let overall = 0
  let weightSum = 0
  for (const key of Object.keys(weights) as Array<keyof ScoringWeights>) {
    const w = weights[key]
    overall += dimensions[key] * w
    weightSum += w
  }
  const score = clamp(weightSum > 0 ? overall / weightSum : 50)
  const confidence = clamp(70 + (flight.stops === 0 ? 8 : 0) + (hotel.stars != null ? 6 : 0))

  return {
    overall: score,
    dimensions,
    weighted: weights,
    confidence,
  }
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  price: 0.12,
  duration: 0.1,
  layovers: 0.1,
  airport_quality: 0.06,
  departure_time: 0.06,
  arrival_time: 0.06,
  hotel_rating: 0.1,
  walking_distance: 0.08,
  review_quality: 0.08,
  refund_policy: 0.06,
  baggage: 0.06,
  overall_convenience: 0.12,
}
