import type { NormalizedOffer, ProviderMetadata } from './types'

/**
 * Score offer confidence from provider reliability + payload hints (0..1).
 */
export function scoreOfferConfidence(
  offer: Omit<NormalizedOffer, 'confidenceScore' | 'confidence'>,
  metadata: ProviderMetadata,
): number {
  const hints = offer.scoreHints
  const hintAvg = average([
    hints.priceCompetitiveness,
    hints.durationQuality,
    hints.rating,
    hints.relevance,
  ])
  const base = metadata.reliability * 0.55 + hintAvg * 0.45
  return clamp01(base)
}

export function averageConfidence(offers: NormalizedOffer[]): number {
  if (offers.length === 0) return 0
  return offers.reduce((sum, item) => sum + item.confidence, 0) / offers.length
}

function average(values: Array<number | undefined>): number {
  const present = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (present.length === 0) return 0.5
  return present.reduce((a, b) => a + b, 0) / present.length
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
