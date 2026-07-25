/**
 * Conversation Registry + feature gate.
 * Flag `brain.conversation_orchestrator` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { OrchestratorModuleId } from './types'
import { ORCHESTRATOR_MODULE_IDS } from './types'

export const BRAIN_CONVERSATION_ORCHESTRATOR_FEATURE_ID =
  'brain.conversation_orchestrator' as const

export function isBrainConversationOrchestratorEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(
    BRAIN_CONVERSATION_ORCHESTRATOR_FEATURE_ID,
  )
}

export interface ConversationRegistryEntry {
  moduleId: OrchestratorModuleId
  role:
    | 'shell'
    | 'conversation'
    | 'workspace'
    | 'decision'
    | 'memory'
    | 'booking'
    | 'operations'
    | 'integration'
}

const ROLE_BY_MODULE: Record<OrchestratorModuleId, ConversationRegistryEntry['role']> = {
  application_shell: 'shell',
  conversation_center: 'conversation',
  voice_center: 'conversation',
  travel_workspace: 'workspace',
  executive_dashboard: 'workspace',
  command_palette: 'shell',
  journey_timeline: 'workspace',
  decision_center: 'decision',
  insights_center: 'decision',
  traveler_profile: 'memory',
  memory_center: 'memory',
  booking_hub: 'booking',
  operations_center: 'operations',
  integration_foundation: 'integration',
}

export function listConversationRegistry(): ConversationRegistryEntry[] {
  return ORCHESTRATOR_MODULE_IDS.map((moduleId) => ({
    moduleId,
    role: ROLE_BY_MODULE[moduleId],
  }))
}

export const ConversationRegistry = {
  featureId: BRAIN_CONVERSATION_ORCHESTRATOR_FEATURE_ID,
  isEnabled: isBrainConversationOrchestratorEnabled,
  list: listConversationRegistry,
}
