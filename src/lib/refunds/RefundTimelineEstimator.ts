/**
 * Sprint 36 — RefundTimelineEstimator
 */

import type { NormalizedRefundPolicy, PolicyServiceKind } from './types'

const DEFAULT_WINDOW: Record<PolicyServiceKind, [number, number]> = {
  flight: [5, 10],
  hotel: [3, 7],
  car_rental: [5, 10],
  activity: [3, 7],
  visa: [10, 20],
  insurance: [7, 14],
}

export class RefundTimelineEstimator {
  estimate(policies: NormalizedRefundPolicy[]): {
    minDays: number
    maxDays: number
    label: string
  } {
    if (!policies.length) {
      return { minDays: 5, maxDays: 7, label: '5–7 business days' }
    }

    let minDays = 0
    let maxDays = 0
    for (const policy of policies) {
      const fallback = DEFAULT_WINDOW[policy.serviceKind]
      const min = policy.refundTimelineBusinessDaysMin || fallback[0]
      const max = policy.refundTimelineBusinessDaysMax || fallback[1]
      minDays = Math.max(minDays, min)
      maxDays = Math.max(maxDays, max)
    }

    if (maxDays < minDays) maxDays = minDays
    return {
      minDays,
      maxDays,
      label: `${minDays}–${maxDays} business days`,
    }
  }
}

export function createRefundTimelineEstimator(): RefundTimelineEstimator {
  return new RefundTimelineEstimator()
}
