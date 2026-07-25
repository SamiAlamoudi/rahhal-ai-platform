/**
 * Memory Registry + feature gate.
 * Flag `brain.memory_engine` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { MemoryRegistryEntry, MemoryStoreKind } from './types'
import { MEMORY_MODULE_HINTS, MEMORY_STORE_KINDS } from './types'

export const BRAIN_MEMORY_ENGINE_FEATURE_ID = 'brain.memory_engine' as const

export function isBrainMemoryEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_MEMORY_ENGINE_FEATURE_ID)
}

const HINTS_BY_STORE: Record<MemoryStoreKind, readonly MemoryRegistryEntry['moduleHints'][number][]> =
  {
    conversation: ['conversation_center', 'memory_center'],
    session: ['conversation_center', 'memory_center'],
    traveler_profile: ['traveler_profile', 'memory_center'],
    preference: ['traveler_profile', 'memory_center'],
    destination: ['insights_center', 'memory_center'],
    trip_history: ['booking_hub', 'journey_timeline', 'memory_center'],
    document: ['traveler_profile', 'memory_center'],
    relationship: ['traveler_profile', 'memory_center'],
    entity: ['memory_center', 'decision_center'],
    knowledge_reference: ['memory_center', 'conversation_center'],
  }

export const MEMORY_REGISTRY: readonly MemoryRegistryEntry[] =
  MEMORY_STORE_KINDS.map((storeKind) => ({
    id: `mreg-${storeKind}`,
    storeKind,
    moduleHints: HINTS_BY_STORE[storeKind],
  }))

export function listMemoryRegistry(): MemoryRegistryEntry[] {
  return MEMORY_REGISTRY.map((entry) => ({
    ...entry,
    moduleHints: [...entry.moduleHints],
  }))
}

export function listMemoryModuleHints() {
  return MEMORY_MODULE_HINTS
}

export const MemoryRegistry = {
  featureId: BRAIN_MEMORY_ENGINE_FEATURE_ID,
  isEnabled: isBrainMemoryEngineEnabled,
  list: listMemoryRegistry,
  moduleHints: listMemoryModuleHints,
}
