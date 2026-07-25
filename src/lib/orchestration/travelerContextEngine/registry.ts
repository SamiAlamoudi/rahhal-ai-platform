/**
 * Traveler Context Engine registry + feature gate.
 * Flag `brain.context_engine` default OFF.
 * Distinct from `brain.context_memory` / memory engine.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { ContextRegistryEntry, ContextSectionId } from './types'
import { CONTEXT_SECTION_IDS } from './types'

export const BRAIN_CONTEXT_ENGINE_FEATURE_ID = 'brain.context_engine' as const

export function isBrainContextEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_CONTEXT_ENGINE_FEATURE_ID)
}

export const CONTEXT_REGISTRY: readonly ContextRegistryEntry[] =
  CONTEXT_SECTION_IDS.map((sectionId) => ({
    id: `creg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listContextRegistry(): ContextRegistryEntry[] {
  return CONTEXT_REGISTRY.map((entry) => ({ ...entry }))
}

export function listContextSectionIds(): readonly ContextSectionId[] {
  return CONTEXT_SECTION_IDS
}

export const ContextRegistry = {
  featureId: BRAIN_CONTEXT_ENGINE_FEATURE_ID,
  isEnabled: isBrainContextEngineEnabled,
  list: listContextRegistry,
  sectionIds: listContextSectionIds,
}
