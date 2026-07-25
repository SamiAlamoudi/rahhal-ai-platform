/**
 * Profile section registry + feature gate.
 * Flag `brain.traveler_profile` default OFF.
 * Distinct from UI flag `ui.traveler_profile`.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { ProfileRegistryEntry, ProfileSectionId } from './types'
import { PROFILE_SECTION_IDS } from './types'

export const BRAIN_TRAVELER_PROFILE_FEATURE_ID =
  'brain.traveler_profile' as const

export function isBrainTravelerProfileEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_TRAVELER_PROFILE_FEATURE_ID)
}

export const PROFILE_REGISTRY: readonly ProfileRegistryEntry[] =
  PROFILE_SECTION_IDS.map((sectionId) => ({
    id: `preg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listProfileRegistry(): ProfileRegistryEntry[] {
  return PROFILE_REGISTRY.map((entry) => ({ ...entry }))
}

export function listProfileSectionIds(): readonly ProfileSectionId[] {
  return PROFILE_SECTION_IDS
}

export const ProfileRegistry = {
  featureId: BRAIN_TRAVELER_PROFILE_FEATURE_ID,
  isEnabled: isBrainTravelerProfileEnabled,
  list: listProfileRegistry,
  sectionIds: listProfileSectionIds,
}
