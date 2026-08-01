/**
 * Sprint 81 — RecommendationEngine (Brain v1).
 * Deterministic ranking over injectable offers (no live providers in Phase 1).
 */

import type {
  BrainV1Entities,
  BrainV1LongTermMemory,
  BrainV1Offer,
} from './types'

export class RecommendationEngine {
  rank(
    offers: BrainV1Offer[],
    entities: BrainV1Entities,
    longTerm?: BrainV1LongTermMemory,
  ): BrainV1Offer[] {
    return [...offers]
      .map((offer) => {
        const reasons: string[] = []
        let score = 50

        if (offer.price != null && entities.budget != null) {
          if (offer.price <= entities.budget) {
            score += 15
            reasons.push('Within budget')
          } else {
            score -= 10
            reasons.push('Above budget')
          }
        } else if (offer.price != null) {
          score += Math.max(0, 20 - Math.log10(offer.price + 1) * 3)
          reasons.push('Price considered')
        }

        if (offer.kind === 'flight') {
          if (offer.stops === 0) {
            score += 12
            reasons.push('Non-stop')
          } else if ((offer.stops ?? 0) >= 2) {
            score -= 8
          }
          if (offer.durationMinutes != null) {
            score += Math.max(0, 10 - offer.durationMinutes / 120)
            reasons.push('Duration weighed')
          }
          const preferred = entities.preferredAirline
            ?? longTerm?.favoriteAirlines[0]
            ?? longTerm?.preferences.preferredAirlines[0]
          if (preferred && offer.airline && offer.airline.toLowerCase().includes(preferred.toLowerCase())) {
            score += 10
            reasons.push('Preferred airline')
          }
          if (offer.refundable) {
            score += 6
            reasons.push('Refundable')
          }
        }

        if (offer.kind === 'hotel') {
          const minStars = entities.starLevel ?? entities.hotelRating ?? longTerm?.preferences.hotelStarMin
          if (minStars != null && (offer.hotelRating ?? 0) >= minStars) {
            score += 10
            reasons.push('Meets star preference')
          } else if (offer.hotelRating != null) {
            score += offer.hotelRating * 2
            reasons.push('Hotel rating')
          }
          if (offer.freeCancellation) {
            score += 6
            reasons.push('Free cancellation')
          }
        }

        if (longTerm?.preferences.refundablePreferred && offer.refundable) {
          score += 4
        }

        return {
          ...offer,
          score: Math.round(score * 10) / 10,
          reasons,
        }
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  }
}

export function createRecommendationEngine(): RecommendationEngine {
  return new RecommendationEngine()
}
