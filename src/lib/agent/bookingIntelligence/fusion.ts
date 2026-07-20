/**
 * Result Fusion Engine — merge, dedupe, normalize, confidence + quality.
 */

import { convertMoney, normalizeOfferCurrency, offerFingerprint } from './normalize'
import type { BookingOffer, FusedOffer } from './types'

export function fuseOffers(input: {
  offers: BookingOffer[]
  targetCurrency: string
}): FusedOffer[] {
  const normalized = input.offers.map((offer) => normalizeOfferCurrency(offer, input.targetCurrency))
  const buckets = new Map<string, BookingOffer[]>()

  for (const offer of normalized) {
    const key = offerFingerprint(offer)
    const list = buckets.get(key) ?? []
    list.push(offer)
    buckets.set(key, list)
  }

  const fused: FusedOffer[] = []
  for (const group of buckets.values()) {
    fused.push(fuseGroup(group, input.targetCurrency))
  }

  return fused.sort((a, b) => b.confidence - a.confidence || b.qualityScore - a.qualityScore)
}

function fuseGroup(group: BookingOffer[], targetCurrency: string): FusedOffer {
  const sorted = [...group].sort((a, b) => {
    const pa = a.price.normalizedAmount ?? a.price.amount
    const pb = b.price.normalizedAmount ?? b.price.amount
    return pa - pb
  })
  const best = sorted[0]!
  const prices = sorted.map((o) => o.price.normalizedAmount ?? o.price.amount)
  const avgPrice = prices.reduce((s, n) => s + n, 0) / prices.length
  const spread = Math.max(...prices) - Math.min(...prices)
  const agreement = group.length > 1 ? Math.max(0.55, 1 - spread / Math.max(avgPrice, 1)) : 0.7
  const quality = average(group.map((o) => o.qualityScore ?? ((o.rating ?? 3.5) / 5)))
  const rating = average(group.map((o) => (o.rating ?? 3.5) / 5))
  const confidence = clamp01(0.35 * agreement + 0.35 * quality + 0.3 * rating)

  const converted = convertMoney(best.price, targetCurrency)
  return {
    ...best,
    price: converted,
    qualityScore: clamp01(quality),
    confidence,
    fusedFromProviderIds: [...new Set(group.map((o) => o.providerId))],
  }
}

function average(values: number[]): number {
  if (!values.length) return 0.5
  return values.reduce((s, n) => s + n, 0) / values.length
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
