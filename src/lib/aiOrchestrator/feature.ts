/**
 * Sprint 43 — FeatureRegistry gate for Rahhal AI Orchestrator.
 */

import { getFeatureRegistry } from '../ai'
import { isConversationUiEnabled } from '../chat/conversationExperience/feature'

export const AI_ORCHESTRATOR_FEATURE_ID = 'brain.ai_orchestrator' as const

export function isAiOrchestratorEnabled(options?: {
  aiOrchestratorEnabled?: boolean
}): boolean {
  if (typeof options?.aiOrchestratorEnabled === 'boolean') {
    return options.aiOrchestratorEnabled
  }
  if (!isConversationUiEnabled()) return false
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.finance_platform')
    && registry.isEnabled('brain.ai_orchestrator')
  )
}
