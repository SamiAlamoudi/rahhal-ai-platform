/**
 * Phase 4 Stage 4 — Knowledge Center feature gate.
 * Flag `ui.knowledge_center` default OFF.
 * Not wired into production routes / AI / Chat / Voice / Runtime Coordinator / Orchestrator.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const KNOWLEDGE_CENTER_FEATURE_ID = 'ui.knowledge_center' as const

export function isKnowledgeCenterEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(KNOWLEDGE_CENTER_FEATURE_ID)
}

export const KnowledgeCenterRegistry = {
  featureId: KNOWLEDGE_CENTER_FEATURE_ID,
  isEnabled: isKnowledgeCenterEnabled,
}
