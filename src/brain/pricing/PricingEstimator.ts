import type { CurrencyCode } from '../types'
import type { TravelDraft } from '../travel/types'

export type PriceBand = {
  currency: CurrencyCode
  low: number
  mid: number
  high: number
  note: string
}

/**
 * Mock price bands — no live pricing APIs.
 */
export class PricingEstimator {
  estimate(draft: TravelDraft): PriceBand {
    const currency = draft.currency ?? 'SAR'
    const nights = draft.durationNights ?? 3
    const adults = draft.travellers?.adults ?? 1
    const base = (draft.destination?.toLowerCase().includes('london') ? 2200 : 1400) * adults
    const hotel = (draft.hotelClass ?? 4) * 180 * nights
    const mid = Math.round(base + hotel)
    return {
      currency,
      low: Math.round(mid * 0.72),
      mid,
      high: Math.round(mid * 1.35),
      note: 'Mock estimate only — not a live fare quote.',
    }
  }

  predictTrend(destination?: string): 'rising' | 'stable' | 'falling' {
    if (!destination) return 'stable'
    const key = destination.toLowerCase()
    if (key.includes('dubai')) return 'rising'
    if (key.includes('cairo')) return 'falling'
    return 'stable'
  }
}
