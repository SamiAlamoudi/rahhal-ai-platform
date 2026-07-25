/**
 * Loyalty section registry + feature gate.
 * Flag `brain.loyalty_platform` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { LoyaltyRegistryEntry, LoyaltySectionId } from './types'
import { LOYALTY_SECTION_IDS } from './types'

export const BRAIN_LOYALTY_PLATFORM_FEATURE_ID =
  'brain.loyalty_platform' as const

export function isBrainLoyaltyPlatformEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_LOYALTY_PLATFORM_FEATURE_ID)
}

export const LOYALTY_REGISTRY: readonly LoyaltyRegistryEntry[] =
  LOYALTY_SECTION_IDS.map((sectionId) => ({
    id: `lreg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listLoyaltyRegistry(): LoyaltyRegistryEntry[] {
  return LOYALTY_REGISTRY.map((entry) => ({ ...entry }))
}

export function listLoyaltySectionIds(): readonly LoyaltySectionId[] {
  return LOYALTY_SECTION_IDS
}

export const LoyaltyRegistry = {
  featureId: BRAIN_LOYALTY_PLATFORM_FEATURE_ID,
  isEnabled: isBrainLoyaltyPlatformEnabled,
  list: listLoyaltyRegistry,
  sectionIds: listLoyaltySectionIds,
}
