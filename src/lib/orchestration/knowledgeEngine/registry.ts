/**
 * Knowledge Registry + feature gate.
 * Flag `brain.knowledge_engine` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type {
  KnowledgeCoverageDomain,
  KnowledgeModuleHint,
  KnowledgeRegistryEntry,
} from './types'
import { KNOWLEDGE_COVERAGE_DOMAINS, KNOWLEDGE_MODULE_HINTS } from './types'

export const BRAIN_KNOWLEDGE_ENGINE_FEATURE_ID = 'brain.knowledge_engine' as const

export function isBrainKnowledgeEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_KNOWLEDGE_ENGINE_FEATURE_ID)
}

function hintsForDomain(
  domain: KnowledgeCoverageDomain,
): readonly KnowledgeModuleHint[] {
  switch (domain) {
    case 'visa':
    case 'policy_reference':
    case 'travel_rules':
    case 'travel_restrictions':
      return ['knowledge_center', 'traveler_profile', 'conversation_center']
    case 'airline':
    case 'airport':
    case 'hotel':
    case 'transportation':
      return ['knowledge_center', 'booking_hub', 'travel_workspace']
    case 'destination':
    case 'country':
    case 'activity':
    case 'culture_reference':
      return ['knowledge_center', 'insights_center', 'decision_center']
    default:
      return ['knowledge_center', 'memory_center', 'conversation_center']
  }
}

export const KNOWLEDGE_REGISTRY: readonly KnowledgeRegistryEntry[] =
  KNOWLEDGE_COVERAGE_DOMAINS.map((domain) => ({
    id: `kreg-${domain}`,
    domain,
    moduleHints: hintsForDomain(domain),
  }))

export function listKnowledgeRegistry(): KnowledgeRegistryEntry[] {
  return KNOWLEDGE_REGISTRY.map((entry) => ({
    ...entry,
    moduleHints: [...entry.moduleHints],
  }))
}

export function listKnowledgeModuleHints() {
  return KNOWLEDGE_MODULE_HINTS
}

export function listKnowledgeCoverageDomains() {
  return KNOWLEDGE_COVERAGE_DOMAINS
}

export const KnowledgeRegistry = {
  featureId: BRAIN_KNOWLEDGE_ENGINE_FEATURE_ID,
  isEnabled: isBrainKnowledgeEngineEnabled,
  list: listKnowledgeRegistry,
  moduleHints: listKnowledgeModuleHints,
  coverageDomains: listKnowledgeCoverageDomains,
}
