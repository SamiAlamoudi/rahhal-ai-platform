/**
 * Sprint 96 — Decision Comparison Cards between shortlisted itineraries.
 */

import type {
  ConciergeAlternativeScenario,
  ConciergeComparisonCard,
  ConciergeOfferFacts,
  ConciergeTripFacts,
} from './types'

function hotelQualityLabel(stars: number | null | undefined, rating: number | null | undefined): string | null {
  if (stars != null && stars >= 5) return 'Luxury (5★)'
  if (stars != null && stars >= 4) return 'High (4★+)'
  if (stars != null && stars >= 3) return 'Good (3★+)'
  if (rating != null && rating >= 4.2) return 'Highly rated'
  if (rating != null) return `Rated ${rating}`
  return null
}

function valueScore(input: {
  price: number | null
  budget: number | null
  stops: number | null
  durationMinutes: number | null
  stars: number | null
  isRecommended: boolean
}): number {
  let score = 0.55
  if (input.isRecommended) score += 0.15
  if (input.budget != null && input.price != null && input.budget > 0) {
    const ratio = input.price / input.budget
    if (ratio <= 0.85) score += 0.12
    else if (ratio <= 1.05) score += 0.06
    else score -= 0.08
  }
  if (input.stops === 0) score += 0.08
  else if ((input.stops ?? 0) >= 2) score -= 0.06
  if (input.durationMinutes != null && input.durationMinutes < 300) score += 0.05
  if ((input.stars ?? 0) >= 4) score += 0.06
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
}

export function buildComparisonCards(input: {
  trip: ConciergeTripFacts
  offers?: ConciergeOfferFacts
  alternatives: ConciergeAlternativeScenario[]
}): ConciergeComparisonCard[] {
  const trip = input.trip
  const offers = input.offers ?? {}
  const flight = offers.flights?.[0]
  const hotel = offers.hotels?.[0]
  const currency = (trip.currency || flight?.currency || 'SAR').toUpperCase()
  const recommendedKind = 'best_value'

  const cards: ConciergeComparisonCard[] = input.alternatives.map((alt) => {
    const isRecommended = alt.kind === recommendedKind
    const stops = flight?.stops ?? (alt.kind === 'fastest' ? 0 : alt.kind === 'best_price' ? 1 : null)
    const duration = flight?.durationMinutes
      ?? (alt.kind === 'fastest' ? 180 : alt.kind === 'best_comfort' ? 240 : 210)
    const stars = hotel?.stars ?? (alt.kind === 'luxury' ? 5 : alt.kind === 'best_comfort' ? 4 : 3)
    const price = alt.estimatedCost
    const overallValue = valueScore({
      price,
      budget: trip.budgetAmount ?? null,
      stops,
      durationMinutes: duration,
      stars,
      isRecommended,
    })

    return {
      optionId: alt.optionId || `concierge_opt_${alt.kind}`,
      title: alt.label,
      price,
      currency: alt.currency || currency,
      durationMinutes: duration,
      stops,
      hotelQuality: hotelQualityLabel(stars, hotel?.rating ?? null),
      overallValue,
      recommendationReason: alt.explanation,
      isRecommended,
    }
  })

  // Ensure exactly one recommended card
  if (!cards.some((c) => c.isRecommended) && cards.length > 0) {
    const valueCard = cards.find((c) => c.title === 'Best Value') ?? cards[0]
    valueCard.isRecommended = true
  }

  return cards
}
