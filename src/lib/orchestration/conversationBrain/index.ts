/**
 * Phase 7 Stage 12 — AI Conversation Brain Orchestrator barrel.
 *
 * Architecture / contracts / types / blueprints only.
 * Gated by `brain.conversation_brain` (default OFF).
 * Distinct from src/lib/agent/conversationBrain,
 * brain.conversation_orchestrator, and ai.conversation_orchestrator.
 * Coordinates Phase 7 engines through contracts only — never invokes them.
 */

import { CONVERSATION_BRAIN_ISOLATION as CB_ISOLATION } from './types'
import {
  CONVERSATION_BRAIN_ENGINE_HINTS,
  CONVERSATION_BRAIN_LIFECYCLE_ACTIONS,
  CONVERSATION_BRAIN_PIPELINE_STAGES,
  CONVERSATION_BRAIN_SECTION_IDS,
  CONVERSATION_BRAIN_STRATEGY_HINTS,
} from './types'

export {
  BRAIN_CONVERSATION_BRAIN_FEATURE_ID,
  CONVERSATION_BRAIN_REGISTRY,
  ConversationBrainOrchestrator,
  assertConversationBrainIsolation,
  buildConversationBrainBlueprint,
  buildConversationBrainEngineContract,
  isBrainConversationBrainEnabled,
  listConversationBrainRegistry,
  tryBuildConversationBrainBlueprint,
} from './engine'
export type { BuildConversationBrainBlueprintOptions } from './engine'

export { buildConversationBrainPipeline } from './pipeline'
export {
  buildConversationBrainSchema,
  buildConversationBrainRequestSample,
  buildConversationBrainStateSample,
  buildConversationBrainStepSample,
  buildConversationBrainDecisionSample,
  buildConversationBrainResultSample,
  buildConversationBrainConfidenceSample,
  buildConversationBrainValidationSample,
  buildConversationBrainSnapshotSample,
  buildConversationBrainRevisionSample,
} from './schema'
export { buildConversationBrainStrategy } from './strategy'
export {
  buildConversationBrainValidationContract,
  buildConversationBrainSnapshotContract,
  buildConversationBrainRevisionContract,
} from './validation'
export { buildConversationBrainLifecycle } from './lifecycle'

export type {
  ConversationBrainLocale,
  ConversationBrainSectionId,
  ConversationBrainPipelineStageId,
  ConversationBrainEngineHint,
  ConversationBrainRequest,
  ConversationBrainState,
  ConversationBrainStep,
  ConversationBrainDecision,
  ConversationBrainResult,
  ConversationBrainConfidence,
  ConversationBrainValidation,
  ConversationBrainSnapshot,
  ConversationBrainRevision,
  ConversationBrainEngineContract,
  ConversationBrainPipelineContract,
  ConversationBrainSchemaContract,
  ConversationBrainStrategyContract,
  ConversationBrainValidationContract,
  ConversationBrainLifecycleContract,
  ConversationBrainSnapshotContract,
  ConversationBrainRevisionContract,
  ConversationBrainRegistryEntry,
  ConversationBrainBlueprint,
} from './types'

export {
  CONVERSATION_BRAIN_ISOLATION,
  CONVERSATION_BRAIN_SECTION_IDS,
  CONVERSATION_BRAIN_PIPELINE_STAGES,
  CONVERSATION_BRAIN_LIFECYCLE_ACTIONS,
  CONVERSATION_BRAIN_ENGINE_HINTS,
  CONVERSATION_BRAIN_STRATEGY_HINTS,
} from './types'

export const CONVERSATION_BRAIN_ARCHITECTURE = {
  version: '7.12.0-conversation-brain',
  featureId: 'brain.conversation_brain' as const,
  architectureOnly: true,
  components: [
    'conversation_brain_engine',
    'conversation_brain_pipeline',
    'conversation_brain_schema',
    'conversation_brain_strategy',
    'conversation_brain_validation',
    'conversation_brain_lifecycle',
    'conversation_brain_snapshot',
    'conversation_brain_revision',
    'conversation_brain_request_output',
    'conversation_brain_state_output',
    'conversation_brain_step_output',
    'conversation_brain_decision_output',
    'conversation_brain_result_output',
    'conversation_brain_confidence_output',
    'conversation_brain_validation_output',
    'conversation_brain_snapshot_output',
    'conversation_brain_revision_output',
  ] as const,
  pipelineStages: CONVERSATION_BRAIN_PIPELINE_STAGES,
  lifecycleActions: CONVERSATION_BRAIN_LIFECYCLE_ACTIONS,
  coordinatedEngines: CONVERSATION_BRAIN_ENGINE_HINTS,
  strategyHints: CONVERSATION_BRAIN_STRATEGY_HINTS,
  sectionIds: CONVERSATION_BRAIN_SECTION_IDS,
  ...CB_ISOLATION,
} as const
