import type { NormalizedOffer, ProviderMetadata } from './types'

/**
 * Rank offers: confidence, domain hints, and provider priority.
 */
export function rankOffers(
  offers: NormalizedOffer[],
  metadataByProvider: Map<string, ProviderMetadata>,
): NormalizedOffer[] {
  const ranked = offers.map((offer) => {
    const meta = metadataByProvider.get(offer.providerId)
    const priorityBoost = (meta?.priority ?? 0) / 100
    const priceBoost = offer.scoreHints.priceCompetitiveness ?? 0.5
    const ratingBoost = offer.scoreHints.rating ?? 0.5
    const durationBoost = offer.scoreHints.durationQuality ?? 0.5
    const relevanceBoost = offer.scoreHints.relevance ?? 0.5
    const rankScore = clamp(
      offer.confidence * 0.45
      + priceBoost * 0.2
      + ratingBoost * 0.15
      + durationBoost * 0.1
      + relevanceBoost * 0.05
      + priorityBoost * 0.05,
    )
    return { ...offer, rankScore }
  })

  return ranked.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    if (a.price != null && b.price != null) return a.price - b.price
    return a.title.localeCompare(b.title)
  })
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
