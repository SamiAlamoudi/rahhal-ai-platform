/**
 * Travel Search Orchestrator registry + feature gate.
 * Flag `brain.search_orchestrator` default OFF.
 * Distinct from Sprint 24 `brain.search`.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { SearchRegistryEntry, SearchSectionId } from './types'
import { SEARCH_SECTION_IDS } from './types'

export const BRAIN_SEARCH_ORCHESTRATOR_FEATURE_ID =
  'brain.search_orchestrator' as const

export function isBrainSearchOrchestratorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_SEARCH_ORCHESTRATOR_FEATURE_ID)
}

export const SEARCH_REGISTRY: readonly SearchRegistryEntry[] =
  SEARCH_SECTION_IDS.map((sectionId) => ({
    id: `sreg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listSearchRegistry(): SearchRegistryEntry[] {
  return SEARCH_REGISTRY.map((entry) => ({ ...entry }))
}

export function listSearchSectionIds(): readonly SearchSectionId[] {
  return SEARCH_SECTION_IDS
}

export const SearchRegistry = {
  featureId: BRAIN_SEARCH_ORCHESTRATOR_FEATURE_ID,
  isEnabled: isBrainSearchOrchestratorEnabled,
  list: listSearchRegistry,
  sectionIds: listSearchSectionIds,
}
