/**
 * Intent Registry + feature gate.
 * Flag `brain.intent_engine` default OFF.
 * Distinct from Sprint 19 `brain.intent`.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type {
  IntentKindId,
  IntentRegistryEntry,
  IntentSectionId,
  IntentSectionRegistryEntry,
} from './types'
import {
  INTENT_KINDS,
  INTENT_SECTION_IDS,
  domainForIntent,
} from './types'

export const BRAIN_INTENT_ENGINE_FEATURE_ID = 'brain.intent_engine' as const

export function isBrainIntentEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_INTENT_ENGINE_FEATURE_ID)
}

export const INTENT_KIND_REGISTRY: readonly IntentRegistryEntry[] =
  INTENT_KINDS.map((intentKind) => ({
    id: `ireg-${intentKind}`,
    intentKind,
    domainHint: domainForIntent(intentKind),
    label: intentKind,
    enabledHint: false as const,
  }))

export const INTENT_SECTION_REGISTRY: readonly IntentSectionRegistryEntry[] =
  INTENT_SECTION_IDS.map((sectionId) => ({
    id: `isec-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listIntentKindRegistry(): IntentRegistryEntry[] {
  return INTENT_KIND_REGISTRY.map((entry) => ({ ...entry }))
}

export function listIntentSectionRegistry(): IntentSectionRegistryEntry[] {
  return INTENT_SECTION_REGISTRY.map((entry) => ({ ...entry }))
}

export function listIntentKinds(): readonly IntentKindId[] {
  return INTENT_KINDS
}

export function listIntentSectionIds(): readonly IntentSectionId[] {
  return INTENT_SECTION_IDS
}

export const IntentRegistry = {
  featureId: BRAIN_INTENT_ENGINE_FEATURE_ID,
  isEnabled: isBrainIntentEngineEnabled,
  listKinds: listIntentKindRegistry,
  listSections: listIntentSectionRegistry,
  kinds: listIntentKinds,
  sectionIds: listIntentSectionIds,
}
