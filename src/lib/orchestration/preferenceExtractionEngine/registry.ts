/**
 * Preference extraction registry + feature gate.
 * Flag `brain.preference_extraction` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type {
  PreferenceExtractionRegistryEntry,
  PreferenceExtractionSectionId,
} from './types'
import { PREFERENCE_EXTRACTION_SECTION_IDS } from './types'

export const BRAIN_PREFERENCE_EXTRACTION_FEATURE_ID =
  'brain.preference_extraction' as const

export function isBrainPreferenceExtractionEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_PREFERENCE_EXTRACTION_FEATURE_ID)
}

export const PREFERENCE_EXTRACTION_REGISTRY: readonly PreferenceExtractionRegistryEntry[] =
  PREFERENCE_EXTRACTION_SECTION_IDS.map((sectionId) => ({
    id: `pxreg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listPreferenceExtractionRegistry(): PreferenceExtractionRegistryEntry[] {
  return PREFERENCE_EXTRACTION_REGISTRY.map((entry) => ({ ...entry }))
}

export function listPreferenceExtractionSectionIds(): readonly PreferenceExtractionSectionId[] {
  return PREFERENCE_EXTRACTION_SECTION_IDS
}

export const PreferenceExtractionRegistry = {
  featureId: BRAIN_PREFERENCE_EXTRACTION_FEATURE_ID,
  isEnabled: isBrainPreferenceExtractionEnabled,
  list: listPreferenceExtractionRegistry,
  sectionIds: listPreferenceExtractionSectionIds,
}
