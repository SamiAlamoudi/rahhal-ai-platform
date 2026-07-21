/**
 * Sprint 80 — analyze behavior history for repeated patterns.
 */

import type { TravelerProfile } from '../profile/TravelerProfile'
import type { InferredPreferenceSignal } from './PreferenceInference'

export function analyzeRepeatedBehavior(profile: TravelerProfile): InferredPreferenceSignal[] {
  const counts = new Map<string, { kind: InferredPreferenceSignal['kind']; value: string; n: number }>()

  for (const event of profile.behaviorHistory) {
    const airline = typeof event.payload.airline === 'string' ? event.payload.airline.toLowerCase() : null
    const hotel = typeof event.payload.hotelBrand === 'string' ? event.payload.hotelBrand.toLowerCase() : null
    const seat = typeof event.payload.seat === 'string' ? event.payload.seat.toLowerCase() : null
    const cabin = typeof event.payload.cabin === 'string' ? event.payload.cabin.toLowerCase() : null

    const bump = (kind: InferredPreferenceSignal['kind'], value: string) => {
      const key = `${kind}:${value}`
      const cur = counts.get(key) ?? { kind, value, n: 0 }
      cur.n += 1
      counts.set(key, cur)
    }

    if (airline && (event.type === 'book' || event.type === 'booking_selection' || event.type === 'select' || event.type === 'accepted_recommendation')) {
      bump('airline', airline)
    }
    if (hotel && (event.type === 'book' || event.type === 'booking_selection' || event.type === 'select' || event.type === 'accepted_recommendation')) {
      bump('hotel_brand', hotel)
    }
    if (seat) bump('seat', seat)
    if (cabin) bump('cabin', cabin)

    if (event.type === 'reject' || event.type === 'rejected_recommendation') {
      if (typeof event.payload.reason === 'string' && /expensive|luxury|price/.test(event.payload.reason)) {
        bump('luxury_vs_value', 'value')
      }
    }
  }

  const signals: InferredPreferenceSignal[] = []
  for (const item of counts.values()) {
    if (item.n >= 2) {
      signals.push({
        kind: item.kind,
        value: item.value,
        polarity: 'prefer',
        source: 'repeated_behavior',
      })
    }
  }
  return signals
}
