/**
 * Sprint 41 — Rahhal markup / channel pricing adjustments.
 */

import type { PricingChannel } from './types'

const CHANNEL_MARKUP: Record<PricingChannel, number> = {
  b2c: 1,
  b2b: 0.85,
  corporate: 0.75,
  vip: 1.15,
  membership: 0.9,
}

export class MarkupEngine {
  rahhalMarkup(baseFare: number, percent = 8, channel: PricingChannel = 'b2c'): number {
    const adjusted = percent * (CHANNEL_MARKUP[channel] ?? 1)
    return round2(baseFare * (adjusted / 100))
  }

  channelFactor(channel: PricingChannel): number {
    return CHANNEL_MARKUP[channel] ?? 1
  }
}

export function createMarkupEngine(): MarkupEngine {
  return new MarkupEngine()
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
