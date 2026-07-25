/**
 * Pipeline & engine contracts — pure builders, no LLM / network / runtime.
 */

import type {
  BookingContextContract,
  ClarificationEngineContract,
  ConfidenceEngineContract,
  ContextBuilderContract,
  ConversationEventContract,
  ConversationIntentKind,
  ConversationSessionContract,
  ConversationStateMachineContract,
  ConversationTimelineContract,
  ConversationTurnContract,
  DecisionContextContract,
  IntentPipelineContract,
  MemoryReaderContract,
  MemoryWriterContract,
  OrchestratorLocale,
  OrchestratorModuleId,
  PlanningContextContract,
  PlanningQueueContract,
  QuestionGeneratorContract,
  ReasoningPipelineContract,
  ResponsePipelineContract,
  TaskQueueContract,
  TravelerContextContract,
  WorkspaceContextContract,
  ConversationAnalyticsContract,
} from './types'
import { ORCHESTRATOR_MODULE_IDS } from './types'

function isoNow(): string {
  return '2026-07-25T00:00:00.000Z'
}

export function buildIntentPipeline(
  turn: ConversationTurnContract,
  detectedIntent: ConversationIntentKind = 'general',
): IntentPipelineContract {
  return {
    kind: 'intent_pipeline',
    inputTurnId: turn.turnId,
    detectedIntent,
    secondaryIntents: [],
    signals: ['architecture_only', 'no_llm'],
    execution: 'none',
  }
}

export function buildContextBuilder(
  sessionId: string,
  moduleIds: readonly OrchestratorModuleId[] = ORCHESTRATOR_MODULE_IDS,
): ContextBuilderContract {
  return {
    kind: 'context_builder',
    sessionId,
    slices: moduleIds.map((moduleId) => ({
      moduleId,
      summary: `Context slice for ${moduleId}`,
      facts: [],
    })),
    execution: 'none',
  }
}

export function buildMemoryReader(sessionId: string): MemoryReaderContract {
  return {
    kind: 'memory_reader',
    sessionId,
    keysRequested: ['preferences', 'last_destination'],
    entries: [],
    execution: 'none',
  }
}

export function buildMemoryWriter(sessionId: string): MemoryWriterContract {
  return {
    kind: 'memory_writer',
    sessionId,
    proposedWrites: [],
    persisted: false,
    execution: 'none',
  }
}

export function buildPlanningContext(): PlanningContextContract {
  return {
    kind: 'planning_context',
    destinationHints: [],
    dateHints: [],
    budgetHints: [],
    moduleTargets: ['travel_workspace', 'journey_timeline', 'decision_center'],
  }
}

export function buildDecisionContext(): DecisionContextContract {
  return {
    kind: 'decision_context',
    alternatives: [],
    criteria: [],
    moduleTargets: ['decision_center', 'insights_center'],
  }
}

export function buildTravelerContext(): TravelerContextContract {
  return {
    kind: 'traveler_context',
    travelerIds: [],
    preferences: [],
    moduleTargets: ['traveler_profile', 'memory_center'],
  }
}

export function buildBookingContext(): BookingContextContract {
  return {
    kind: 'booking_context',
    bookingRefs: [],
    statuses: [],
    moduleTargets: ['booking_hub', 'operations_center'],
  }
}

export function buildWorkspaceContext(): WorkspaceContextContract {
  return {
    kind: 'workspace_context',
    activePanels: [],
    moduleTargets: ['travel_workspace', 'executive_dashboard', 'command_palette'],
  }
}

export function buildSession(
  sessionId: string,
  locale: OrchestratorLocale = 'ar',
): ConversationSessionContract {
  return {
    kind: 'conversation_session',
    sessionId,
    locale,
    openedAtIso: isoNow(),
    stateId: 'idle',
    moduleIds: ORCHESTRATOR_MODULE_IDS,
  }
}

export function buildTimeline(sessionId: string): ConversationTimelineContract {
  return {
    kind: 'conversation_timeline',
    sessionId,
    entries: [
      {
        id: 'tl-open',
        atIso: isoNow(),
        label: 'session_opened',
      },
    ],
  }
}

export function buildStateMachine(): ConversationStateMachineContract {
  return {
    kind: 'conversation_state_machine',
    current: 'idle',
    allowed: [
      'idle',
      'listening',
      'understanding',
      'clarifying',
      'planning',
      'deciding',
      'responding',
      'awaiting_user',
      'closed',
    ],
    lastTransition: null,
    execution: 'none',
  }
}

export function buildResponsePipeline(
  moduleHints: readonly OrchestratorModuleId[],
): ResponsePipelineContract {
  return {
    kind: 'response_pipeline',
    stages: [
      'compose_outline',
      'attach_modules',
      'attach_confidence',
      'finalize_contract',
    ],
    outline: 'Architecture response outline — no LLM text generation.',
    moduleHints,
    execution: 'none',
  }
}

export function buildClarificationEngine(
  missingSlots: readonly string[] = [],
): ClarificationEngineContract {
  return {
    kind: 'clarification_engine',
    needed: missingSlots.length > 0,
    missingSlots,
    execution: 'none',
  }
}

export function buildQuestionGenerator(
  questions: readonly string[] = [],
): QuestionGeneratorContract {
  return {
    kind: 'question_generator',
    questions,
    execution: 'none',
  }
}

export function buildConfidenceEngine(
  score = 0.5,
): ConfidenceEngineContract {
  const band =
    score >= 0.75 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  return {
    kind: 'confidence_engine',
    score,
    band,
    rationale: ['architecture_placeholder'],
    execution: 'none',
  }
}

export function buildReasoningPipeline(): ReasoningPipelineContract {
  return {
    kind: 'reasoning_pipeline',
    steps: [
      {
        id: 'r1',
        label: 'collect_context',
        inputRefs: ['context_builder'],
        outputRef: 'context_bundle',
      },
      {
        id: 'r2',
        label: 'score_confidence',
        inputRefs: ['context_bundle'],
        outputRef: 'confidence',
      },
      {
        id: 'r3',
        label: 'plan_response_contract',
        inputRefs: ['confidence', 'intent'],
        outputRef: 'response_pipeline',
      },
    ],
    execution: 'none',
  }
}

export function buildTaskQueue(): TaskQueueContract {
  return {
    kind: 'task_queue',
    items: [],
    execution: 'none',
  }
}

export function buildPlanningQueue(): PlanningQueueContract {
  return {
    kind: 'planning_queue',
    items: [],
    execution: 'none',
  }
}

export function buildEvent(
  sessionId: string,
  eventKind: ConversationEventContract['eventKind'],
  payloadSummary: string,
): ConversationEventContract {
  return {
    kind: 'conversation_event',
    eventId: `evt-${eventKind}`,
    eventKind,
    sessionId,
    atIso: isoNow(),
    payloadSummary,
  }
}

export function buildAnalytics(
  sessionId: string,
): ConversationAnalyticsContract {
  return {
    kind: 'conversation_analytics',
    sessionId,
    turnCount: 0,
    clarificationCount: 0,
    averageConfidence: 0,
    exported: false,
  }
}
