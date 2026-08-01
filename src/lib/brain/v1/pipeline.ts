/**
 * Sprint 82 — Brain v1 reasoning pipeline.
 *
 * Understand → resolve context → load memory → detect missing →
 * choose tools → collect results → evaluate → rank → explain →
 * natural answer → booking actions.
 *
 * When `ai.brain.v1` is OFF: returns enabled:false with empty work.
 * Not wired into travelAgentService.planTurn / Voice / UI.
 */

import { ClarificationPlanner } from './ClarificationPlanner'
import { ConversationContext } from './ConversationContext'
import { ConversationHistory } from './ConversationHistory'
import { ConversationPlanner } from './ConversationPlanner'
import { EntityExtractor } from './EntityExtractor'
import { ExplainabilityEngine } from './ExplainabilityEngine'
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
  emptyPlannerState,
  type BrainV1Offer,
  type BrainV1ToolId,
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
  explainabilityEngine?: ExplainabilityEngine
  travelReasoner?: TravelReasoner
  conversationPlanner?: ConversationPlanner
  promptBuilder?: PromptBuilder
  responseComposer?: ResponseComposer
  safetyLayer?: SafetyLayer
}

function disabledResult(input: BrainV1TurnInput): BrainV1TurnResult {
  const session = new SessionState(input.sessionId, input.priorSession)
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
    planner: emptyPlannerState(),
    rankedOffers: [],
    explanation: null,
    collectedOffers: [],
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
    preferenceMemory: {
      cabinClass: null,
      maxStops: null,
      preferredAirlines: [],
      hotelStarMin: null,
      refundablePreferred: false,
      currency: null,
      typicalBudget: null,
    },
    promptPreview: '',
  }
}

/** Collect injectable provider results by selected tools (no live providers). */
function collectProviderResults(
  tools: BrainV1ToolId[],
  input: BrainV1TurnInput,
): BrainV1Offer[] {
  const byTool = input.providerResultsByTool
  if (byTool) {
    const collected: BrainV1Offer[] = []
    for (const tool of tools) {
      if (tool === 'none') continue
      const batch = byTool[tool]
      if (batch?.length) collected.push(...batch)
    }
    if (collected.length) return collected
  }
  return input.candidateOffers ?? []
}

/**
 * Run one Brain v1 consultant turn (reasoning engine).
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
  const explainabilityEngine = deps.explainabilityEngine ?? new ExplainabilityEngine()
  const travelReasoner = deps.travelReasoner ?? new TravelReasoner()
  const conversationPlanner = deps.conversationPlanner ?? new ConversationPlanner()
  const promptBuilder = deps.promptBuilder ?? new PromptBuilder()
  const responseComposer = deps.responseComposer ?? new ResponseComposer()
  const safetyLayer = deps.safetyLayer ?? new SafetyLayer()

  const session = new SessionState(input.sessionId, input.priorSession)
  if (input.interrupted) session.markInterrupted()

  const history = new ConversationHistory(input.history)
  history.append('user', input.text)
  const memory = createMemoryManager(session, history, input.longTerm)
  const locale = input.locale ?? 'ar'
  const context = new ConversationContext(session, history, locale)

  // 1) Understand request (continue prior intent on slot-fill recovery turns)
  let intent = intentDetector.detect(input.text)
  const priorIntent = input.priorSession?.lastIntent
  if (
    priorIntent
    && priorIntent !== 'unknown'
    && priorIntent !== 'general_conversation'
    && (intent.intent === 'unknown' || intent.intent === 'general_conversation')
    && intent.confidence < 0.75
  ) {
    intent = {
      intent: priorIntent,
      confidence: Math.max(intent.confidence, 0.62),
      secondary: intent.intent === 'unknown' ? [] : [intent.intent],
    }
  }
  memory.rememberIntent(intent.intent)

  // 2) Resolve conversation context + merge entities into session
  const extracted = entityExtractor.extract(input.text, session.getSnapshot().entities)
  const entities = session.mergeEntities(extracted)

  // 3) Load memory (preference + long-term soft defaults)
  const longTerm = memory.getLongTermMemory()
  const preferenceMemory = memory.getPreferenceMemory()
  if (!entities.cabinClass && preferenceMemory.cabinClass) {
    entities.cabinClass = preferenceMemory.cabinClass
  }
  if (!entities.currency && preferenceMemory.currency) {
    entities.currency = preferenceMemory.currency
  }
  if (!entities.preferredAirline && preferenceMemory.preferredAirlines[0]) {
    entities.preferredAirline = preferenceMemory.preferredAirlines[0]
  }
  session.mergeEntities(entities)

  // 4) Detect missing entities → one clarification max
  const { missing, clarifications } = clarificationPlanner.plan(intent.intent, entities)
  memory.setPendingClarification(clarifications[0]?.field ?? null)

  // 5) Choose tools via registry
  const tools = toolDecisionEngine.select(intent.intent, missing)

  // 6) Collect provider results (injectable only)
  const collectedOffers =
    missing.length > 0 || tools.includes('none')
      ? []
      : collectProviderResults(tools, input)

  // 7–8) Evaluate + rank
  const rankedOffers = recommendationEngine.rank(collectedOffers, entities, longTerm)
  const explanation = explainabilityEngine.explain(rankedOffers)

  // Attach explanations onto top offer for composers.
  if (rankedOffers[0] && explanation) {
    rankedOffers[0] = {
      ...rankedOffers[0],
      explanationAr: explanation.ar,
      explanationEn: explanation.en,
    }
  }

  const { plan, state: plannerState } = conversationPlanner.plan({
    intent: intent.intent,
    missing,
    clarifications,
    tools,
    priorPlanner: input.priorSession?.plannerState ?? null,
    interrupted: Boolean(input.interrupted || input.priorSession?.plannerState?.interrupted),
    hasOffers: rankedOffers.length > 0,
  })
  session.setPlannerState(plannerState)

  const composed = responseComposer.compose({
    intent: intent.intent,
    entities,
    plan,
    clarification: clarifications[0] ?? null,
    topOffer: rankedOffers[0] ?? null,
    explanation,
    planner: plannerState,
  })
  const guarded = safetyLayer.guardResponse(composed.ar, composed.en)

  const reasoning = travelReasoner.reason({
    intent: intent.intent,
    entities,
    missing,
    tools,
    collected: collectedOffers,
    ranked: rankedOffers,
    explanation,
    planner: plannerState,
    preferenceMemory,
    bookingActionCount: composed.bookingActions.length,
  })

  const promptPreview = promptBuilder.build({
    intent: intent.intent,
    entities,
    plan,
    topOffer: rankedOffers[0] ?? null,
    clarification: clarifications[0] ?? null,
  })

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
    planner: plannerState,
    rankedOffers,
    explanation,
    collectedOffers,
    responseAr: guarded.ar,
    responseEn: guarded.en,
    bookingActions: composed.bookingActions,
    safe: guarded.safe,
    safetyNotes: guarded.notes,
    session: memory.getSessionMemory(),
    conversation: memory.getConversationMemory(),
    preferenceMemory,
    promptPreview,
  }
}
