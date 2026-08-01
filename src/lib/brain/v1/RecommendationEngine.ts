/**
 * Sprint 82 — RecommendationEngine (Brain v1).
 * Weighted scoring across price, stops, travel time, refundability,
 * airline/hotel quality, traveler preferences, and historical choices.
 */

import type {
  BrainV1Entities,
  BrainV1LongTermMemory,
  BrainV1Offer,
  BrainV1ScoreBreakdown,
} from './types'

export type RankingWeights = {
  price: number
  stops: number
  travelTime: number
  refundability: number
  airlineQuality: number
  hotelQuality: number
  travelerPreferences: number
  historicalChoices: number
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  price: 0.25,
  stops: 0.15,
  travelTime: 0.15,
  refundability: 0.1,
  airlineQuality: 0.1,
  hotelQuality: 0.1,
  travelerPreferences: 0.1,
  historicalChoices: 0.05,
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}

export class RecommendationEngine {
  private readonly weights: RankingWeights

  constructor(weights: Partial<RankingWeights> = {}) {
    this.weights = { ...DEFAULT_RANKING_WEIGHTS, ...weights }
  }

  rank(
    offers: BrainV1Offer[],
    entities: BrainV1Entities,
    longTerm?: BrainV1LongTermMemory,
  ): BrainV1Offer[] {
    if (offers.length === 0) return []

    const prices = offers.map((o) => o.price).filter((p): p is number => p != null)
    const minPrice = prices.length ? Math.min(...prices) : null
    const maxPrice = prices.length ? Math.max(...prices) : null
    const durations = offers
      .map((o) => o.durationMinutes)
      .filter((d): d is number => d != null)
    const minDuration = durations.length ? Math.min(...durations) : null
    const maxDuration = durations.length ? Math.max(...durations) : null

    const preferredAirlines = [
      ...(entities.preferredAirline ? [entities.preferredAirline] : []),
      ...(longTerm?.preferences.preferredAirlines ?? []),
      ...(longTerm?.favoriteAirlines ?? []),
    ].map((a) => a.toLowerCase())

    const previousSelections = new Set(longTerm?.previousSelections ?? [])
    const maxStopsPref = longTerm?.preferences.maxStops
    const refundPref = longTerm?.preferences.refundablePreferred ?? false
    const hotelStarMin =
      entities.starLevel ?? entities.hotelRating ?? longTerm?.preferences.hotelStarMin

    return [...offers]
      .map((offer) => {
        const reasons: string[] = []
        const breakdown: BrainV1ScoreBreakdown = {
          price: 50,
          stops: 50,
          travelTime: 50,
          refundability: 50,
          airlineQuality: 50,
          hotelQuality: 50,
          travelerPreferences: 50,
          historicalChoices: 50,
          overall: 0,
        }

        // Price (lower is better; budget-aware).
        if (offer.price != null && minPrice != null && maxPrice != null) {
          if (maxPrice === minPrice) {
            breakdown.price = 80
          } else {
            breakdown.price = clamp(
              100 - ((offer.price - minPrice) / (maxPrice - minPrice)) * 100,
            )
          }
          if (entities.budget != null) {
            if (offer.price <= entities.budget) {
              breakdown.price = clamp(breakdown.price + 10)
              reasons.push('Within budget')
            } else {
              breakdown.price = clamp(breakdown.price - 25)
              reasons.push('Above budget')
            }
          } else {
            reasons.push('Price weighed')
          }
        }

        // Stops (flights).
        if (offer.kind === 'flight' || offer.kind === 'package') {
          const stops = offer.stops ?? 1
          if (stops === 0) {
            breakdown.stops = 100
            reasons.push('Non-stop')
          } else if (stops === 1) {
            breakdown.stops = 65
          } else {
            breakdown.stops = clamp(40 - (stops - 2) * 15)
          }
          if (maxStopsPref != null && stops <= maxStopsPref) {
            breakdown.stops = clamp(breakdown.stops + 10)
            reasons.push('Matches stop preference')
          }
        }

        // Travel time.
        if (
          offer.durationMinutes != null
          && minDuration != null
          && maxDuration != null
        ) {
          if (maxDuration === minDuration) {
            breakdown.travelTime = 80
          } else {
            breakdown.travelTime = clamp(
              100
              - ((offer.durationMinutes - minDuration)
                / (maxDuration - minDuration))
                * 100,
            )
          }
          reasons.push('Travel time weighed')
        }

        // Refundability / cancellation.
        if (offer.refundable || offer.freeCancellation) {
          breakdown.refundability = 90
          reasons.push(offer.refundable ? 'Refundable' : 'Free cancellation')
        } else if (offer.refundable === false) {
          breakdown.refundability = 35
        }
        if (refundPref && (offer.refundable || offer.freeCancellation)) {
          breakdown.refundability = clamp(breakdown.refundability + 10)
        }

        // Airline quality.
        if (offer.airline) {
          const base = offer.qualityScore ?? 60
          breakdown.airlineQuality = clamp(base)
          if (preferredAirlines.some((p) => offer.airline!.toLowerCase().includes(p))) {
            breakdown.airlineQuality = clamp(breakdown.airlineQuality + 25)
            breakdown.travelerPreferences = clamp(breakdown.travelerPreferences + 30)
            reasons.push('Preferred airline')
          }
        }

        // Hotel quality.
        if (offer.kind === 'hotel' || offer.kind === 'package') {
          const rating = offer.hotelRating ?? (offer.qualityScore != null ? offer.qualityScore / 20 : null)
          if (rating != null) {
            breakdown.hotelQuality = clamp(rating * 20)
            reasons.push('Hotel rating')
            if (hotelStarMin != null && rating >= hotelStarMin) {
              breakdown.hotelQuality = clamp(breakdown.hotelQuality + 15)
              breakdown.travelerPreferences = clamp(breakdown.travelerPreferences + 20)
              reasons.push('Meets star preference')
            }
          }
        }

        // Historical choices.
        if (previousSelections.has(offer.id)) {
          breakdown.historicalChoices = 95
          reasons.push('Previously selected')
        } else if (
          offer.airline
          && preferredAirlines.some((p) => offer.airline!.toLowerCase().includes(p))
        ) {
          breakdown.historicalChoices = 70
        }

        const w = this.weights
        const overall =
          breakdown.price * w.price
          + breakdown.stops * w.stops
          + breakdown.travelTime * w.travelTime
          + breakdown.refundability * w.refundability
          + breakdown.airlineQuality * w.airlineQuality
          + breakdown.hotelQuality * w.hotelQuality
          + breakdown.travelerPreferences * w.travelerPreferences
          + breakdown.historicalChoices * w.historicalChoices

        breakdown.overall = Math.round(overall * 10) / 10

        return {
          ...offer,
          score: breakdown.overall,
          scoreBreakdown: breakdown,
          reasons,
        }
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }
}

export function createRecommendationEngine(
  weights?: Partial<RankingWeights>,
): RecommendationEngine {
  return new RecommendationEngine(weights)
}
