/**
 * Conversation Brain Orchestrator facade — builds architecture blueprints only.
 * Coordinates Phase 7 engines through contracts — never invokes them.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import { buildConversationBrainPipeline } from './pipeline'
import {
  buildConversationBrainConfidenceSample,
  buildConversationBrainDecisionSample,
  buildConversationBrainRequestSample,
  buildConversationBrainResultSample,
  buildConversationBrainRevisionSample,
  buildConversationBrainSchema,
  buildConversationBrainStateSample,
  buildConversationBrainStepSample,
} from './schema'
import { buildConversationBrainStrategy } from './strategy'
import {
  buildConversationBrainRevisionContract,
  buildConversationBrainSnapshotContract,
  buildConversationBrainValidationContract,
} from './validation'
import { buildConversationBrainLifecycle } from './lifecycle'
import type {
  ConversationBrainBlueprint,
  ConversationBrainLocale,
  ConversationBrainRegistryEntry,
} from './types'
import {
  CONVERSATION_BRAIN_ENGINE_HINTS,
  CONVERSATION_BRAIN_ISOLATION,
  CONVERSATION_BRAIN_SECTION_IDS,
} from './types'

export const BRAIN_CONVERSATION_BRAIN_FEATURE_ID =
  'brain.conversation_brain' as const

export function isBrainConversationBrainEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_CONVERSATION_BRAIN_FEATURE_ID)
}

export const CONVERSATION_BRAIN_REGISTRY: readonly ConversationBrainRegistryEntry[] =
  CONVERSATION_BRAIN_SECTION_IDS.map((sectionId) => ({
    id: `cbreg-${sectionId}`,
    sectionId,
    label: sectionId,
    enabledHint: false as const,
  }))

export function listConversationBrainRegistry(): ConversationBrainRegistryEntry[] {
  return CONVERSATION_BRAIN_REGISTRY.map((entry) => ({ ...entry }))
}

export function buildConversationBrainEngineContract() {
  return {
    kind: 'phase7_conversation_brain_engine' as const,
    version: '7.12.0-conversation-brain' as const,
    execution: 'none' as const,
    books: false as const,
    providerCalled: false as const,
    llmInvoked: false as const,
    httpRequests: false as const,
  }
}

export interface BuildConversationBrainBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: ConversationBrainLocale
}

export function buildConversationBrainBlueprint(
  options: BuildConversationBrainBlueprintOptions = {},
): ConversationBrainBlueprint {
  void options.sessionId
  void options.locale

  const validation = buildConversationBrainValidationContract()
  const snapshot = buildConversationBrainSnapshotContract()

  return {
    version: '7.12.0-conversation-brain',
    featureId: 'brain.conversation_brain',
    architectureOnly: true,
    engine: buildConversationBrainEngineContract(),
    pipeline: buildConversationBrainPipeline(),
    schema: buildConversationBrainSchema(),
    strategy: buildConversationBrainStrategy(),
    validation,
    lifecycle: buildConversationBrainLifecycle(),
    snapshot,
    revision: buildConversationBrainRevisionContract(),
    conversationBrainRequest: buildConversationBrainRequestSample(),
    conversationBrainState: buildConversationBrainStateSample(),
    conversationBrainStep: buildConversationBrainStepSample(),
    conversationBrainDecision: buildConversationBrainDecisionSample(),
    conversationBrainResult: buildConversationBrainResultSample(),
    conversationBrainConfidence: buildConversationBrainConfidenceSample(),
    conversationBrainValidation: validation.validation,
    conversationBrainSnapshot: snapshot.snapshot,
    conversationBrainRevision: buildConversationBrainRevisionSample(),
    registry: listConversationBrainRegistry(),
    coordinatedEngineHints: CONVERSATION_BRAIN_ENGINE_HINTS,
  }
}

export function tryBuildConversationBrainBlueprint(
  options: BuildConversationBrainBlueprintOptions = {},
): ConversationBrainBlueprint | null {
  if (!isBrainConversationBrainEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildConversationBrainBlueprint(options)
}

export function assertConversationBrainIsolation(): typeof CONVERSATION_BRAIN_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...CONVERSATION_BRAIN_ISOLATION,
    architectureOnly: true,
    registrySize: listConversationBrainRegistry().length,
  }
}

export const ConversationBrainOrchestrator = {
  featureId: BRAIN_CONVERSATION_BRAIN_FEATURE_ID,
  isEnabled: isBrainConversationBrainEnabled,
  buildBlueprint: buildConversationBrainBlueprint,
  tryBuildBlueprint: tryBuildConversationBrainBlueprint,
  assertIsolation: assertConversationBrainIsolation,
  listRegistry: listConversationBrainRegistry,
}
