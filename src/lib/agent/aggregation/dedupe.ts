import type { NormalizedOffer } from './types'

export interface DedupeResult {
  items: NormalizedOffer[]
  duplicatesRemoved: number
}

/**
 * Remove duplicate offers by fingerprint, keeping the higher confidence / rank candidate.
 */
export function dedupeOffers(offers: NormalizedOffer[]): DedupeResult {
  const best = new Map<string, NormalizedOffer>()
  let duplicatesRemoved = 0

  for (const offer of offers) {
    const existing = best.get(offer.fingerprint)
    if (!existing) {
      best.set(offer.fingerprint, offer)
      continue
    }
    duplicatesRemoved += 1
    best.set(offer.fingerprint, pickWinner(existing, offer))
  }

  return {
    items: [...best.values()],
    duplicatesRemoved,
  }
}

function pickWinner(a: NormalizedOffer, b: NormalizedOffer): NormalizedOffer {
  if (b.confidence !== a.confidence) return b.confidence > a.confidence ? b : a
  if (b.rankScore !== a.rankScore) return b.rankScore > a.rankScore ? b : a
  // Prefer cheaper when tied
  if (a.price != null && b.price != null && a.price !== b.price) {
    return b.price < a.price ? b : a
  }
  return a
}
