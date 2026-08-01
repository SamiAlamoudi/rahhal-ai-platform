/**
 * Sprint 81 — Brain v1 pipeline (architecture foundation).
 *
 * Flow:
 * intent → entities → memory → missing info → clarify (min) →
 * tools → rank → reason → compose → safety
 *
 * When `ai.brain.v1` is OFF: returns enabled:false with empty work (no side effects).
 * Not wired into travelAgentService.planTurn in Phase 1.
 */

import { ClarificationPlanner } from './ClarificationPlanner'
import { ConversationContext } from './ConversationContext'
import { ConversationHistory } from './ConversationHistory'
import { ConversationPlanner } from './ConversationPlanner'
import { EntityExtractor } from './EntityExtractor'
import { isBrainV1Enabled } from './feature'
import { IntentDetector } from './IntentDetector'
import { createMemoryManager } from './MemoryManager'
import { PromptBuilder } from './PromptBuilder'
import { RecommendationEngine } from './RecommendationEngine'
import { ResponseComposer } from './ResponseComposer'
import { SafetyLayer } from './SafetyLayer'
import { SessionState } from './SessionState'
import { ToolDecisionEngine } from './ToolDecisionEngine'
import { TravelReasoner } from './TravelReasoner'
import {
  BRAIN_V1_VERSION,
  emptyBrainV1Entities,
  type BrainV1TurnInput,
  type BrainV1TurnResult,
} from './types'

export type BrainV1PipelineDeps = {
  enabled?: boolean
  intentDetector?: IntentDetector
  entityExtractor?: EntityExtractor
  clarificationPlanner?: ClarificationPlanner
  toolDecisionEngine?: ToolDecisionEngine
  recommendationEngine?: RecommendationEngine
  travelReasoner?: TravelReasoner
  conversationPlanner?: ConversationPlanner
  promptBuilder?: PromptBuilder
  responseComposer?: ResponseComposer
  safetyLayer?: SafetyLayer
}

function disabledResult(input: BrainV1TurnInput): BrainV1TurnResult {
  const session = new SessionState(input.sessionId)
  const history = new ConversationHistory(input.history)
  return {
    version: BRAIN_V1_VERSION,
    enabled: false,
    intent: { intent: 'unknown', confidence: 0, secondary: [] },
    entities: emptyBrainV1Entities(),
    missing: [],
    clarifications: [],
    tools: ['none'],
    reasoning: [],
    rankedOffers: [],
    responseAr: '',
    responseEn: '',
    bookingActions: [],
    safe: true,
    safetyNotes: ['ai.brain.v1 disabled'],
    session: session.getSnapshot(),
    conversation: {
      turnCount: history.turnCount(),
      recentIntents: [],
      pendingClarification: null,
      summary: null,
    },
    promptPreview: '',
  }
}

/**
 * Run one Brain v1 consultant turn. Architecture foundation only.
 */
export function runBrainV1Turn(
  input: BrainV1TurnInput,
  deps: BrainV1PipelineDeps = {},
): BrainV1TurnResult {
  if (!isBrainV1Enabled({ enabled: deps.enabled })) {
    return disabledResult(input)
  }

  const intentDetector = deps.intentDetector ?? new IntentDetector()
  const entityExtractor = deps.entityExtractor ?? new EntityExtractor()
  const clarificationPlanner = deps.clarificationPlanner ?? new ClarificationPlanner()
  const toolDecisionEngine = deps.toolDecisionEngine ?? new ToolDecisionEngine()
  const recommendationEngine = deps.recommendationEngine ?? new RecommendationEngine()
  const travelReasoner = deps.travelReasoner ?? new TravelReasoner()
  const conversationPlanner = deps.conversationPlanner ?? new ConversationPlanner()
  const promptBuilder = deps.promptBuilder ?? new PromptBuilder()
  const responseComposer = deps.responseComposer ?? new ResponseComposer()
  const safetyLayer = deps.safetyLayer ?? new SafetyLayer()

  const session = new SessionState(input.sessionId)
  const history = new ConversationHistory(input.history)
  history.append('user', input.text)
  const memory = createMemoryManager(session, history, input.longTerm)
  const locale = input.locale ?? 'ar'
  const context = new ConversationContext(session, history, locale)

  const intent = intentDetector.detect(input.text)
  memory.rememberIntent(intent.intent)

  const extracted = entityExtractor.extract(input.text, session.getSnapshot().entities)
  const entities = session.mergeEntities(extracted)

  // Apply long-term soft defaults without inventing trip facts.
  const longTerm = memory.getLongTermMemory()
  if (!entities.cabinClass && longTerm.preferences.cabinClass) {
    entities.cabinClass = longTerm.preferences.cabinClass
  }
  if (!entities.currency && longTerm.profile.currency) {
    entities.currency = longTerm.profile.currency
  }
  session.mergeEntities(entities)

  const { missing, clarifications } = clarificationPlanner.plan(intent.intent, entities)
  memory.setPendingClarification(clarifications[0]?.field ?? null)

  const tools = toolDecisionEngine.select(intent.intent, missing)
  const rankedOffers = recommendationEngine.rank(
    input.candidateOffers ?? [],
    entities,
    longTerm,
  )
  const plan = conversationPlanner.plan({
    intent: intent.intent,
    missing,
    clarifications,
    tools,
  })
  const reasoning = travelReasoner.reason({
    intent: intent.intent,
    entities,
    missing,
    tools,
    ranked: rankedOffers,
  })
  const composed = responseComposer.compose({
    intent: intent.intent,
    entities,
    plan,
    clarification: clarifications[0] ?? null,
    topOffer: rankedOffers[0] ?? null,
  })
  const guarded = safetyLayer.guardResponse(composed.ar, composed.en)
  const promptPreview = promptBuilder.build({
    intent: intent.intent,
    entities,
    plan,
    topOffer: rankedOffers[0] ?? null,
    clarification: clarifications[0] ?? null,
  })

  // Touch context for architecture completeness (future enrich hooks).
  void context.snapshot(intent.intent)

  return {
    version: BRAIN_V1_VERSION,
    enabled: true,
    intent,
    entities,
    missing,
    clarifications,
    tools,
    reasoning,
    rankedOffers,
    responseAr: guarded.ar,
    responseEn: guarded.en,
    bookingActions: composed.bookingActions,
    safe: guarded.safe,
    safetyNotes: guarded.notes,
    session: memory.getSessionMemory(),
    conversation: memory.getConversationMemory(),
    promptPreview,
  }
}
