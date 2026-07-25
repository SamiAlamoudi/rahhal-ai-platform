/**
 * Personalization section registry + feature gate.
 * Flag `brain.personalization_engine` default OFF.
 * Distinct from `ai.personalization` / `ai.recommendation_engine`.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type {
  PersonalizationRegistryEntry,
  PersonalizationSectionId,
} from './types'
import { PERSONALIZATION_SECTION_IDS } from './types'

export const BRAIN_PERSONALIZATION_ENGINE_FEATURE_ID =
  'brain.personalization_engine' as const

export function isBrainPersonalizationEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_PERSONALIZATION_ENGINE_FEATURE_ID)
}

export const PERSONALIZATION_REGISTRY: readonly PersonalizationRegistryEntry[] =
  PERSONALIZATION_SECTION_IDS.map((sectionId) => ({
    id: `preg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listPersonalizationRegistry(): PersonalizationRegistryEntry[] {
  return PERSONALIZATION_REGISTRY.map((entry) => ({ ...entry }))
}

export function listPersonalizationSectionIds(): readonly PersonalizationSectionId[] {
  return PERSONALIZATION_SECTION_IDS
}

export const PersonalizationRegistry = {
  featureId: BRAIN_PERSONALIZATION_ENGINE_FEATURE_ID,
  isEnabled: isBrainPersonalizationEngineEnabled,
  list: listPersonalizationRegistry,
  sectionIds: listPersonalizationSectionIds,
}
