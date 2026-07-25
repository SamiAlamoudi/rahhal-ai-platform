/**
 * Phase 6 Stage 2 — AI Conversation Orchestrator barrel.
 *
 * Architecture / contracts / types only.
 * Distinct from Phase 3 `ai.conversation_orchestrator` (agent execution layer).
 * Gated by `brain.conversation_orchestrator` (default OFF).
 * Not wired into production routes, LLMs, Runtime, or APIs.
 */

import { CONVERSATION_ORCHESTRATOR_ISOLATION as CO_ISOLATION } from './types'
import { ORCHESTRATOR_MODULE_IDS } from './types'

export {
  BRAIN_CONVERSATION_ORCHESTRATOR_FEATURE_ID,
  isBrainConversationOrchestratorEnabled,
  listConversationRegistry,
  ConversationRegistry,
} from './registry'
export type { ConversationRegistryEntry } from './registry'

export type {
  OrchestratorLocale,
  OrchestratorModuleId,
  ConversationIntentKind,
  ConversationStateId,
  ConversationEventKind,
  ConfidenceBand,
  ConversationTurnContract,
  IntentPipelineContract,
  ContextSliceContract,
  ContextBuilderContract,
  MemoryReaderContract,
  MemoryWriterContract,
  PlanningContextContract,
  DecisionContextContract,
  TravelerContextContract,
  BookingContextContract,
  WorkspaceContextContract,
  ConversationSessionContract,
  ConversationTimelineEntry,
  ConversationTimelineContract,
  StateTransitionContract,
  ConversationStateMachineContract,
  ResponsePipelineContract,
  ClarificationEngineContract,
  QuestionGeneratorContract,
  ConfidenceEngineContract,
  ReasoningPipelineContract,
  QueueItemContract,
  TaskQueueContract,
  PlanningQueueContract,
  ConversationEventContract,
  ConversationAnalyticsContract,
  ConversationOrchestrationBlueprint,
} from './types'

export {
  CONVERSATION_ORCHESTRATOR_ISOLATION,
  ORCHESTRATOR_MODULE_IDS,
  CONVERSATION_STATE_IDS,
} from './types'

export {
  buildIntentPipeline,
  buildContextBuilder,
  buildMemoryReader,
  buildMemoryWriter,
  buildPlanningContext,
  buildDecisionContext,
  buildTravelerContext,
  buildBookingContext,
  buildWorkspaceContext,
  buildSession,
  buildTimeline,
  buildStateMachine,
  buildResponsePipeline,
  buildClarificationEngine,
  buildQuestionGenerator,
  buildConfidenceEngine,
  buildReasoningPipeline,
  buildTaskQueue,
  buildPlanningQueue,
  buildEvent,
  buildAnalytics,
} from './pipelines'

export {
  ConversationOrchestrator,
  buildConversationOrchestrationBlueprint,
  tryBuildConversationOrchestrationBlueprint,
  assertConversationOrchestratorIsolation,
} from './orchestrator'
export type { BuildOrchestrationOptions } from './orchestrator'

export const CONVERSATION_ORCHESTRATOR_ARCHITECTURE = {
  version: '6.2.0-conversation-orchestrator',
  featureId: 'brain.conversation_orchestrator' as const,
  architectureOnly: true,
  distinctFromPhase3Flag: 'ai.conversation_orchestrator' as const,
  components: [
    'conversation_orchestrator',
    'intent_pipeline',
    'context_builder',
    'memory_reader',
    'memory_writer',
    'planning_context',
    'decision_context',
    'traveler_context',
    'booking_context',
    'workspace_context',
    'conversation_session',
    'conversation_timeline',
    'conversation_state_machine',
    'response_pipeline',
    'clarification_engine',
    'question_generator',
    'confidence_engine',
    'reasoning_pipeline',
    'task_queue',
    'planning_queue',
    'conversation_events',
    'conversation_registry',
    'conversation_analytics',
  ] as const,
  coordinatedModules: ORCHESTRATOR_MODULE_IDS,
  ...CO_ISOLATION,
} as const
