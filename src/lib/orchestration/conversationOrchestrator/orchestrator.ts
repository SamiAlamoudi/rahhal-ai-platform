/**
 * Conversation Orchestrator facade — builds architecture blueprints only.
 * Never calls LLMs, APIs, Runtime, or production planners.
 */

import { listConversationRegistry } from './registry'
import { isBrainConversationOrchestratorEnabled } from './registry'
import {
  buildAnalytics,
  buildBookingContext,
  buildClarificationEngine,
  buildConfidenceEngine,
  buildContextBuilder,
  buildDecisionContext,
  buildEvent,
  buildIntentPipeline,
  buildMemoryReader,
  buildMemoryWriter,
  buildPlanningContext,
  buildPlanningQueue,
  buildQuestionGenerator,
  buildReasoningPipeline,
  buildResponsePipeline,
  buildSession,
  buildStateMachine,
  buildTaskQueue,
  buildTimeline,
  buildTravelerContext,
  buildWorkspaceContext,
} from './pipelines'
import type {
  ConversationOrchestrationBlueprint,
  ConversationTurnContract,
  OrchestratorLocale,
} from './types'
import { CONVERSATION_ORCHESTRATOR_ISOLATION, ORCHESTRATOR_MODULE_IDS } from './types'

export interface BuildOrchestrationOptions {
  enabled?: boolean
  sessionId?: string
  locale?: OrchestratorLocale
  turn?: ConversationTurnContract
}

export function buildConversationOrchestrationBlueprint(
  options: BuildOrchestrationOptions = {},
): ConversationOrchestrationBlueprint {
  const sessionId = options.sessionId ?? 'session-architecture'
  const locale = options.locale ?? 'ar'
  const turn: ConversationTurnContract = options.turn ?? {
    turnId: 'turn-architecture',
    sessionId,
    role: 'user',
    text: '',
    locale,
    createdAtIso: '2026-07-25T00:00:00.000Z',
  }

  const session = buildSession(sessionId, locale)
  const intent = buildIntentPipeline(turn, 'general')
  const context = buildContextBuilder(sessionId)
  const moduleHints = ORCHESTRATOR_MODULE_IDS

  return {
    version: '6.2.0-conversation-orchestrator',
    featureId: 'brain.conversation_orchestrator',
    presentationArchitectureOnly: true,
    session,
    intent,
    context,
    memoryRead: buildMemoryReader(sessionId),
    memoryWrite: buildMemoryWriter(sessionId),
    planningContext: buildPlanningContext(),
    decisionContext: buildDecisionContext(),
    travelerContext: buildTravelerContext(),
    bookingContext: buildBookingContext(),
    workspaceContext: buildWorkspaceContext(),
    timeline: buildTimeline(sessionId),
    stateMachine: buildStateMachine(),
    response: buildResponsePipeline(moduleHints),
    clarification: buildClarificationEngine([]),
    questions: buildQuestionGenerator([]),
    confidence: buildConfidenceEngine(0.5),
    reasoning: buildReasoningPipeline(),
    taskQueue: buildTaskQueue(),
    planningQueue: buildPlanningQueue(),
    events: [
      buildEvent(sessionId, 'session_started', 'architecture blueprint'),
      buildEvent(sessionId, 'intent_detected', intent.detectedIntent),
      buildEvent(sessionId, 'context_built', `${context.slices.length} slices`),
    ],
    analytics: buildAnalytics(sessionId),
    coordinatedModules: moduleHints,
  }
}

export function tryBuildConversationOrchestrationBlueprint(
  options: BuildOrchestrationOptions = {},
): ConversationOrchestrationBlueprint | null {
  if (!isBrainConversationOrchestratorEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildConversationOrchestrationBlueprint(options)
}

export function assertConversationOrchestratorIsolation(): typeof CONVERSATION_ORCHESTRATOR_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...CONVERSATION_ORCHESTRATOR_ISOLATION,
    architectureOnly: true,
    registrySize: listConversationRegistry().length,
  }
}

export const ConversationOrchestrator = {
  buildBlueprint: buildConversationOrchestrationBlueprint,
  tryBuildBlueprint: tryBuildConversationOrchestrationBlueprint,
  assertIsolation: assertConversationOrchestratorIsolation,
}
