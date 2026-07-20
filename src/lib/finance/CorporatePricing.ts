/**
 * Sprint 41 — Corporate / VIP / membership / country pricing helpers.
 */

import type { PricingChannel } from './types'

export class CorporatePricing {
  discountPercent(channel: PricingChannel, membershipTier?: string | null): number {
    if (channel === 'corporate') return 12
    if (channel === 'vip') return 5
    if (channel === 'membership') {
      const tier = (membershipTier ?? 'explorer').toLowerCase()
      if (tier === 'diamond') return 10
      if (tier === 'platinum') return 8
      if (tier === 'gold') return 5
      return 2
    }
    if (channel === 'b2b') return 7
    return 0
  }

  countryMultiplier(country?: string | null): number {
    const code = (country ?? 'SA').toUpperCase()
    if (code === 'US' || code === 'GB') return 1.05
    if (code === 'IN') return 0.95
    return 1
  }

  apply(baseFare: number, channel: PricingChannel, country?: string | null, membershipTier?: string | null): number {
    const discounted = baseFare * (1 - this.discountPercent(channel, membershipTier) / 100)
    return round2(discounted * this.countryMultiplier(country))
  }
}

export function createCorporatePricing(): CorporatePricing {
  return new CorporatePricing()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
