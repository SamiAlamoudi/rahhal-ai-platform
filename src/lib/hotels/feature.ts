/**
 * Sprint 30 — FeatureRegistry gate for hotel provider foundation.
 */

import { getFeatureRegistry } from '../ai/featureFlags/featureRegistry'
import type { FeatureId } from '../ai/featureFlags/types'

export const HOTEL_PROVIDER_FOUNDATION_FEATURE_ID =
  'providers.hotel_foundation' as const satisfies FeatureId

export function isHotelProviderFoundationEnabled(options?: {
  force?: boolean
}): boolean {
  if (options?.force === true) return true
  if (options?.force === false) return false
  try {
    return getFeatureRegistry().isEnabled(HOTEL_PROVIDER_FOUNDATION_FEATURE_ID)
  } catch {
    return false
  }
}
