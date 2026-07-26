/**
 * Single orchestration layer for Travel AI Agent planning.
 * Chat (text + voice) and Saved Trips integrate through this service only.
 *
 * RC-3 — heavy LLM / planner / reasoner / enrich / booking / voice graphs load via
 * `deferredLoaders` only when their code path runs. Feature gates stay static/light.
 */

import type { ChatMessage } from '../chat/chatTypes'
import { getFeatureRegistry } from '../ai'
import type { ConciergeService, ConciergeState } from '../concierge'
import { applyTripPlanEdits, buildTripPlan, regenerateTripDay } from './buildItinerary'
import { applyIntelligentDecisions } from './decision'
import { extractFromUserText } from './extractRequirements'
import type { AgentLlmRegistry } from './llm/types'
import {
  buildTravelFacts,
  runConversationBrain,
  type ConversationObjective,
  type TravelFacts,
} from './conversationBrain'
import {
  buildPlanningDraft,
  canBuildPlanningDraft,
  planningDraftToInsightLines,
} from './planningDraft'
import {
  applySmartClarification,
  mergeRequirements,
  missingRequirementFields,
  rebuildMemoryFromMessages,
} from './memory'
import { saveGeneratedItinerary } from './itineraryPersistence'
import { createToolExecutor } from './tools/executor'
import { mergeToolResultsIntoPlan } from './tools/mergeToolResults'
import { selectToolsForTurn } from './tools/selectTools'
import type { AgentToolRegistry, AgentToolResult, ToolExecutionBatch } from './tools/types'
import { isAutonomousAgentEnabled } from './autonomous/feature'
import type { AutonomousAgentSnapshot, AutonomousProgressEvent } from './autonomous'
import { isBookingIntelligenceEnabled } from './bookingIntelligence/feature'
import type { BookingIntelligenceResult } from './bookingIntelligence'
import { isBudgetIntelligenceEnabled } from './budgetIntelligence/feature'
import type { BudgetIntelligenceResult } from './budgetIntelligence'
import { isIntegrationTripOrchestratorEnabled } from './integrationTripOrchestrator/feature'
import { isIntegrationDestinationIntelligenceEnabled } from './integrationDestinationIntelligence/feature'
import type { DestinationIntelligenceResult } from './integrationDestinationIntelligence/types'
import { isIntegrationTripCompanionEnabled } from './integrationTripCompanion/feature'
import type { TripCompanionResult } from './integrationTripCompanion/types'
import { isIntegrationMapsMobilityEnabled } from './integrationMapsMobility/feature'
import type { MapsMobilityResult } from './integrationMapsMobility/types'
import { isIntegrationBudgetPricingEnabled } from './integrationBudgetPricing/feature'
import type { BudgetPricingResult } from './integrationBudgetPricing/types'
import { isIntegrationDisruptionRecoveryEnabled } from './integrationDisruptionRecovery/feature'
import type { DisruptionRecoveryResult } from './integrationDisruptionRecovery/types'
import { isIntegrationActionExecutionEnabled } from './integrationActionExecution/feature'
import type { ActionExecutionResult } from './integrationActionExecution/types'
import { isIntegrationJourneyEnabled } from './integrationJourney/feature'
import type { JourneyResult } from './integrationJourney/types'
import { isConversationIntelligenceEnabled } from './conversationIntelligence/feature'
import type { ConversationIntelligenceResult } from './conversationIntelligence'
import { isLlmConversationBrainEnabled } from './llmBrain/feature'
import type { LlmBrainResult } from './llmBrain'
import { isAgentRuntimeEnabled } from './agentRuntime/feature'
import type { AgentRuntimeResult } from './agentRuntime'
import { isTravelerPersonalizationEnabled } from './travelerPersonalization/feature'
import type { TravelerPersonalizationResult } from './travelerPersonalization'
import { isTripOptimizerEnabled } from './tripOptimizer/feature'
import type { TripOptimizerResult } from './tripOptimizer'
import { isTravelPlannerEnabled } from './travelPlanner/feature'
import type { TravelPlannerResult } from './travelPlanner'
import { isAutonomousDecisionEnabled } from './autonomousDecision/feature'
import type { AutonomousDecisionResult } from './autonomousDecision'
import { isAdaptiveLearningEnabled } from './adaptiveLearning/feature'
import type { AdaptiveLearningResult } from './adaptiveLearning'
import { isPriceIntelligenceEnabled } from './priceIntelligence/feature'
import type { BookingTimingResult } from './priceIntelligence'
import { isDynamicPackagesEnabled } from './packageBuilder/feature'
import type { PackageBuilderResult } from './packageBuilder'
import { isItineraryRefinementEnabled } from './itineraryRefinement/feature'
import type { RefinementResult } from './itineraryRefinement'
import { isBookingExecutionEnabled } from './bookingExecution/feature'
import type { BookingExecutionResult } from './bookingExecution'
import { isPaymentsEnabled } from './paymentsPlatform/feature'
import type { PaymentsPlatformResult } from './paymentsPlatform'
import type { ConciergeTurnIntegrationResult } from './conciergeIntegration'
import type { AgentAlphaTravelerExperienceAttachment } from './alphaExperience'
import type { AgentBookingAssistantAttachment } from './bookingAssistant'
import type {
  AgentIntent,
  AgentMemory,
  AgentProviderMeta,
  AgentToolRunSummary,
  RegenerateScope,
  TripPlan,
  TripRequirements,
} from './types'
import { withTripPlan } from './types'
import { getBookingHistoryUserId } from '../booking/bookingHistoryContext'
import type { BookingHistoryIntent, BookingRecord } from '../booking'
import type { ConfirmationConciergeIntent } from '../bookingConfirmation'
import type { OrderConciergeIntent } from '../orderManagement'
import type { SmartItineraryConciergeIntent } from '../smartItinerary'
import {
  isBrainAgentHandoffEnabled,
  isBrainConciergeIntegrationEnabled,
  isBrainExecutionEnabled,
  isBrainSearchEnabled,
  isBrainTravelEngineEnabled,
  isBrainTripPlanningEnabled,
} from '../brain/integrationFlags'
import { isBrainTripOrchestratorEnabled } from '../brain/orchestrator/feature'
import type { BrainMetaSnapshot } from '../brain/integration'
import type { BrainTurnResult } from '../brain/types'
import { isRahhalBrainEnabled } from '../brain/core/feature'
import type { RahhalBrainMetaSnapshot, RahhalBrainTurnResult } from '../brain/core'
import { isBookingFlowEnabled } from '../bookingFlow/feature'
import type { SearchAggregationTurnResult } from '../brain/search'
import {
  isPreferenceMemoryEnabled,
  isTravelReasoningEnabled,
} from './reasoning/feature'
import type { TravelReasoningResult } from './reasoning'
import {
  loadAdaptiveLearning,
  loadAlphaExperience,
  loadAutonomous,
  loadAutonomousDecision,
  loadBooking,
  loadBookingAssistant,
  loadBookingConfirmation,
  loadBookingExecution,
  loadBookingFlow,
  loadBookingIntelligence,
  loadBrainCore,
  loadBrainIntegration,
  loadBrainOrchestrator,
  loadBudgetIntelligence,
  loadIntegrationTripOrchestrator,
  loadIntegrationDestinationIntelligence,
  loadIntegrationTripCompanion,
  loadIntegrationMapsMobility,
  loadIntegrationBudgetPricing,
  loadIntegrationDisruptionRecovery,
  loadIntegrationActionExecution,
  loadIntegrationJourney,
  loadConcierge,
  loadConciergeIntegration,
  loadConciergeMeta,
  loadConciergeRecommendations,
  loadConstitution,
  loadConversationIntelligence,
  loadItineraryRefinement,
  loadLlmBrain,
  loadAgentRuntime,
  loadOrderManagement,
  loadPackageBuilder,
  loadPaymentsPlatform,
  loadPriceIntelligence,
  loadReasoning,
  loadSmartItinerary,
  loadToolStubs,
  loadTravelPlanner,
  loadTravelerPersonalization,
  loadTripOptimizer,
} from './deferredLoaders'

const BOOKING_HISTORY_INTENTS = new Set<AgentIntent>([
  'show_trips',
  'show_latest_booking',
  'show_booking_details',
  'summarize_itinerary',
])

const CONFIRMATION_INTENTS = new Set<AgentIntent>([
  'booking_confirmed',
  'show_confirmation',
  'booking_reference',
  'booking_status',
])

const ORDER_PAYMENT_INTENTS = new Set<AgentIntent>([
  'how_much_will_i_pay',
  'is_order_ready',
  'show_checkout',
  'what_is_payment_status',
])

const SMART_ITINERARY_INTENTS = new Set<AgentIntent>([
  'show_my_itinerary',
  'whats_todays_plan',
  'when_leave_for_airport',
  'summarize_my_trip',
])

export interface TravelAgentTurnInput {
  conversationId: string
  messages: ChatMessage[]
  signal?: AbortSignal
  /**
   * Sprint 54 — optional progress sink for autonomous execution streaming.
   * Additive; Conversation Brain still authors the final reply.
   */
  onProgress?: (event: AutonomousProgressEvent) => void
}

export interface TravelAgentTurnResult {
  reply: string
  memory: AgentMemory
  tripPlan: TripPlan | null
  meta: AgentProviderMeta
  toolBatch: ToolExecutionBatch | null
}

export interface TravelAgentServiceOptions {
  tools?: AgentToolRegistry
  llms?: AgentLlmRegistry
  savePlan?: (input: {
    conversationId: string
    tripPlan: TripPlan
  }) => Promise<{ title: string } | null>
  /**
   * Sprint 9 Concierge. Default: FeatureRegistry `ai.concierge`.
   * Pass `false` to disable; pass a service to inject.
   * Concierge is provider-agnostic and only signals agent handoff.
   */
  concierge?: ConciergeService | false
  /** Explicit override for the `ai.concierge` feature flag. */
  conciergeEnabled?: boolean
  /**
   * Sprint 20 — Brain ↔ Concierge integration.
   * Default: FeatureRegistry `brain.enabled` + `brain.concierge` (both OFF).
   * Pass `false` to force off; `true` to force on in tests.
   */
  brainEnabled?: boolean
  /** When true (or flag `brain.agent_handoff`), merge brain slots into agent requirements. */
  brainHandoffEnabled?: boolean
  /**
   * Sprint 21 — Real Travel Conversation Engine.
   * Default: FeatureRegistry `brain.travel_engine` (OFF). Requires brain.concierge chain.
   */
  brainTravelEngineEnabled?: boolean
  /**
   * Sprint 22 — Multi-Step Trip Planning Engine.
   * Default: FeatureRegistry `brain.trip_planning` (OFF). Requires brain.travel_engine.
   */
  brainTripPlanningEnabled?: boolean
  /**
   * Sprint 23 — Travel Execution Engine.
   * Default: FeatureRegistry `brain.execution` (OFF). Requires brain.trip_planning.
   */
  brainExecutionEnabled?: boolean
  /**
   * Sprint 24 — Search Aggregation Engine.
   * Default: FeatureRegistry `brain.search` (OFF). Requires brain.execution.
   */
  brainSearchEnabled?: boolean
  /**
   * Sprint 27 — AI Trip Orchestrator.
   * Default: FeatureRegistry `brain.trip_orchestrator` (OFF). Requires brain.search.
   */
  brainTripOrchestratorEnabled?: boolean
  /**
   * Sprint 45 — Autonomous Travel Reasoning Engine.
   * Default: FeatureRegistry `ai.travel_reasoning` (ON).
   */
  travelReasoningEnabled?: boolean
  /**
   * Sprint 46 — Smart Clarification / Never-Ask-Twice.
   * Default: FeatureRegistry `ai.smart_clarification` (ON).
   */
  smartClarificationEnabled?: boolean
  /**
   * Sprint 50 — Rahhal Brain Core orchestration.
   * Default: FeatureRegistry `ai.rahhal_brain` (ON).
   */
  rahhalBrainEnabled?: boolean
  /**
   * Sprint 54 — Autonomous Travel Agent (goal engine, tool planner, recovery).
   * Default: FeatureRegistry `ai.autonomous_agent` (ON).
   */
  autonomousAgentEnabled?: boolean
  /**
   * Sprint 55 — Real Booking Intelligence (fusion, ranking v2, cost optimizer, readiness).
   * Default: FeatureRegistry `ai.booking_intelligence` (ON).
   */
  bookingIntelligenceEnabled?: boolean
  /**
   * Sprint 75 — Budget Intelligence (allocation, Budget Score, diagnostics).
   * Default: FeatureRegistry `ai.budget_intelligence` (ON).
   */
  budgetIntelligenceEnabled?: boolean
  /**
   * Recovery Phase 4 — Conversation Intelligence (live memory, intent, references).
   * Default: FeatureRegistry `ai.conversation_intelligence` (OFF).
   */
  conversationIntelligenceEnabled?: boolean
  /**
   * Recovery Phase 5 — LLM Conversation Brain (mock LLM primary; rules fallback).
   * Default: FeatureRegistry `ai.llm_conversation_brain` (OFF).
   */
  llmConversationBrainEnabled?: boolean
  /**
   * Recovery Phase 6 — AI Agent Runtime & mock tool execution.
   * Default: FeatureRegistry `ai.agent_runtime` (OFF).
   */
  agentRuntimeEnabled?: boolean
  /**
   * Sprint 76 — Traveler Personalization Intelligence (profile learning, ranking).
   * Default: FeatureRegistry `ai.traveler_personalization` (ON).
   */
  travelerPersonalizationEnabled?: boolean
  /**
   * Sprint 77 — Complete Trip Optimizer (Journey Score across flight+hotel packages).
   * Default: FeatureRegistry `ai.trip_optimizer` (ON).
   */
  tripOptimizerEnabled?: boolean
  /**
   * Sprint 78 — AI Travel Strategy Planner (pre-search strategy, questions, tool order).
   * Default: FeatureRegistry `ai.travel_planner` (ON).
   */
  travelPlannerEnabled?: boolean
  /**
   * Sprint 79 — Autonomous Search & Decision Engine (multi-plan compare & recommend).
   * Default: FeatureRegistry `ai.autonomous_decision` (ON).
   */
  autonomousDecisionEnabled?: boolean
  /**
   * Sprint 80 — Adaptive Learning & Personalization Engine (local preference adaptation).
   * Default: FeatureRegistry `ai.adaptive_learning` (ON).
   */
  adaptiveLearningEnabled?: boolean
  /**
   * Sprint 81 — AI Price Intelligence & Booking Timing.
   * Default: FeatureRegistry `ai.price_intelligence` (ON).
   */
  priceIntelligenceEnabled?: boolean
  /**
   * Sprint 83 — AI Dynamic Travel Packages.
   * Default: FeatureRegistry `ai.dynamic_packages` (ON).
   */
  dynamicPackagesEnabled?: boolean
  /**
   * Sprint 84 — Autonomous Itinerary Refinement Engine.
   * Default: FeatureRegistry `ai.itinerary_refinement` (ON).
   */
  itineraryRefinementEnabled?: boolean
  /**
   * Sprint 57 — Booking Execution Engine (lifecycle, transactions, resume).
   * Default: FeatureRegistry `ai.booking_execution` (ON). Runs only on explicit confirm/book cues.
   */
  bookingExecutionEnabled?: boolean
  /**
   * Sprint 58 — Payments & Ticketing Platform (mock adapters only).
   * Default: FeatureRegistry `ai.payments` (ON). Runs after successful booking execution when pay/confirm cues present.
   */
  paymentsEnabled?: boolean
  /**
   * Phase 2 — AI Travel Executive intelligence.
   * Default: FeatureRegistry `ai.travel_executive` (ON).
   */
  travelExecutiveEnabled?: boolean
  /**
   * Sprint 25 — Production Booking Flow orchestration.
   * Default: FeatureRegistry `ui.booking_flow` (OFF).
   */
  bookingFlowEnabled?: boolean
  /**
   * Sprint 13 — inject booking records for My Trips / history intents.
   * Defaults to loading the signed-in user's BookingSession projections.
   */
  listBookingRecords?: () => Promise<BookingRecord[]>
}

export interface TravelAgentService {
  planTurn(input: TravelAgentTurnInput): Promise<TravelAgentTurnResult>
  regeneratePlan(input: {
    conversationId: string
    memory: AgentMemory
    signal?: AbortSignal
  }): Promise<TripPlan>
  regenerateDay(input: {
    conversationId: string
    plan: TripPlan
    day: number
    locale: AgentMemory['locale']
    signal?: AbortSignal
  }): Promise<TripPlan>
  regenerateScoped(input: {
    conversationId: string
    memory: AgentMemory
    scope: Exclude<RegenerateScope, 'day' | 'whole'>
    signal?: AbortSignal
  }): Promise<TripPlan>
  editPlan(input: {
    conversationId: string
    plan: TripPlan
    patch: Partial<TripRequirements>
    locale: AgentMemory['locale']
    signal?: AbortSignal
  }): Promise<TripPlan>
  savePlan(input: {
    conversationId: string
    tripPlan: TripPlan
    existingSavedTripId?: string | null
  }): Promise<{ id: string; title: string }>
}

function hasPlanningPatch(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).some((key) => {
    if (key === 'regenerateDay') return false
    const value = patch[key]
    if (Array.isArray(value)) return value.length > 0
    return value != null && value !== ''
  })
}

function toMetaConcierge(state: ConciergeState): NonNullable<AgentProviderMeta['concierge']> {
  return {
    phase: state.phase,
    softSignals: {
      pace: state.softSignals.pace,
      mustHaves: state.softSignals.mustHaves,
      dealBreakers: state.softSignals.dealBreakers,
      flexibleDimensions: state.softSignals.flexibleDimensions,
      tradeoffs: state.softSignals.tradeoffs,
      notes: state.softSignals.notes,
    },
    lastAction: state.lastAction,
    heardSummary: [...state.heardSummary],
    turnCount: state.turnCount,
  }
}

function toMetaTravelExecutive(
  executive: NonNullable<RahhalBrainTurnResult['executive']>,
): NonNullable<AgentProviderMeta['travelExecutive']> {
  return {
    travelStyle: executive.context.travelStyle,
    optimizationAxis: executive.context.optimizationAxis,
    rejectedCount: executive.context.rejectedDestinations.length,
    learnedRejections: executive.learnedRejections,
    budgetWarnings: executive.budgetWarnings,
  }
}

function toMetaExecutivePlatform(
  platform: NonNullable<RahhalBrainTurnResult['executivePlatform']>,
): NonNullable<AgentProviderMeta['executivePlatform']> {
  return {
    engineIds: platform.engineIds,
    confidence: platform.confidence,
    alertCount: platform.alerts.length,
    recommendationCount: platform.recommendations.length,
    hasPrimaryReply: Boolean(platform.primaryReply),
  }
}

function toMetaExecutiveOs(
  platform: NonNullable<RahhalBrainTurnResult['executivePlatform']>,
): NonNullable<AgentProviderMeta['executiveOs']> | undefined {
  if (!platform.os) return undefined
  const accept = platform.os.prediction
    && typeof platform.os.prediction.acceptProbability === 'number'
    ? platform.os.prediction.acceptProbability
    : null
  return {
    strategy: platform.os.strategy,
    goal: platform.os.goal,
    engineIds: platform.os.engineIds,
    topOptionCount: platform.os.topOptions.length,
    improvedOnce: platform.os.improvedOnce,
    acceptProbability: accept,
  }
}

function toMetaLiveIntelligence(
  live: NonNullable<RahhalBrainTurnResult['liveIntelligence']>,
): NonNullable<AgentProviderMeta['liveIntelligence']> {
  return {
    domains: live.domains,
    providerIds: live.providerIds,
    confidence: live.confidence,
    degraded: live.degraded,
    latencyMs: live.latencyMs,
    cacheHits: live.cacheHits,
    cacheMisses: live.cacheMisses,
    hasSummary: Boolean(live.summary),
    flightCount: live.flights.length,
    hotelCount: live.hotels.length,
  }
}

function toMetaRahhalBrain(
  meta: RahhalBrainMetaSnapshot,
): NonNullable<AgentProviderMeta['rahhalBrain']> {
  return {
    decision: meta.decision,
    primaryIntent: meta.intents.primary.id,
    intentConfidence: meta.intents.primary.confidence,
    secondaryIntents: meta.intents.secondary.map((row) => row.id),
    discoveryMode: meta.understanding.travelContext.discoveryMode,
    modulesExecuted: meta.modulesExecuted,
    reflected: meta.reflected,
    internalPlanSteps: meta.internalPlan.steps.length,
  }
}

function toMetaAutonomous(
  snapshot: AutonomousAgentSnapshot,
): NonNullable<AgentProviderMeta['autonomous']> {
  return {
    state: snapshot.state,
    progressPhase: snapshot.progressPhase,
    goal: snapshot.goal
      ? {
        id: snapshot.goal.id,
        objective: snapshot.goal.objective,
        description: snapshot.goal.description,
        status: snapshot.goal.status,
        blockingFields: snapshot.goal.blockingFields,
      }
      : null,
    planTaskCount: snapshot.plan?.tasks.length ?? 0,
    completedTaskIds: snapshot.completedTaskIds,
    pendingTaskIds: snapshot.pendingTaskIds,
    lastProviderId: snapshot.lastProviderId,
    totalRetries: snapshot.totalRetries,
    durationMs: snapshot.durationMs,
    outcome: snapshot.outcome,
    recoveredFromFailures: snapshot.recoveredFromFailures,
  }
}

function toMetaBookingIntelligence(
  result: BookingIntelligenceResult,
): NonNullable<AgentProviderMeta['bookingIntelligence']> {
  return {
    bookingReady: result.snapshot.bookingReady,
    clarification: result.snapshot.clarification,
    primaryOfferId: result.snapshot.primaryOfferId,
    rankedCount: result.snapshot.rankedCount,
    domainsSearched: result.snapshot.domainsSearched,
    providerIds: result.snapshot.providerIds,
    topConfidence: result.snapshot.topConfidence,
    topExplanation: result.snapshot.topExplanation,
    bestCombinationId: result.snapshot.bestCombinationId,
    bestCombinationTotal: result.snapshot.bestCombinationTotal
      ? {
        amount: result.snapshot.bestCombinationTotal.amount,
        currency: result.snapshot.bestCombinationTotal.currency,
      }
      : null,
    preferenceUserId: result.snapshot.preferenceUserId,
    durationMs: result.snapshot.durationMs,
  }
}

function toMetaBudgetIntelligence(
  result: BudgetIntelligenceResult,
): NonNullable<AgentProviderMeta['budgetIntelligence']> {
  return {
    budgetDetected: result.diagnostics.budgetDetected,
    currency: result.diagnostics.currency,
    amount: result.diagnostics.amount,
    remainingBudget: result.diagnostics.remainingBudget,
    budgetScore: result.diagnostics.budgetScore,
    intent: result.diagnostics.intent,
    overflow: result.diagnostics.overflow,
    underflow: result.diagnostics.underflow,
    missingBudget: result.diagnostics.missingBudget,
    allocatedFlights: result.allocation?.flights ?? null,
    allocatedHotels: result.allocation?.hotels ?? null,
    durationMs: result.durationMs,
  }
}

function toMetaConversationIntelligence(
  result: ConversationIntelligenceResult,
): NonNullable<AgentProviderMeta['conversationIntelligence']> {
  const locale = result.locale
  return {
    intent: result.intent,
    intentConfidence: result.intentConfidence,
    destination: result.memory.destination,
    adults: result.memory.travelers.adults,
    budgetAmount: result.memory.budgetAmount,
    currency: result.memory.currency,
    monthHint: result.memory.monthHint,
    purpose: result.memory.purpose,
    summaryBullets: locale === 'ar' ? result.summary.bulletsAr : result.summary.bulletsEn,
    questionIds: result.questions.map((q) => q.id),
    insightIds: result.insights.map((i) => i.id),
    streaming: result.streaming,
  }
}

function toMetaLlmBrain(
  result: LlmBrainResult,
): NonNullable<AgentProviderMeta['llmBrain']> {
  return {
    intent: result.intent,
    dialect: result.dialect,
    confidence: result.confidence,
    primaryTool: result.toolDecision.tool,
    destination: result.memory.destination,
    usedRulesFallback: result.usedRulesFallback,
    providerMode: result.debug.providerMode,
    stageCount: result.debug.stages.length,
    proactiveTipCount: result.reasoning.proactiveTips.length,
    responsePreview: result.response.displayText.slice(0, 180),
    debugStages: result.debug.stages.map((s) => ({
      id: s.id,
      label: s.label,
      detail: s.detail,
      confidence: s.confidence,
      source: s.source,
    })),
  }
}

function toMetaAgentRuntime(
  result: AgentRuntimeResult,
): NonNullable<AgentProviderMeta['agentRuntime']> {
  return {
    intent: result.intent,
    dialect: result.dialect,
    tool: result.toolDecision,
    toolStatus: result.toolExecution?.status ?? null,
    confidence: result.confidence,
    eventCount: result.events.length,
    traceCount: result.trace.length,
    interrupted: result.interrupted,
    durationMs: result.durationMs,
    responsePreview: result.responseText.slice(0, 180),
    events: result.events.map((e) => ({ type: e.type, detail: e.detail })),
  }
}

function toMetaTravelerPersonalization(
  result: TravelerPersonalizationResult,
): NonNullable<AgentProviderMeta['travelerPersonalization']> {
  return {
    travelerProfileUsed: result.diagnostics.travelerProfileUsed,
    matchedPreferences: result.diagnostics.matchedPreferences,
    confidenceScores: result.diagnostics.confidenceScores,
    rankingAdjustmentCount: result.diagnostics.rankingAdjustments.length,
    learningEventCount: result.diagnostics.learningEvents.length,
    missingProfile: result.diagnostics.missingProfile,
    durationMs: result.durationMs,
  }
}

function toMetaTripOptimizer(
  result: TripOptimizerResult,
): NonNullable<AgentProviderMeta['tripOptimizer']> {
  const labels = [
    result.recommendations.bestOverall ? 'best_overall' : null,
    result.recommendations.bestValue ? 'best_value' : null,
    result.recommendations.fastest ? 'fastest' : null,
    result.recommendations.luxury ? 'luxury' : null,
    result.recommendations.business ? 'business' : null,
    result.recommendations.family ? 'family' : null,
  ].filter(Boolean) as string[]
  return {
    journeyScore: result.diagnostics.journeyScore,
    priority: result.diagnostics.priority,
    itineraryCount: result.diagnostics.itineraryCount,
    budgetEffect: result.diagnostics.budgetEffect,
    personalizationEffect: result.diagnostics.personalizationEffect,
    tradeoffCount: result.diagnostics.tradeoffs.length,
    bestOverallId: result.recommendations.bestOverall?.id ?? null,
    recommendationLabels: labels,
    durationMs: result.durationMs,
  }
}

function toMetaTravelPlanner(
  result: TravelPlannerResult,
): NonNullable<AgentProviderMeta['travelPlanner']> {
  return {
    travelPurpose: result.travelPurpose,
    tripType: result.tripType,
    travelerType: result.travelerType,
    travelStrategy: result.travelStrategy.summary,
    confidenceScore: result.confidenceScore,
    searchImmediately: result.decisions.searchImmediately,
    shouldAskQuestion: result.decisions.shouldAskQuestion,
    recommendedSearchOrder: result.recommendedSearchOrder,
    missingInformation: result.missingInformation,
    combinedQuestion: result.combinedQuestion,
    riskFlags: result.riskFlags,
    durationMs: result.durationMs,
  }
}

function toMetaAutonomousDecision(
  result: AutonomousDecisionResult,
): NonNullable<AgentProviderMeta['autonomousDecision']> {
  const best = result.recommendations.bestOverall
  return {
    bestOverallId: best?.id ?? null,
    bestOverallScore: best?.score?.overall ?? null,
    confidence: result.recommendations.confidence,
    planCount: result.plans.length,
    candidateCount: result.candidates.length,
    duplicateCount: result.duplicateCount,
    fallbackUsed: result.fallbackUsed,
    labels: best?.labels ?? [],
    explanation: result.recommendations.explanation || null,
    durationMs: result.durationMs,
  }
}

function toMetaAdaptiveLearning(
  result: AdaptiveLearningResult,
): NonNullable<AgentProviderMeta['adaptiveLearning']> {
  const top = [...result.profile.preferences]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((p) => ({ kind: p.kind, value: p.value, confidence: p.confidence }))
  return {
    learningEnabled: result.profile.learningEnabled,
    preferenceCount: result.profile.preferences.length,
    preferencesUpdated: result.session.preferencesUpdated,
    inferredCount: result.inferred.length,
    eventsProcessed: result.session.eventsProcessed,
    topPreferences: top,
    durationMs: result.durationMs,
  }
}

function toMetaPriceIntelligence(
  result: BookingTimingResult,
): NonNullable<AgentProviderMeta['priceIntelligence']> {
  const rec = result.recommendation
  return {
    action: rec.action,
    confidence: rec.confidence,
    explanation: rec.explanation || null,
    opportunities: rec.opportunities,
    signalsUsed: rec.signalsUsed,
    currentPrice: rec.analysis.currentPrice,
    averagePrice: rec.analysis.averageObservedPrice,
    trend: rec.analysis.trend,
    daysToDeparture: rec.analysis.daysToDeparture,
    durationMs: result.durationMs,
  }
}

function toMetaDynamicPackages(
  result: PackageBuilderResult,
): NonNullable<AgentProviderMeta['dynamicPackages']> {
  const best = result.selected ?? result.ranked[0] ?? null
  return {
    selectedId: best?.id ?? null,
    selectedTitle: best?.title ?? null,
    selectedScore: best?.score ?? null,
    confidence: best?.confidence ?? 0,
    packageCount: result.packages.length,
    duplicateCount: result.duplicateCount,
    filteredCount: result.filteredCount,
    labels: best?.labels ?? [],
    explanation: best?.explanation ?? null,
    durationMs: result.durationMs,
  }
}

function toMetaItineraryRefinement(
  result: RefinementResult,
): NonNullable<AgentProviderMeta['itineraryRefinement']> {
  return {
    changesApplied: result.changesApplied,
    impactedCount: result.impactedComponents.length,
    reusedCount: result.reusedComponents.length,
    conflictCount: result.conflicts.length,
    alternativeCount: result.alternatives.length,
    confidence: result.confidence,
    incremental: result.incremental,
    summary: result.explanation.summary || null,
    durationMs: result.durationMs,
  }
}

function offersFromToolBatch(batch: ToolExecutionBatch | undefined): {
  flightOffers: Array<Record<string, unknown>>
  hotelStays: Array<Record<string, unknown>>
} {
  const flightOffers: Array<Record<string, unknown>> = []
  const hotelStays: Array<Record<string, unknown>> = []
  for (const result of batch?.results ?? []) {
    if (result.status !== 'ok' || !result.data) continue
    const data = result.data as Record<string, unknown>
    if (result.tool === 'flights' && Array.isArray(data.offers)) {
      for (const offer of data.offers) {
        if (offer && typeof offer === 'object') flightOffers.push(offer as Record<string, unknown>)
      }
    }
    if (result.tool === 'hotels' && Array.isArray(data.stays)) {
      for (const stay of data.stays) {
        if (stay && typeof stay === 'object') hotelStays.push(stay as Record<string, unknown>)
      }
    }
  }
  return { flightOffers, hotelStays }
}

function toMetaBookingExecution(
  result: BookingExecutionResult,
): NonNullable<AgentProviderMeta['bookingExecution']> {
  return {
    sessionId: result.snapshot.sessionId,
    status: result.snapshot.status,
    bookingIds: result.snapshot.bookingIds,
    confirmedCount: result.snapshot.confirmedCount,
    failedCount: result.snapshot.failedCount,
    cancelledCount: result.snapshot.cancelledCount,
    expiredCount: result.snapshot.expiredCount,
    domains: result.snapshot.domains,
    providerIds: result.snapshot.providerIds,
    durationMs: result.snapshot.durationMs,
    resumed: result.snapshot.resumed,
    rolledBack: result.snapshot.rolledBack,
    idempotentReplay: result.snapshot.idempotentReplay,
  }
}

function toMetaPayments(
  result: PaymentsPlatformResult,
): NonNullable<AgentProviderMeta['payments']> {
  return {
    paymentSessionId: result.snapshot.paymentSessionId,
    status: result.snapshot.status,
    method: result.snapshot.method,
    providerId: result.snapshot.providerId,
    amount: result.snapshot.amount,
    currency: result.snapshot.currency,
    ticketCount: result.snapshot.ticketCount,
    documentCount: result.snapshot.documentCount,
    refundCount: result.snapshot.refundCount,
    riskScore: result.snapshot.riskScore,
    durationMs: result.snapshot.durationMs,
    resumed: result.snapshot.resumed,
    idempotentReplay: result.snapshot.idempotentReplay,
  }
}

function priorAutonomousFromMessages(messages: ChatMessage[]): AutonomousAgentSnapshot | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (msg?.role !== 'assistant') continue
    const meta = msg.providerMeta as unknown as AgentProviderMeta | undefined
    if (!meta || meta.kind !== 'travel_agent') continue
    const goal = (meta.autonomous?.goal ?? null) as AutonomousAgentSnapshot['goal']
    if (!meta.autonomous && !goal) continue
    return {
      state: (meta.autonomous?.state as AutonomousAgentSnapshot['state']) || 'IDLE',
      progressPhase: (meta.autonomous?.progressPhase as AutonomousAgentSnapshot['progressPhase']) || 'Thinking',
      goal,
      plan: null,
      completedTaskIds: meta.autonomous?.completedTaskIds ?? [],
      pendingTaskIds: meta.autonomous?.pendingTaskIds ?? [],
      lastProviderId: meta.autonomous?.lastProviderId ?? null,
      totalRetries: meta.autonomous?.totalRetries ?? 0,
      durationMs: meta.autonomous?.durationMs ?? 0,
      outcome: (meta.autonomous?.outcome as AutonomousAgentSnapshot['outcome']) || 'ok',
      logs: [],
      recoveredFromFailures: meta.autonomous?.recoveredFromFailures ?? false,
    }
  }
  return null
}

function toToolSummaries(results: AgentToolResult[]): AgentToolRunSummary[] {
  return results.map((result) => ({
    tool: result.tool,
    status: result.status,
    summary: result.summary,
    providerId: result.meta?.providerId,
    durationMs: result.meta?.durationMs,
  }))
}


async function speakTravelFacts(input: {
  llms: AgentLlmRegistry
  conversationId: string
  messages: ChatMessage[]
  facts: TravelFacts
  signal?: AbortSignal
}): Promise<{ displayText: string; spokenText: string; providerId: string }> {
  return runConversationBrain(input)
}

function mapConciergeObjective(action: string): ConversationObjective {
  switch (action) {
    case 'greet':
      return 'greet_or_continue'
    case 'ask':
    case 'clarify':
      return 'collect_missing'
    case 'advise':
      return 'advise'
    case 'propose_options':
      return 'propose_options'
    case 'confirm':
      return 'confirm_understanding'
    case 'plan':
    case 'search':
    case 'refine':
      return 'present_plan'
    default:
      return 'general'
  }
}

export function createTravelAgentService(
  options: TravelAgentServiceOptions = {},
): TravelAgentService {
  // RC-3 — tools / LLM registry / concierge constructed on first use (not at import time).
  let tools: AgentToolRegistry | null = options.tools ?? null
  let executor = options.tools ? createToolExecutor(options.tools) : null
  let llms: AgentLlmRegistry | null = options.llms ?? null
  let conciergeService: ConciergeService | null | undefined =
    options.concierge === false ? null : options.concierge

  const ensureTools = async () => {
    if (!tools) {
      const stubs = await loadToolStubs()
      tools = stubs.createDefaultAgentToolRegistry()
    }
    if (!executor) executor = createToolExecutor(tools)
    return { tools, executor }
  }

  const ensureLlms = async (): Promise<AgentLlmRegistry> => {
    if (!llms) {
      const factory = await import('./llm/factory')
      llms = factory.createAgentLlmRegistry()
    }
    return llms
  }

  const ensureConcierge = async (): Promise<ConciergeService | null> => {
    if (conciergeService !== undefined) return conciergeService
    if (options.concierge === false) {
      conciergeService = null
      return null
    }
    const mod = await loadConcierge()
    conciergeService = mod.createConciergeService()
    return conciergeService
  }

  const savePlanHook = options.savePlan

  const isConciergeEnabled = (): boolean => {
    if (options.concierge === false) return false
    if (typeof options.conciergeEnabled === 'boolean') return options.conciergeEnabled
    return getFeatureRegistry().isEnabled('ai.concierge')
  }

  const isBookingHistoryEnabled = (): boolean =>
    getFeatureRegistry().isEnabled('ui.booking_history')

  const isBookingConfirmationEnabled = (): boolean =>
    getFeatureRegistry().isEnabled('ui.booking_confirmation')

  const isOrderManagementEnabled = (): boolean =>
    getFeatureRegistry().isEnabled('ui.order_management')

  const isSmartItineraryEnabled = (): boolean =>
    getFeatureRegistry().isEnabled('ui.smart_itinerary')

  const isBrainEnabled = (): boolean =>
    isBrainConciergeIntegrationEnabled({ brainEnabled: options.brainEnabled })

  const isBrainHandoffEnabled = (): boolean =>
    isBrainAgentHandoffEnabled({ brainHandoffEnabled: options.brainHandoffEnabled })

  const isTravelEngineEnabled = (): boolean =>
    isBrainTravelEngineEnabled({
      brainTravelEngineEnabled: options.brainTravelEngineEnabled,
    })

  const isTripPlanningEnabled = (): boolean =>
    isBrainTripPlanningEnabled({
      brainTripPlanningEnabled: options.brainTripPlanningEnabled,
    })

  const isExecutionEnabled = (): boolean =>
    isBrainExecutionEnabled({
      brainExecutionEnabled: options.brainExecutionEnabled,
    })

  const isSearchEnabled = (): boolean =>
    isBrainSearchEnabled({
      brainSearchEnabled: options.brainSearchEnabled,
    })

  const isTripOrchestratorEnabled = (): boolean =>
    isBrainTripOrchestratorEnabled({
      brainTripOrchestratorEnabled: options.brainTripOrchestratorEnabled,
    })

  const isReasoningEnabled = (): boolean =>
    isTravelReasoningEnabled({ enabled: options.travelReasoningEnabled })

  const isClarificationEnabled = (): boolean => {
    if (typeof options.smartClarificationEnabled === 'boolean') {
      return options.smartClarificationEnabled
    }
    return getFeatureRegistry().isEnabled('ai.smart_clarification')
  }

  const isBrainCoreEnabled = (): boolean =>
    isRahhalBrainEnabled({ enabled: options.rahhalBrainEnabled })

  const isAutonomousEnabled = (): boolean =>
    isAutonomousAgentEnabled({ enabled: options.autonomousAgentEnabled })

  const isBookingIntelEnabled = (): boolean =>
    isBookingIntelligenceEnabled({ enabled: options.bookingIntelligenceEnabled })

  const isBudgetIntelEnabled = (): boolean =>
    isBudgetIntelligenceEnabled({ enabled: options.budgetIntelligenceEnabled })

  const isIntegrationTripOrchestratorOn = (): boolean =>
    isIntegrationTripOrchestratorEnabled()

  const isIntegrationDestinationIntelligenceOn = (): boolean =>
    isIntegrationDestinationIntelligenceEnabled()

  const isIntegrationTripCompanionOn = (): boolean =>
    isIntegrationTripCompanionEnabled()

  const isIntegrationMapsMobilityOn = (): boolean =>
    isIntegrationMapsMobilityEnabled()

  const isIntegrationBudgetPricingOn = (): boolean =>
    isIntegrationBudgetPricingEnabled()

  const isIntegrationDisruptionRecoveryOn = (): boolean =>
    isIntegrationDisruptionRecoveryEnabled()

  const isIntegrationActionExecutionOn = (): boolean =>
    isIntegrationActionExecutionEnabled()

  const isIntegrationJourneyOn = (): boolean =>
    isIntegrationJourneyEnabled()

  const isTravelerPersonalizationOn = (): boolean =>
    isTravelerPersonalizationEnabled({ enabled: options.travelerPersonalizationEnabled })

  const isTripOptimizerOn = (): boolean =>
    isTripOptimizerEnabled({ enabled: options.tripOptimizerEnabled })

  const isTravelPlannerOn = (): boolean =>
    isTravelPlannerEnabled({ enabled: options.travelPlannerEnabled })

  const isAutonomousDecisionOn = (): boolean =>
    isAutonomousDecisionEnabled({ enabled: options.autonomousDecisionEnabled })

  const isAdaptiveLearningOn = (): boolean =>
    isAdaptiveLearningEnabled({ enabled: options.adaptiveLearningEnabled })

  const isPriceIntelligenceOn = (): boolean =>
    isPriceIntelligenceEnabled({ enabled: options.priceIntelligenceEnabled })

  const isDynamicPackagesOn = (): boolean =>
    isDynamicPackagesEnabled({ enabled: options.dynamicPackagesEnabled })

  const isItineraryRefinementOn = (): boolean =>
    isItineraryRefinementEnabled({ enabled: options.itineraryRefinementEnabled })

  const isBookingExecEnabled = (): boolean =>
    isBookingExecutionEnabled({ enabled: options.bookingExecutionEnabled })

  const isPaymentsPlatformEnabled = (): boolean =>
    isPaymentsEnabled({ enabled: options.paymentsEnabled })

  const isFlowEnabled = (): boolean =>
    isBookingFlowEnabled({
      bookingFlowEnabled: options.bookingFlowEnabled,
    })

  const listBookingRecords = async (): Promise<BookingRecord[]> => {
    if (options.listBookingRecords) return options.listBookingRecords()
    const userId = getBookingHistoryUserId()
    if (!userId) return []
    const { loadUserBookingRecords } = await loadBooking()
    return loadUserBookingRecords(userId)
  }

  const runToolsForPlan = async (input: {
    memory: AgentMemory
    conversationId: string
    userText?: string
    signal?: AbortSignal
    seed?: string
    basePlan?: TripPlan
    priorAutonomous?: AutonomousAgentSnapshot | null
    onProgress?: (event: AutonomousProgressEvent) => void
    /** Sprint 78 — precomputed travel strategy (runs before engines). */
    travelPlanner?: TravelPlannerResult | null
  }): Promise<{
    plan: TripPlan
    batch: ToolExecutionBatch
    autonomous?: AutonomousAgentSnapshot
    bookingIntelligence?: BookingIntelligenceResult
    budgetIntelligence?: BudgetIntelligenceResult
    travelerPersonalization?: TravelerPersonalizationResult
    tripOptimizer?: TripOptimizerResult
    travelPlanner?: TravelPlannerResult
    autonomousDecision?: AutonomousDecisionResult
    priceIntelligence?: BookingTimingResult
    dynamicPackages?: PackageBuilderResult
    itineraryRefinement?: RefinementResult
    bookingExecution?: BookingExecutionResult
    payments?: PaymentsPlatformResult
  }> => {
    const travelPlanner = input.travelPlanner
      ?? (isTravelPlannerOn()
        ? (await loadTravelPlanner()).runTravelPlanner({
          userText: input.userText,
          memory: input.memory,
          locale: input.memory.locale,
        })
        : null)
    const applyBookingIntel = async (
      plan: TripPlan,
      memory: AgentMemory,
      batch?: ToolExecutionBatch,
    ): Promise<{
      plan: TripPlan
      bookingIntelligence?: BookingIntelligenceResult
      budgetIntelligence?: BudgetIntelligenceResult
      travelerPersonalization?: TravelerPersonalizationResult
      tripOptimizer?: TripOptimizerResult
      autonomousDecision?: AutonomousDecisionResult
      priceIntelligence?: BookingTimingResult
      dynamicPackages?: PackageBuilderResult
      itineraryRefinement?: RefinementResult
      bookingExecution?: BookingExecutionResult
      payments?: PaymentsPlatformResult
    }> => {
      let nextPlan = plan
      let budgetIntelligence: BudgetIntelligenceResult | undefined
      let travelerPersonalization: TravelerPersonalizationResult | undefined
      let tripOptimizer: TripOptimizerResult | undefined
      let autonomousDecision: AutonomousDecisionResult | undefined
      let priceIntelligence: BookingTimingResult | undefined
      let dynamicPackages: PackageBuilderResult | undefined
      let itineraryRefinement: RefinementResult | undefined
      let { flightOffers, hotelStays } = offersFromToolBatch(batch)

      // Integration Sprint 4 — coordinate flight/hotel results into a trip recommendation.
      if (isIntegrationTripOrchestratorOn()) {
        const __mod_tripOrchestrator = await loadIntegrationTripOrchestrator()
        const orchestrated = await __mod_tripOrchestrator.enrichWithIntegrationTripOrchestrator({
          memory,
          tripPlan: nextPlan,
          userId: input.conversationId,
          userText: input.userText,
          flightOffers: flightOffers.length ? flightOffers : undefined,
          hotelStays: hotelStays.length ? hotelStays : undefined,
        })
        nextPlan = orchestrated.tripPlan
      }

      if (isBudgetIntelEnabled()) {
        const __mod_enrichWithBudgetIntelligence = await loadBudgetIntelligence()

        const budgeted = await __mod_enrichWithBudgetIntelligence.enrichWithBudgetIntelligence({
          memory,
          tripPlan: nextPlan,
          userText: input.userText,
          enabled: options.budgetIntelligenceEnabled,
          flightOffers: flightOffers.length ? flightOffers : undefined,
          hotelStays: hotelStays.length ? hotelStays : undefined,
        })
        nextPlan = budgeted.tripPlan
        budgetIntelligence = budgeted.budgetIntelligence ?? undefined
      }

      if (isTravelerPersonalizationOn()) {
        const __mod_enrichWithTravelerPersonalization = await loadTravelerPersonalization()

        const personalized = await __mod_enrichWithTravelerPersonalization.enrichWithTravelerPersonalization({
          userId: input.conversationId,
          memory,
          tripPlan: nextPlan,
          userText: input.userText,
          enabled: options.travelerPersonalizationEnabled,
          flightOffers: flightOffers.length ? flightOffers : undefined,
          hotelStays: hotelStays.length ? hotelStays : undefined,
          // Learning already ran once per planTurn; rank-only here.
          skipLearning: true,
        })
        nextPlan = personalized.tripPlan
        travelerPersonalization = personalized.travelerPersonalization ?? undefined
      }

      if (isTripOptimizerOn()) {
        const __mod_enrichWithTripOptimizer = await loadTripOptimizer()

        const optimized = await __mod_enrichWithTripOptimizer.enrichWithTripOptimizer({
          memory,
          tripPlan: nextPlan,
          userText: input.userText,
          enabled: options.tripOptimizerEnabled,
          flightOffers: flightOffers.length ? flightOffers : undefined,
          hotelStays: hotelStays.length ? hotelStays : undefined,
          budgetIntelligence,
          travelerPersonalization,
        })
        nextPlan = optimized.tripPlan
        tripOptimizer = optimized.tripOptimizer ?? undefined
      }

      // Sprint 83 — Package Builder before Decision Engine; reorders offers for DE consumption.
      if (isDynamicPackagesOn()) {
        const learnedProfile = isAdaptiveLearningOn()
          ? (await loadAdaptiveLearning()).getLearnedProfile(input.conversationId)
          : null
        const __mod_enrichWithDynamicPackages = await loadPackageBuilder()

        const packaged = await __mod_enrichWithDynamicPackages.enrichWithDynamicPackages({
          memory,
          tripPlan: nextPlan,
          enabled: options.dynamicPackagesEnabled,
          flightOffers: flightOffers.length ? flightOffers : undefined,
          hotelStays: hotelStays.length ? hotelStays : undefined,
          learnedProfile,
        })
        nextPlan = packaged.tripPlan
        dynamicPackages = packaged.dynamicPackages ?? undefined
        flightOffers = packaged.flightOffers
        hotelStays = packaged.hotelStays
      }

      // Sprint 84 — incremental refinement between Package Builder and Decision Engine.
      if (isItineraryRefinementOn() && dynamicPackages) {
        const __mod_enrichWithItineraryRefinement = await loadItineraryRefinement()

        const refined = __mod_enrichWithItineraryRefinement.enrichWithItineraryRefinement({
          memory,
          tripPlan: nextPlan,
          userText: input.userText,
          enabled: options.itineraryRefinementEnabled,
          dynamicPackages,
          flightOffers: flightOffers.length ? flightOffers : undefined,
          hotelStays: hotelStays.length ? hotelStays : undefined,
          learnUserId: isAdaptiveLearningOn() ? input.conversationId : null,
        })
        nextPlan = refined.tripPlan
        itineraryRefinement = refined.itineraryRefinement ?? undefined
        flightOffers = refined.flightOffers
        hotelStays = refined.hotelStays
      }

      if (isAutonomousDecisionOn()) {
        const learnedProfile = isAdaptiveLearningOn()
          ? (await loadAdaptiveLearning()).getLearnedProfile(input.conversationId)
          : null
        const __mod_enrichWithAutonomousDecision = await loadAutonomousDecision()

        const decided = await __mod_enrichWithAutonomousDecision.enrichWithAutonomousDecision({
          memory,
          tripPlan: nextPlan,
          enabled: options.autonomousDecisionEnabled,
          flightOffers: flightOffers.length ? flightOffers : undefined,
          hotelStays: hotelStays.length ? hotelStays : undefined,
          travelPlanner,
          learnedProfile,
        })
        nextPlan = decided.tripPlan
        autonomousDecision = decided.autonomousDecision ?? undefined
      }

      // Sprint 81 — booking timing after Decision Engine + Adaptive Learning profile use.
      if (isPriceIntelligenceOn()) {
        const best = autonomousDecision?.recommendations.bestOverall
        const __mod_enrichWithPriceIntelligence = await loadPriceIntelligence()

        const timed = __mod_enrichWithPriceIntelligence.enrichWithPriceIntelligence({
          memory,
          tripPlan: nextPlan,
          enabled: options.priceIntelligenceEnabled,
          flightOffers: flightOffers.length ? flightOffers : undefined,
          hotelStays: hotelStays.length ? hotelStays : undefined,
          decisionBestTotal: best?.totalPrice
            ?? dynamicPackages?.selected?.totalPrice
            ?? null,
        })
        nextPlan = timed.tripPlan
        priceIntelligence = timed.priceIntelligence ?? undefined
      }

      if (!isBookingIntelEnabled()) {
        return {
          plan: nextPlan,
          budgetIntelligence,
          travelerPersonalization,
          tripOptimizer,
          autonomousDecision,
          priceIntelligence,
          dynamicPackages,
          itineraryRefinement,
        }
      }
      const __mod_enrichWithBookingIntelligence = await loadBookingIntelligence()

      const enriched = await __mod_enrichWithBookingIntelligence.enrichWithBookingIntelligence({
        memory,
        tripPlan: nextPlan,
        userId: input.conversationId,
        enabled: options.bookingIntelligenceEnabled,
        signal: input.signal,
      })
      nextPlan = enriched.tripPlan
      let bookingExecution: BookingExecutionResult | undefined
      let payments: PaymentsPlatformResult | undefined
      if (isBookingExecEnabled() && enriched.bookingIntelligence) {
        const __mod_enrichWithBookingExecution = await loadBookingExecution()

        const executed = await __mod_enrichWithBookingExecution.enrichWithBookingExecution({
          memory,
          tripPlan: nextPlan,
          userId: input.conversationId,
          bookingIntelligence: enriched.bookingIntelligence,
          userText: input.userText,
          enabled: options.bookingExecutionEnabled,
          signal: input.signal,
        })
        nextPlan = executed.tripPlan
        bookingExecution = executed.bookingExecution ?? undefined
      }
      // Alpha: pay / confirmation turns reuse the prior booking session in this conversation.
      const __mod_shouldRunPayments = await loadPaymentsPlatform()

      const payCue = __mod_shouldRunPayments.shouldRunPayments({
        userText: input.userText,
        intent: input.memory.lastIntent,
        bookingExecutionStatus: bookingExecution?.snapshot.status ?? null,
      })
      const __mod_shouldShowPaymentSummary = await loadPaymentsPlatform()

      const summaryCue = __mod_shouldShowPaymentSummary.shouldShowPaymentSummary(input.userText)
      if (!bookingExecution && (payCue || summaryCue)) {
        const __mod_findLatestConfirmedBookingExecution = await loadBookingExecution()

        bookingExecution = __mod_findLatestConfirmedBookingExecution.findLatestConfirmedBookingExecution(input.conversationId) ?? undefined
      }
      if (isPaymentsPlatformEnabled() && bookingExecution && payCue) {
        const __mod_enrichWithPaymentsPlatform = await loadPaymentsPlatform()

        const paid = await __mod_enrichWithPaymentsPlatform.enrichWithPaymentsPlatform({
          memory,
          tripPlan: nextPlan,
          userId: input.conversationId,
          bookingExecution,
          userText: input.userText,
          enabled: options.paymentsEnabled,
          signal: input.signal,
        })
        nextPlan = paid.tripPlan
        payments = paid.payments ?? undefined
      } else if (isPaymentsPlatformEnabled() && summaryCue) {
        const __mod_findLatestPaymentsResult = await loadPaymentsPlatform()

        payments = __mod_findLatestPaymentsResult.findLatestPaymentsResult(input.conversationId) ?? undefined
        if (!bookingExecution) {
          const __mod_findLatestConfirmedBookingExecution = await loadBookingExecution()

          bookingExecution = __mod_findLatestConfirmedBookingExecution.findLatestConfirmedBookingExecution(input.conversationId) ?? undefined
        }
      }
      return {
        plan: nextPlan,
        bookingIntelligence: enriched.bookingIntelligence ?? undefined,
        budgetIntelligence,
        travelerPersonalization,
        tripOptimizer,
        autonomousDecision,
        priceIntelligence,
        dynamicPackages,
        itineraryRefinement,
        bookingExecution,
        payments,
      }
    }

    if (isAutonomousEnabled()) {
      const { tools: toolRegistry } = await ensureTools()
      const __mod_runAutonomousTurn = await loadAutonomous()

      const autonomous = await __mod_runAutonomousTurn.runAutonomousTurn({
        conversationId: input.conversationId,
        userText: input.userText ?? '',
        memory: input.memory,
        registry: toolRegistry,
        priorSnapshot: input.priorAutonomous ?? null,
        signal: input.signal,
        seed: input.seed,
        basePlan: input.basePlan,
        onProgress: input.onProgress,
      })
      if (autonomous.planBuilt && autonomous.tripPlan) {
        const intel = await applyBookingIntel(autonomous.tripPlan, input.memory, autonomous.batch)
        return {
          plan: intel.plan,
          batch: autonomous.batch,
          autonomous: autonomous.snapshot,
          bookingIntelligence: intel.bookingIntelligence,
          budgetIntelligence: intel.budgetIntelligence,
          travelerPersonalization: intel.travelerPersonalization,
          tripOptimizer: intel.tripOptimizer,
          travelPlanner: travelPlanner ?? undefined,
          autonomousDecision: intel.autonomousDecision,
          priceIntelligence: intel.priceIntelligence,
          dynamicPackages: intel.dynamicPackages,
          itineraryRefinement: intel.itineraryRefinement,
          bookingExecution: intel.bookingExecution,
          payments: intel.payments,
        }
      }
      // Alpha — confirm/pay cues still enrich even when autonomous does not rebuild a plan.
      const journeyCue =
        (await loadBookingExecution()).shouldRunBookingExecution({
          userText: input.userText,
          intent: input.memory.lastIntent,
          bookingReady: true,
        })
        || (await loadPaymentsPlatform()).shouldRunPayments({
          userText: input.userText,
          intent: input.memory.lastIntent,
        })
        || (await loadPaymentsPlatform()).shouldShowPaymentSummary(input.userText)
      if (journeyCue) {
        const plan = input.basePlan
          ?? input.memory.tripPlan
          ?? buildTripPlan({
            requirements: input.memory.requirements,
            conversationId: input.conversationId,
            locale: input.memory.locale,
            seed: input.seed,
          })
        const intel = await applyBookingIntel(plan, input.memory, autonomous.batch)
        return {
          plan: intel.plan,
          batch: autonomous.batch,
          autonomous: autonomous.snapshot,
          bookingIntelligence: intel.bookingIntelligence,
          budgetIntelligence: intel.budgetIntelligence,
          travelerPersonalization: intel.travelerPersonalization,
          tripOptimizer: intel.tripOptimizer,
          travelPlanner: travelPlanner ?? undefined,
          autonomousDecision: intel.autonomousDecision,
          priceIntelligence: intel.priceIntelligence,
          dynamicPackages: intel.dynamicPackages,
          itineraryRefinement: intel.itineraryRefinement,
          bookingExecution: intel.bookingExecution,
          payments: intel.payments,
        }
      }
      // Clarification / blocked — fall through to a lightweight base plan without tools.
      const base = input.basePlan ?? buildTripPlan({
        requirements: input.memory.requirements,
        conversationId: input.conversationId,
        locale: input.memory.locale,
        seed: input.seed,
      })
      return {
        plan: base,
        batch: autonomous.batch,
        autonomous: autonomous.snapshot,
      }
    }

    const { executor: toolExecutor } = await ensureTools()
    const selected = selectToolsForTurn({
      requirements: input.memory.requirements,
      intent: input.memory.lastIntent,
      missingFields: input.memory.missingFields,
      searchPlan: travelPlanner?.searchPlan,
    })

    const batch = selected.length > 0
      ? await toolExecutor.execute({
        names: selected,
        ctx: {
          requirements: input.memory.requirements,
          tripPlan: input.memory.tripPlan,
          itinerary: input.memory.tripPlan,
          locale: input.memory.locale,
          signal: input.signal,
        },
      })
      : {
        results: [],
        selected: [],
        okCount: 0,
        failedCount: 0,
        durationMs: 0,
      }

    const base = input.basePlan ?? buildTripPlan({
      requirements: input.memory.requirements,
      conversationId: input.conversationId,
      locale: input.memory.locale,
      seed: input.seed,
    })
    const merged = mergeToolResultsIntoPlan(base, batch.results)
    const decided = applyIntelligentDecisions(merged, batch.results, input.memory.requirements)
    const intel = await applyBookingIntel(decided, input.memory, batch)
    return {
      plan: intel.plan,
      batch,
      bookingIntelligence: intel.bookingIntelligence,
      budgetIntelligence: intel.budgetIntelligence,
      travelerPersonalization: intel.travelerPersonalization,
      tripOptimizer: intel.tripOptimizer,
      travelPlanner: travelPlanner ?? undefined,
      autonomousDecision: intel.autonomousDecision,
      priceIntelligence: intel.priceIntelligence,
      dynamicPackages: intel.dynamicPackages,
      itineraryRefinement: intel.itineraryRefinement,
      bookingExecution: intel.bookingExecution,
      payments: intel.payments,
    }
  }

  const service: TravelAgentService = {
    async planTurn(input) {
      const llms = await ensureLlms()
      await ensureConcierge()
      const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
      const userText = lastUser?.content ?? ''
      // Alpha — booking / payment / confirmation cues must reach Execution + Payments.
      const __mod_shouldRunBookingExecution = await loadBookingExecution()

      const alphaBookingCue = __mod_shouldRunBookingExecution.shouldRunBookingExecution({
        userText,
        bookingReady: true,
      })
      const __mod_shouldRunPayments = await loadPaymentsPlatform()

      const alphaPaymentCue = __mod_shouldRunPayments.shouldRunPayments({ userText })
      const __mod_shouldShowPaymentSummary = await loadPaymentsPlatform()

      const alphaSummaryCue = __mod_shouldShowPaymentSummary.shouldShowPaymentSummary(userText)
      const alphaJourneyCue = alphaBookingCue || alphaPaymentCue || alphaSummaryCue
      const prior = rebuildMemoryFromMessages(input.messages.slice(0, -1))
      let extracted = extractFromUserText(userText, prior.locale)
      const preferenceUserId = getBookingHistoryUserId() || input.conversationId

      let memory: AgentMemory = {
        ...prior,
        locale: extracted.locale || prior.locale,
        lastIntent: extracted.intent,
        requirements: mergeRequirements(prior.requirements, extracted.patch, {
          replaceDestinations: extracted.flags?.replaceDestinations,
        }),
      }
      memory.missingFields = missingRequirementFields(memory.requirements)

      let conversationIntelligenceResult: ConversationIntelligenceResult | null = null
      let llmBrainResult: LlmBrainResult | null = null
      let agentRuntimeResult: AgentRuntimeResult | null = null

      // Recovery Phase 4 — Conversation Intelligence (default OFF). Soft enrich only.
      // RC-2: dynamic import so flag-OFF planTurn does not pay the CI module graph.
      if (isConversationIntelligenceEnabled({ enabled: options.conversationIntelligenceEnabled })) {
        const { enrichWithConversationIntelligence, filterInterviewMissingFields } = await loadConversationIntelligence()
        const recentTexts = input.messages
          .slice(0, -1)
          .slice(-6)
          .map((m) => m.content)
        const enriched = enrichWithConversationIntelligence({
          userText,
          memory,
          recentTexts,
          enabled: true,
          locale: memory.locale,
        })
        memory = enriched.memory
        conversationIntelligenceResult = enriched.conversationIntelligence
        // Prefer consultant questions over classic interview slots.
        memory.missingFields = filterInterviewMissingFields(
          missingRequirementFields(memory.requirements).map(String),
        ) as Array<keyof TripRequirements>
      }

      // Recovery Phase 5 — LLM Conversation Brain (default OFF). Mock LLM primary; rules fallback.
      if (isLlmConversationBrainEnabled({ enabled: options.llmConversationBrainEnabled })) {
        const { enrichWithLlmConversationBrain } = await loadLlmBrain()
        const { filterInterviewMissingFields } = await loadConversationIntelligence()
        const recentTexts = input.messages
          .slice(0, -1)
          .slice(-6)
          .map((m) => m.content)
        const enrichedBrain = enrichWithLlmConversationBrain({
          userText,
          memory,
          recentTexts,
          enabled: true,
          locale: memory.locale,
          turn: input.messages.filter((m) => m.role === 'user').length,
        })
        memory = enrichedBrain.memory
        llmBrainResult = enrichedBrain.llmBrain
        memory.missingFields = filterInterviewMissingFields(
          missingRequirementFields(memory.requirements).map(String),
        ) as Array<keyof TripRequirements>
      }

      // Recovery Phase 6 — Agent Runtime (default OFF). Mock tool execution only.
      if (isAgentRuntimeEnabled({ enabled: options.agentRuntimeEnabled })) {
        const { enrichWithAgentRuntime } = await loadAgentRuntime()
        const { filterInterviewMissingFields } = await loadConversationIntelligence()
        const recentTexts = input.messages
          .slice(0, -1)
          .slice(-6)
          .map((m) => m.content)
        const enrichedRuntime = await enrichWithAgentRuntime({
          userText,
          memory,
          recentTexts,
          enabled: true,
          locale: memory.locale,
          conversationId: input.conversationId,
        })
        memory = enrichedRuntime.memory
        agentRuntimeResult = enrichedRuntime.agentRuntime
        memory.missingFields = filterInterviewMissingFields(
          missingRequirementFields(memory.requirements).map(String),
        ) as Array<keyof TripRequirements>
      }

      // Alpha — confirm/pay turns must keep prior trip context even if the last
      // user line has no destination text (CTAs like "أكد الحجز" / "ادفع الآن").
      if (alphaJourneyCue && memory.missingFields.length > 0) {
        for (const message of input.messages.slice(0, -1)) {
          if (message.role !== 'user') continue
          const priorExtract = extractFromUserText(message.content, memory.locale)
          memory = {
            ...memory,
            requirements: mergeRequirements(memory.requirements, priorExtract.patch),
          }
        }
        memory.missingFields = missingRequirementFields(memory.requirements)
        if (!memory.tripPlan && prior.tripPlan) {
          memory = withTripPlan(memory, prior.tripPlan)
        }
      }

      let reasoningResult: TravelReasoningResult | null = null
      let reasoningMeta: AgentProviderMeta['reasoning'] | undefined
      let destinationIntelligenceResult: DestinationIntelligenceResult | null = null
      let destinationIntelligenceMeta: AgentProviderMeta['destinationIntelligence'] | undefined
      let tripCompanionResult: TripCompanionResult | null = null
      let tripCompanionMeta: AgentProviderMeta['tripCompanion'] | undefined
      let mapsMobilityResult: MapsMobilityResult | null = null
      let mapsMobilityMeta: AgentProviderMeta['mapsMobility'] | undefined
      let budgetPricingResult: BudgetPricingResult | null = null
      let budgetPricingMeta: AgentProviderMeta['budgetPricing'] | undefined
      let disruptionRecoveryResult: DisruptionRecoveryResult | null = null
      let disruptionRecoveryMeta: AgentProviderMeta['disruptionRecovery'] | undefined
      let actionExecutionResult: ActionExecutionResult | null = null
      let actionExecutionMeta: AgentProviderMeta['actionExecution'] | undefined
      let journeyResult: JourneyResult | null = null
      let journeyMeta: AgentProviderMeta['journey'] | undefined
      let clarificationMeta: NonNullable<AgentProviderMeta['clarification']> | undefined
      let rahhalBrainMeta: RahhalBrainMetaSnapshot | undefined
      let travelExecutiveSnapshot: RahhalBrainTurnResult['executive']
      let executivePlatformSnapshot: RahhalBrainTurnResult['executivePlatform']
      let liveIntelligenceSnapshot: RahhalBrainTurnResult['liveIntelligence']
      let autonomousSnapshot: AutonomousAgentSnapshot | null = isAutonomousEnabled()
        ? priorAutonomousFromMessages(input.messages.slice(0, -1))
        : null
      const priorAutonomous = autonomousSnapshot
      let bookingIntelligenceResult: BookingIntelligenceResult | null = null
      let budgetIntelligenceResult: BudgetIntelligenceResult | null = null
      let travelerPersonalizationResult: TravelerPersonalizationResult | null = null
      let tripOptimizerResult: TripOptimizerResult | null = null
      let travelPlannerResult: TravelPlannerResult | null = null
      let autonomousDecisionResult: AutonomousDecisionResult | null = null
      let adaptiveLearningResult: AdaptiveLearningResult | null = null
      let priceIntelligenceResult: BookingTimingResult | null = null
      let dynamicPackagesResult: PackageBuilderResult | null = null
      let itineraryRefinementResult: RefinementResult | null = null
      let bookingExecutionResult: BookingExecutionResult | null = null
      let paymentsResult: PaymentsPlatformResult | null = null
      let constitutionMeta: AgentProviderMeta['constitution'] | undefined
      /** Sprint 97 — additive concierge UI integration (null until main plan path). */
      let conciergeIntegration: ConciergeTurnIntegrationResult | null = null
      /** Sprint 99 — unified Alpha traveler experience assembly (null until composed). */
      let alphaTravelerAssembly: AgentAlphaTravelerExperienceAttachment | null = null
      /** Sprint 101 — Smart Booking Assistant (null until composed after Alpha). */
      let bookingAssistantAssembly: AgentBookingAssistantAttachment | null = null

      // Sprint 78 — Travel Strategy Planner runs before any search engines.
      if (isTravelPlannerOn()) {
        const __mod_runTravelPlanner = await loadTravelPlanner()

        travelPlannerResult = __mod_runTravelPlanner.runTravelPlanner({
          userText,
          memory,
          locale: memory.locale,
        })
      }

      // Sprint 76 — learn preferences from conversation even when tools do not run.
      if (isTravelerPersonalizationOn()) {
        const __mod_runTravelerPersonalization = await loadTravelerPersonalization()

        travelerPersonalizationResult = __mod_runTravelerPersonalization.runTravelerPersonalization({
          userId: input.conversationId,
          userText,
          memory,
        })
      }

      // Sprint 80 — adaptive learning (local preference adaptation) before Decision Engine.
      if (isAdaptiveLearningOn()) {
        const __mod_runAdaptiveLearningTurn = await loadAdaptiveLearning()

        adaptiveLearningResult = __mod_runAdaptiveLearningTurn.runAdaptiveLearningTurn({
          userId: input.conversationId,
          userText,
          enabled: options.adaptiveLearningEnabled,
        })
      }

      if (isBrainCoreEnabled()) {
        const __mod_runRahhalBrainTurn = await loadBrainCore()

        const brainTurn = __mod_runRahhalBrainTurn.runRahhalBrainTurn(
          {
            conversationId: input.conversationId,
            userText,
            messages: input.messages,
            memory,
            userId: preferenceUserId,
          },
          {
            reasoningEnabled: options.travelReasoningEnabled,
            clarificationEnabled: options.smartClarificationEnabled,
            travelExecutiveEnabled: options.travelExecutiveEnabled,
          },
        )
        memory = brainTurn.memory
        extracted = brainTurn.extracted
        reasoningResult = brainTurn.reasoningResult
        reasoningMeta = brainTurn.reasoningMeta
        clarificationMeta = brainTurn.clarificationMeta
        rahhalBrainMeta = brainTurn.meta
        travelExecutiveSnapshot = brainTurn.executive
        executivePlatformSnapshot = brainTurn.executivePlatform
        liveIntelligenceSnapshot = brainTurn.liveIntelligence

        if (
          brainTurn.decision.type === 'respond'
          && brainTurn.decision.reply
        ) {
          const facts = buildTravelFacts({
            memory,
            objective: 'general',
            missingSlots: memory.missingFields.map(String),
            recommendations: [brainTurn.decision.reply],
          })
          const spoken = await speakTravelFacts({
            llms,
            conversationId: input.conversationId,
            messages: input.messages,
            facts,
            signal: input.signal,
          })
          const meta: AgentProviderMeta = {
            kind: 'travel_agent',
            version: 2,
            memory,
            tripPlan: memory.tripPlan,
            itinerary: memory.tripPlan,
            spokenText: spoken.spokenText,
            voicePhase: 'final',
            toolResults: [],
            reasoning: reasoningMeta,
            clarification: clarificationMeta,
            rahhalBrain: toMetaRahhalBrain(brainTurn.meta),
            travelExecutive: brainTurn.executive
              ? toMetaTravelExecutive(brainTurn.executive)
              : undefined,
            executivePlatform: brainTurn.executivePlatform
              ? toMetaExecutivePlatform(brainTurn.executivePlatform)
              : undefined,
            executiveOs: brainTurn.executivePlatform
              ? toMetaExecutiveOs(brainTurn.executivePlatform)
              : undefined,
            liveIntelligence: brainTurn.liveIntelligence
              ? toMetaLiveIntelligence(brainTurn.liveIntelligence)
              : undefined,
          }
          return {
            reply: spoken.displayText,
            memory,
            tripPlan: memory.tripPlan,
            meta,
            toolBatch: null,
          }
        }
        // 'clarify' is intentionally NOT an early-return here:
        // downstream intent routers (booking history, order, confirmation, itinerary, brain flags)
        // must still run. The clarify reply flows through the normal attach/return paths below.
      } else {
        // Sprint 45/48 — seed empty slots from long-term preference memory (never overwrite).
        if (isPreferenceMemoryEnabled() || isReasoningEnabled()) {
          const reasoningMod = await loadReasoning()
          memory = {
            ...memory,
            requirements: reasoningMod.seedRequirementsFromPreferences(memory.requirements, {
              userId: preferenceUserId,
            }),
          }
        }

        if (isReasoningEnabled()) {
          // Confirm a previously proposed destination ("first one" / named pick).
          const priorMeta = [...input.messages]
            .reverse()
            .map((m) => m.providerMeta)
            .find((meta) => meta && typeof meta === 'object' && 'reasoning' in meta && meta.reasoning)
          const priorReasoning = priorMeta && typeof priorMeta === 'object'
            ? (priorMeta as { reasoning?: AgentProviderMeta['reasoning'] }).reasoning
            : undefined
          if (priorReasoning?.candidateIds?.length && !extracted.patch.destination) {
            const catalogNames = priorReasoning.candidateIds.map((id) => {
              const hit = memory.requirements.destinations.find((d) =>
                d.toLowerCase().includes(id) || id.includes(d.toLowerCase()),
              )
              return {
                id,
                name: hit ?? id.charAt(0).toUpperCase() + id.slice(1),
                nameAr: hit ?? id,
              }
            })
            const __mod_matchDestinationSelection = await loadReasoning()

            const selected = __mod_matchDestinationSelection.matchDestinationSelection(userText, catalogNames)
            if (selected) {
              memory = {
                ...memory,
                requirements: mergeRequirements(memory.requirements, {
                  destination: selected,
                  destinations: [selected],
                  destinationFlexible: false,
                }),
                lastIntent: 'plan',
              }
            }
          }
        }

        // Sprint 45 — autonomous destination reasoning for open-ended asks.
        if (
          isReasoningEnabled()
          && userText.trim()
          && !memory.tripPlan
          && !memory.requirements.destination
          && (
            extracted.intent === 'discover'
            || memory.requirements.destinationFlexible === true
          )
        ) {
          const __mod_runTravelReasoning = await loadReasoning()

          reasoningResult = __mod_runTravelReasoning.runTravelReasoning({
            locale: memory.locale,
            requirements: memory.requirements,
            userText,
          })
          memory = {
            ...memory,
            requirements: __mod_runTravelReasoning.applyReasoningToRequirements(
              memory.requirements,
              reasoningResult,
            ),
          }
          reasoningMeta = __mod_runTravelReasoning.toReasoningSnapshot(reasoningResult)
          __mod_runTravelReasoning.learnPreferencesFromRequirements(memory.requirements, {
            userId: preferenceUserId,
          })
        } else if (
          (isReasoningEnabled() || isPreferenceMemoryEnabled())
          && hasPlanningPatch(extracted.patch as Record<string, unknown>)
        ) {
          const reasoningMod = await loadReasoning()
          reasoningMod.learnPreferencesFromRequirements(memory.requirements, {
            userId: preferenceUserId,
          })
        }

        // Sprint 46 — never-ask-twice: infer soft preferences before computing missing slots.
        if (isClarificationEnabled()) {
          const clarified = applySmartClarification(memory.requirements, {
            locale: memory.locale,
            enabled: true,
          })
          memory = {
            ...memory,
            requirements: clarified.requirements,
          }
          if (clarified.inferred.length > 0) {
            clarificationMeta = {
              inferredFields: clarified.inferred as string[],
              rationale: clarified.rationale,
            }
          }
        }

        memory.missingFields = missingRequirementFields(memory.requirements, {
          smart: isClarificationEnabled(),
        })

        // Integration Sprint 5 — Destination Intelligence (advisor; no booking required).
        if (isIntegrationDestinationIntelligenceOn() && userText.trim()) {
          const __mod_destinationIntelligence = await loadIntegrationDestinationIntelligence()
          if (
            __mod_destinationIntelligence.shouldRunDestinationIntelligence({
              userText,
              memory,
              force:
                extracted.intent === 'discover'
                || memory.requirements.destinationFlexible === true,
            })
          ) {
            const diEnriched = await __mod_destinationIntelligence.enrichWithIntegrationDestinationIntelligence({
              memory,
              userText,
              locale: memory.locale,
              force: true,
              deps: { enabled: true },
            })
            memory = diEnriched.memory
            destinationIntelligenceResult = diEnriched.destinationIntelligence
            destinationIntelligenceMeta = __mod_destinationIntelligence.toDestinationIntelligenceMeta(
              diEnriched.destinationIntelligence,
            )
          }
        }

        // Integration Sprint 7 — Live Trip Companion (session / timeline / replan / assistant).
        if (isIntegrationTripCompanionOn() && userText.trim()) {
          const __mod_tripCompanion = await loadIntegrationTripCompanion()
          if (
            __mod_tripCompanion.shouldRunTripCompanion({
              userText,
              memory,
            })
          ) {
            const companionEnriched = await __mod_tripCompanion.enrichWithIntegrationTripCompanion({
              memory,
              userText,
              locale: memory.locale,
              force: true,
              deps: { enabled: true },
            })
            memory = companionEnriched.memory
            tripCompanionResult = companionEnriched.tripCompanion
            tripCompanionMeta = __mod_tripCompanion.toTripCompanionMeta(
              companionEnriched.tripCompanion,
            )
          }
        }

        // Integration Sprint 8 — Maps & Live Mobility (spatial awareness).
        if (isIntegrationMapsMobilityOn() && userText.trim()) {
          const __mod_mapsMobility = await loadIntegrationMapsMobility()
          if (
            __mod_mapsMobility.shouldRunMapsMobility({
              userText,
              memory,
            })
          ) {
            const mapsEnriched = await __mod_mapsMobility.enrichWithIntegrationMapsMobility({
              memory,
              userText,
              locale: memory.locale,
              force: true,
              deps: { enabled: true },
            })
            memory = mapsEnriched.memory
            mapsMobilityResult = mapsEnriched.mapsMobility
            mapsMobilityMeta = __mod_mapsMobility.toMapsMobilityMeta(
              mapsEnriched.mapsMobility,
            )
          }
        }

        // Integration Sprint 9 — Budget & Pricing Intelligence (financial value).
        if (isIntegrationBudgetPricingOn() && userText.trim()) {
          const __mod_budgetPricing = await loadIntegrationBudgetPricing()
          if (
            __mod_budgetPricing.shouldRunBudgetPricing({
              userText,
              memory,
            })
          ) {
            const budgetEnriched = await __mod_budgetPricing.enrichWithIntegrationBudgetPricing({
              memory,
              userText,
              locale: memory.locale,
              force: true,
              deps: {
                enabled: true,
                userId: input.conversationId,
              },
            })
            memory = budgetEnriched.memory
            budgetPricingResult = budgetEnriched.budgetPricing
            budgetPricingMeta = __mod_budgetPricing.toBudgetPricingMeta(
              budgetEnriched.budgetPricing,
            )
          }
        }

        // Integration Sprint 10 — Live Disruption Recovery (detect → recover → replan).
        if (isIntegrationDisruptionRecoveryOn() && userText.trim()) {
          const __mod_disruptionRecovery = await loadIntegrationDisruptionRecovery()
          if (
            __mod_disruptionRecovery.shouldRunDisruptionRecovery({
              userText,
              memory,
            })
          ) {
            const disruptionEnriched =
              await __mod_disruptionRecovery.enrichWithIntegrationDisruptionRecovery({
                memory,
                userText,
                locale: memory.locale,
                force: true,
                deps: { enabled: true },
              })
            memory = disruptionEnriched.memory
            disruptionRecoveryResult = disruptionEnriched.disruptionRecovery
            disruptionRecoveryMeta = __mod_disruptionRecovery.toDisruptionRecoveryMeta(
              disruptionEnriched.disruptionRecovery,
            )
          }
        }

        // Integration Sprint 11 — Action Execution Layer (safe prepare / confirm / mock).
        if (isIntegrationActionExecutionOn() && userText.trim()) {
          const __mod_actionExecution = await loadIntegrationActionExecution()
          if (
            __mod_actionExecution.shouldRunActionExecution({
              userText,
              memory,
            })
          ) {
            const actionEnriched =
              await __mod_actionExecution.enrichWithIntegrationActionExecution({
                memory,
                userText,
                locale: memory.locale,
                force: true,
                deps: {
                  enabled: true,
                  userId: input.conversationId,
                },
              })
            memory = actionEnriched.memory
            actionExecutionResult = actionEnriched.actionExecution
            actionExecutionMeta = __mod_actionExecution.toActionExecutionMeta(
              actionEnriched.actionExecution,
            )
          }
        }

        // Integration Sprint 12 — End-to-End Journey coordinator (shared handoff + traces).
        if (isIntegrationJourneyOn() && userText.trim()) {
          const __mod_journey = await loadIntegrationJourney()
          if (
            __mod_journey.shouldRunIntegrationJourney({
              userText,
              memory,
            })
          ) {
            const journeyEnriched = await __mod_journey.enrichWithIntegrationJourney({
              memory,
              userText,
              locale: memory.locale,
              force: true,
              deps: {
                enabled: true,
                userId: input.conversationId,
                conversationId: input.conversationId,
              },
            })
            memory = journeyEnriched.memory
            journeyResult = journeyEnriched.journey
            journeyMeta = __mod_journey.toJourneyMeta(journeyEnriched.journey)
          }
        }
        memory = withTripPlan(memory, memory.tripPlan ?? memory.itinerary)
      }

      // Sprint 20–27 — every user message through Brain when flags are on.
      // RC-2: heavy brain/integration + orchestrator load only when brain.enabled path runs.
      let brainMeta: BrainMetaSnapshot | undefined
      let attachBrainMeta = <T extends AgentProviderMeta>(meta: T, _brain?: BrainMetaSnapshot): T =>
        meta
      const travelEngineOn = isTravelEngineEnabled()
      const tripPlanningOn = isTripPlanningEnabled()
      const executionOn = isExecutionEnabled()
      const searchOn = isSearchEnabled()
      const orchestratorOn = isTripOrchestratorEnabled()
      if (isBrainEnabled() && userText.trim()) {
        const {
          runIntegratedBrainPipeline,
          toMetaBrain,
          withBrainMeta,
          brainMemoryToRequirementsPatch,
        } = await loadBrainIntegration()
        attachBrainMeta = withBrainMeta
        let brainResult: BrainTurnResult | null = null

        if (orchestratorOn) {
          const { getOrCreateAITripOrchestrator } = await loadBrainOrchestrator()
          const orchestrator = getOrCreateAITripOrchestrator()
          const orchResult = await orchestrator.runTurn({
            conversationId: input.conversationId,
            userText,
            locale: memory.locale,
            requirements: memory.requirements,
            signal: input.signal,
            userId: getBookingHistoryUserId() || input.conversationId,
            bookingFlow: isFlowEnabled(),
          })
          brainResult = (orchResult.brain as BrainTurnResult | null) ?? null
          if (brainResult) {
            brainMeta = toMetaBrain(brainResult, orchResult)
          }
        } else {
          brainResult = await runIntegratedBrainPipeline({
            conversationId: input.conversationId,
            userText,
            locale: memory.locale,
            requirements: memory.requirements,
            travelEngine: travelEngineOn || tripPlanningOn || executionOn || searchOn,
            tripPlanning: tripPlanningOn || executionOn || searchOn,
            execution: executionOn || searchOn,
            search: searchOn,
            signal: input.signal,
          })
          brainMeta = toMetaBrain(brainResult)
        }

        if (
          brainResult &&
          (isBrainHandoffEnabled() ||
            travelEngineOn ||
            tripPlanningOn ||
            executionOn ||
            searchOn ||
            orchestratorOn)
        ) {
          memory = {
            ...memory,
            requirements: mergeRequirements(
              memory.requirements,
              brainMemoryToRequirementsPatch(brainResult.context.memory),
            ),
          }
          if (isClarificationEnabled()) {
            const clarified = applySmartClarification(memory.requirements, {
              locale: memory.locale,
              enabled: true,
            })
            memory = { ...memory, requirements: clarified.requirements }
          }
          memory.missingFields = missingRequirementFields(memory.requirements, {
            smart: isClarificationEnabled(),
          })
          memory = withTripPlan(memory, memory.tripPlan ?? memory.itinerary)
        }

        // Sprint 22 — apply complete engine TripPlan into agent memory (booking workflow).
        const enginePlan = brainMeta?.engineTripPlan
        if (
          brainMeta &&
          (tripPlanningOn || executionOn || searchOn || orchestratorOn) &&
          enginePlan?.status === 'complete' &&
          enginePlan.agentTripPlan
        ) {
          memory = withTripPlan(
            { ...memory, phase: 'planned', missingFields: [] },
            enginePlan.agentTripPlan,
          )
        }

        // Sprint 25 — booking flow orchestration (edits + brain sync; no planning restart).
        // When Sprint 27 orchestrator is on, booking attach already ran inside AITripOrchestrator.
        if (isFlowEnabled() && !orchestratorOn && brainResult) {
          const {
            detectBookingFlowConversationEdit,
            getBookingFlowController,
            searchOptionsToBookingSelectedItems,
          } = await loadBookingFlow()
          const flowUserId = getBookingHistoryUserId() || input.conversationId
          const controller = getBookingFlowController()
          let flow =
            controller.restoreLatest(flowUserId) ??
            controller.createFlow({
              userId: flowUserId,
              conversationId: input.conversationId,
              currency: memory.requirements.budgetCurrency || 'SAR',
              budget: {
                amount: memory.requirements.budgetAmount ?? null,
                currency: memory.requirements.budgetCurrency ?? 'SAR',
              },
              dates: {
                startDate: memory.requirements.startDate ?? null,
                endDate: memory.requirements.endDate ?? null,
                durationDays: memory.requirements.durationDays ?? null,
              },
              travelers: {
                adults: memory.requirements.travelers ?? null,
                children: null,
                infants: null,
                summary: null,
              },
            })

          controller.setStage(flow.id, 'conversation')
          if (brainResult.planning) controller.setStage(flow.id, 'planning')
          if (brainResult.execution) controller.setStage(flow.id, 'execution')

          const search = brainResult.search as SearchAggregationTurnResult | null
          if (search?.recommendation) {
            flow = controller.attachSearchRecommendation(flow.id, search.recommendation)
            const topOption = search.recommendation.top?.option
            if (topOption && !flow.bookingSessionId) {
              const selected = searchOptionsToBookingSelectedItems([topOption])
              const applied = await controller.applySelection({
                flowId: flow.id,
                items: selected,
              })
              flow = applied.flow
            }
          }

          const edit = detectBookingFlowConversationEdit(userText)
          if (edit.kind !== 'unknown') {
            const edited = controller.applyConversationEdit(flow.id, userText)
            flow = edited.flow
          }

          const synced = controller.syncBrain(flow.id, brainResult.context.memory)
          brainResult.context = {
            ...brainResult.context,
            memory: synced.memory,
          }
          brainMeta = toMetaBrain(brainResult)
          memory = {
            ...memory,
            requirements: mergeRequirements(
              memory.requirements,
              brainMemoryToRequirementsPatch(synced.memory),
            ),
          }
        }
      }

      const attachBrain = <T extends AgentProviderMeta>(meta: T): T =>
        attachBrainMeta(meta, brainMeta)

      const attachReasoning = <T extends AgentProviderMeta>(meta: T): T => {
        if (!reasoningMeta) return meta
        return { ...meta, reasoning: reasoningMeta }
      }

      const attachClarification = <T extends AgentProviderMeta>(meta: T): T => {
        if (!clarificationMeta) return meta
        return { ...meta, clarification: clarificationMeta }
      }

      const attachTravelExecutive = <T extends AgentProviderMeta>(meta: T): T => {
        if (!travelExecutiveSnapshot) return meta
        return { ...meta, travelExecutive: toMetaTravelExecutive(travelExecutiveSnapshot) }
      }

      const attachExecutivePlatform = <T extends AgentProviderMeta>(meta: T): T => {
        if (!executivePlatformSnapshot && !liveIntelligenceSnapshot) return meta
        return {
          ...meta,
          ...(executivePlatformSnapshot
            ? {
              executivePlatform: toMetaExecutivePlatform(executivePlatformSnapshot),
              ...(toMetaExecutiveOs(executivePlatformSnapshot)
                ? { executiveOs: toMetaExecutiveOs(executivePlatformSnapshot) }
                : {}),
            }
            : {}),
          ...(liveIntelligenceSnapshot
            ? { liveIntelligence: toMetaLiveIntelligence(liveIntelligenceSnapshot) }
            : {}),
        }
      }

      const attachRahhalBrain = <T extends AgentProviderMeta>(meta: T): T => {
        if (!rahhalBrainMeta) return meta
        return { ...meta, rahhalBrain: toMetaRahhalBrain(rahhalBrainMeta) }
      }

      const attachTurnMeta = <T extends AgentProviderMeta>(meta: T, reply?: string): T => {
        const withAutonomous = autonomousSnapshot
          ? { ...meta, autonomous: toMetaAutonomous(autonomousSnapshot) }
          : meta
        const withDestinationIntelligence = destinationIntelligenceMeta
          ? { ...withAutonomous, destinationIntelligence: destinationIntelligenceMeta }
          : withAutonomous
        const withTripCompanion = tripCompanionMeta
          ? { ...withDestinationIntelligence, tripCompanion: tripCompanionMeta }
          : withDestinationIntelligence
        const withMapsMobility = mapsMobilityMeta
          ? { ...withTripCompanion, mapsMobility: mapsMobilityMeta }
          : withTripCompanion
        const withBudgetPricing = budgetPricingMeta
          ? { ...withMapsMobility, budgetPricing: budgetPricingMeta }
          : withMapsMobility
        const withDisruptionRecovery = disruptionRecoveryMeta
          ? { ...withBudgetPricing, disruptionRecovery: disruptionRecoveryMeta }
          : withBudgetPricing
        const withActionExecution = actionExecutionMeta
          ? { ...withDisruptionRecovery, actionExecution: actionExecutionMeta }
          : withDisruptionRecovery
        const withJourney = journeyMeta
          ? { ...withActionExecution, journey: journeyMeta }
          : withActionExecution
        const withBooking = bookingIntelligenceResult
          ? {
            ...withJourney,
            bookingIntelligence: toMetaBookingIntelligence(bookingIntelligenceResult),
          }
          : withJourney
        const withBudget = budgetIntelligenceResult
          ? { ...withBooking, budgetIntelligence: toMetaBudgetIntelligence(budgetIntelligenceResult) }
          : withBooking
        const withConversationIntelligence = conversationIntelligenceResult
          ? {
            ...withBudget,
            conversationIntelligence: toMetaConversationIntelligence(conversationIntelligenceResult),
          }
          : withBudget
        const withLlmBrain = llmBrainResult
          ? {
            ...withConversationIntelligence,
            llmBrain: toMetaLlmBrain(llmBrainResult),
          }
          : withConversationIntelligence
        const withAgentRuntime = agentRuntimeResult
          ? {
            ...withLlmBrain,
            agentRuntime: toMetaAgentRuntime(agentRuntimeResult),
          }
          : withLlmBrain
        const withPersonalization = travelerPersonalizationResult
          ? {
            ...withAgentRuntime,
            travelerPersonalization: toMetaTravelerPersonalization(travelerPersonalizationResult),
          }
          : withAgentRuntime
        const withOptimizer = tripOptimizerResult
          ? { ...withPersonalization, tripOptimizer: toMetaTripOptimizer(tripOptimizerResult) }
          : withPersonalization
        const withPlanner = travelPlannerResult
          ? { ...withOptimizer, travelPlanner: toMetaTravelPlanner(travelPlannerResult) }
          : withOptimizer
        const withDecision = autonomousDecisionResult
          ? {
            ...withPlanner,
            autonomousDecision: toMetaAutonomousDecision(autonomousDecisionResult),
          }
          : withPlanner
        const withLearning = adaptiveLearningResult
          ? {
            ...withDecision,
            adaptiveLearning: toMetaAdaptiveLearning(adaptiveLearningResult),
          }
          : withDecision
        const withPrice = priceIntelligenceResult
          ? {
            ...withLearning,
            priceIntelligence: toMetaPriceIntelligence(priceIntelligenceResult),
          }
          : withLearning
        const withPackages = dynamicPackagesResult
          ? {
            ...withPrice,
            dynamicPackages: toMetaDynamicPackages(dynamicPackagesResult),
          }
          : withPrice
        const withRefinement = itineraryRefinementResult
          ? {
            ...withPackages,
            itineraryRefinement: toMetaItineraryRefinement(itineraryRefinementResult),
          }
          : withPackages
        const withConstitution = constitutionMeta
          ? { ...withRefinement, constitution: constitutionMeta }
          : withRefinement
        const withConcierge = conciergeIntegration?.enabled && conciergeIntegration.meta
          ? {
            ...withConstitution,
            conciergeExperience: conciergeIntegration.meta,
            conciergeRecommendation: conciergeIntegration.recommendation,
          }
          : withConstitution
        const withAlphaAssembly = alphaTravelerAssembly
          ? {
            ...withConcierge,
            alphaTravelerExperience: {
              ...alphaTravelerAssembly.meta,
              experience: alphaTravelerAssembly.experience,
            },
          }
          : withConcierge
        const withBookingAssistant = bookingAssistantAssembly
          ? {
            ...withAlphaAssembly,
            bookingAssistant: {
              ...bookingAssistantAssembly.meta,
              experience: bookingAssistantAssembly.experience,
            },
          }
          : withAlphaAssembly
        const withExecution = bookingExecutionResult
          ? { ...withBookingAssistant, bookingExecution: toMetaBookingExecution(bookingExecutionResult) }
          : withBookingAssistant
        const withPayments = paymentsResult
          ? { ...withExecution, payments: toMetaPayments(paymentsResult) }
          : withExecution
        const enriched = attachExecutivePlatform(
          attachTravelExecutive(
            attachRahhalBrain(attachClarification(attachReasoning(attachBrain(withPayments)))),
          ),
        )
        const spokenText = enriched.spokenText?.trim()
          || (reply ? reply.trim().slice(0, 360) : undefined)
        if (!spokenText) return enriched
        return {
          ...enriched,
          spokenText,
          voicePhase: enriched.voicePhase ?? 'final',
        }
      }

      // Integration Sprint 11 — Action Execution owns book/reserve/cancel/modify/share asks.
      if (
        !isBrainCoreEnabled()
        && actionExecutionResult?.enabled
        && actionExecutionResult.ok
        && actionExecutionResult.action != null
      ) {
        memory = withTripPlan({ ...memory, phase: memory.phase }, memory.tripPlan)
        const actionSummary = memory.locale === 'en'
          ? actionExecutionResult.consultantSummaryEn
          : actionExecutionResult.consultantSummaryAr
        const facts = buildTravelFacts({
          memory,
          objective: 'propose_options',
          missingSlots: memory.missingFields.map(String),
          optionHints: [
            actionExecutionResult.action
              ? `Action: ${actionExecutionResult.action}`
              : null,
            actionExecutionResult.execution?.reference
              ? `Ref: ${actionExecutionResult.execution.reference}`
              : null,
            actionExecutionResult.confirmation?.required
              && !actionExecutionResult.confirmation.confirmed
              ? 'Awaiting confirmation'
              : null,
          ].filter(Boolean) as string[],
          recommendations: [actionSummary].filter(Boolean),
          warnings: actionExecutionResult.execution?.liveBlocked
            ? ['Live execution blocked']
            : [],
        })
        const spoken = await speakTravelFacts({
          llms,
          conversationId: input.conversationId,
          messages: input.messages,
          facts,
          signal: input.signal,
        })
        const replyText = actionSummary || spoken.displayText
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          spokenText: (actionSummary || spoken.spokenText)?.slice(0, 360),
          voicePhase: 'final',
          toolResults: [],
        }
        return {
          reply: replyText,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta, meta.spokenText),
          toolBatch: null,
        }
      }

      // Integration Sprint 10 — Live Disruption Recovery owns delay/cancel recovery asks
      // (prefer over companion when the traveler reports an active disruption).
      if (
        !isBrainCoreEnabled()
        && disruptionRecoveryResult?.enabled
        && disruptionRecoveryResult.ok
        && (
          disruptionRecoveryResult.disruption != null
          || disruptionRecoveryResult.intent === 'what_now'
        )
      ) {
        memory = withTripPlan({ ...memory, phase: memory.phase }, memory.tripPlan)
        const disruptionSummary = memory.locale === 'en'
          ? disruptionRecoveryResult.consultantSummaryEn
          : disruptionRecoveryResult.consultantSummaryAr
        const facts = buildTravelFacts({
          memory,
          objective: 'propose_options',
          missingSlots: memory.missingFields.map(String),
          optionHints: [
            disruptionRecoveryResult.primary
              ? `${disruptionRecoveryResult.primary.titleEn}: ${disruptionRecoveryResult.primary.whyEn}`
              : null,
            ...disruptionRecoveryResult.plans.slice(0, 2).map((p) => p.titleEn),
          ].filter(Boolean) as string[],
          recommendations: [disruptionSummary].filter(Boolean),
          warnings: [
            disruptionRecoveryResult.impact?.summaryEn,
            disruptionRecoveryResult.risk
              ? `Risk: ${disruptionRecoveryResult.risk}`
              : null,
          ].filter(Boolean) as string[],
        })
        const spoken = await speakTravelFacts({
          llms,
          conversationId: input.conversationId,
          messages: input.messages,
          facts,
          signal: input.signal,
        })
        const replyText = disruptionSummary || spoken.displayText
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          spokenText: (disruptionSummary || spoken.spokenText)?.slice(0, 360),
          voicePhase: 'final',
          toolResults: [],
        }
        return {
          reply: replyText,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta, meta.spokenText),
          toolBatch: null,
        }
      }

      // Integration Sprint 9 — Budget & Pricing answers financial / value questions.
      if (
        !isBrainCoreEnabled()
        && budgetPricingResult?.enabled
        && budgetPricingResult.ok
        && budgetPricingResult.intent !== 'unknown'
      ) {
        memory = withTripPlan({ ...memory, phase: memory.phase }, memory.tripPlan)
        const budgetSummary = memory.locale === 'en'
          ? budgetPricingResult.consultantSummaryEn
          : budgetPricingResult.consultantSummaryAr
        const facts = buildTravelFacts({
          memory,
          objective: 'propose_options',
          missingSlots: memory.missingFields.map(String),
          optionHints: [
            budgetPricingResult.primary
              ? `${budgetPricingResult.primary.labelEn}: ${budgetPricingResult.primary.whyEn}`
              : null,
            ...budgetPricingResult.flexible.slice(0, 2).map((f) => f.titleEn),
          ].filter(Boolean) as string[],
          recommendations: [budgetSummary].filter(Boolean),
          warnings: budgetPricingResult.tradeoffs
            .filter((t) => t.exceedsBudget)
            .map((t) => t.detailEn),
        })
        const spoken = await speakTravelFacts({
          llms,
          conversationId: input.conversationId,
          messages: input.messages,
          facts,
          signal: input.signal,
        })
        const replyText = budgetSummary || spoken.displayText
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          spokenText: (budgetSummary || spoken.spokenText)?.slice(0, 360),
          voicePhase: 'final',
          toolResults: [],
        }
        return {
          reply: replyText,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta, meta.spokenText),
          toolBatch: null,
        }
      }

      // Integration Sprint 8 — Maps & Live Mobility answers spatial / route questions.
      if (
        !isBrainCoreEnabled()
        && mapsMobilityResult?.enabled
        && mapsMobilityResult.ok
        && mapsMobilityResult.intent !== 'unknown'
      ) {
        memory = withTripPlan({ ...memory, phase: memory.phase }, memory.tripPlan)
        const mapsSummary = memory.locale === 'en'
          ? mapsMobilityResult.consultantSummaryEn
          : mapsMobilityResult.consultantSummaryAr
        const facts = buildTravelFacts({
          memory,
          objective: 'propose_options',
          missingSlots: memory.missingFields.map(String),
          optionHints: [
            mapsMobilityResult.route
              ? `Route: ${mapsMobilityResult.route.summaryEn}`
              : null,
            mapsMobilityResult.nearby[0]
              ? `Nearby: ${mapsMobilityResult.nearby[0].place.labelEn}`
              : null,
          ].filter(Boolean) as string[],
          recommendations: [mapsSummary].filter(Boolean),
          warnings: [],
        })
        const spoken = await speakTravelFacts({
          llms,
          conversationId: input.conversationId,
          messages: input.messages,
          facts,
          signal: input.signal,
        })
        const replyText = mapsSummary || spoken.displayText
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          spokenText: (mapsSummary || spoken.spokenText)?.slice(0, 360),
          voicePhase: 'final',
          toolResults: [],
        }
        return {
          reply: replyText,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta, meta.spokenText),
          toolBatch: null,
        }
      }

      // Integration Sprint 7 — Live Trip Companion answers in-trip questions / disruptions.
      if (
        !isBrainCoreEnabled()
        && tripCompanionResult?.enabled
        && tripCompanionResult.ok
        && (
          tripCompanionResult.assistantIntent !== 'unknown'
          || tripCompanionResult.replanned
          || tripCompanionResult.emergency
        )
      ) {
        memory = withTripPlan({ ...memory, phase: memory.phase }, memory.tripPlan)
        const companionSummary = memory.locale === 'en'
          ? tripCompanionResult.consultantSummaryEn
          : tripCompanionResult.consultantSummaryAr
        const facts = buildTravelFacts({
          memory,
          objective: 'propose_options',
          missingSlots: memory.missingFields.map(String),
          optionHints: [
            tripCompanionResult.timeline?.next
              ? `Next: ${tripCompanionResult.timeline.next.titleEn}`
              : null,
            tripCompanionResult.session
              ? `Session: ${tripCompanionResult.session.state}`
              : null,
          ].filter(Boolean) as string[],
          recommendations: [companionSummary].filter(Boolean),
          warnings: tripCompanionResult.disruptions.map((d) => d.detailEn),
        })
        const spoken = await speakTravelFacts({
          llms,
          conversationId: input.conversationId,
          messages: input.messages,
          facts,
          signal: input.signal,
        })
        const replyText = companionSummary || spoken.displayText
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          spokenText: (companionSummary || spoken.spokenText)?.slice(0, 360),
          voicePhase: 'final',
          toolResults: [],
        }
        return {
          reply: replyText,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta, meta.spokenText),
          toolBatch: null,
        }
      }

      // Integration Sprint 5 — Destination Intelligence can advise without a booking request.
      if (
        !isBrainCoreEnabled()
        && destinationIntelligenceResult?.enabled
        && destinationIntelligenceResult.ok
        && (
          destinationIntelligenceResult.mode === 'compare'
          || destinationIntelligenceResult.mode === 'recommend'
          || (
            memory.requirements.destinationFlexible
            && !memory.requirements.destination
          )
        )
      ) {
        memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
        const diSummary = memory.locale === 'en'
          ? destinationIntelligenceResult.consultantSummaryEn
          : destinationIntelligenceResult.consultantSummaryAr
        const diHints = [
          destinationIntelligenceResult.primary
            ? `${destinationIntelligenceResult.primary.knowledge.nameEn}: ${destinationIntelligenceResult.primary.whyEn}`
            : null,
          ...destinationIntelligenceResult.alternatives.slice(0, 2).map(
            (a) => `${a.knowledge.nameEn}: ${a.whyEn}`,
          ),
        ].filter(Boolean) as string[]
        const facts = buildTravelFacts({
          memory,
          objective: 'propose_options',
          missingSlots: memory.missingFields.map(String),
          optionHints: diHints,
          recommendations: [
            diSummary,
            ...(destinationIntelligenceResult.primary?.knowledge.prosEn.slice(0, 2) ?? []),
          ].filter(Boolean),
          warnings: destinationIntelligenceResult.primary?.knowledge.consEn.slice(0, 2) ?? [],
        })
        const spoken = await speakTravelFacts({
          llms,
          conversationId: input.conversationId,
          messages: input.messages,
          facts,
          signal: input.signal,
        })
        const replyText = diSummary || spoken.displayText
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          spokenText: (diSummary || spoken.spokenText)?.slice(0, 360),
          voicePhase: 'final',
          toolResults: [],
        }
        return {
          reply: replyText,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta, meta.spokenText),
          toolBatch: null,
        }
      }

      // Integration Sprint 12 — Journey coordinator unifies the turn when no specialist owned it.
      if (
        !isBrainCoreEnabled()
        && journeyResult?.enabled
        && journeyResult.ok
      ) {
        memory = withTripPlan({ ...memory, phase: memory.phase }, memory.tripPlan)
        const journeySummary = memory.locale === 'en'
          ? journeyResult.consultantSummaryEn
          : journeyResult.consultantSummaryAr
        const facts = buildTravelFacts({
          memory,
          objective: 'propose_options',
          missingSlots: journeyResult.handoff.missingSlots,
          optionHints: [
            `Stage: ${journeyResult.stage}`,
            `Score: ${journeyResult.decision.overall}`,
            ...journeyResult.handoff.knownSlots.slice(0, 4).map((s) => `Known: ${s}`),
          ],
          recommendations: [journeySummary].filter(Boolean),
          warnings: journeyResult.stages
            .filter((s) => s.status === 'skipped')
            .slice(0, 3)
            .map((s) => s.note),
        })
        const spoken = await speakTravelFacts({
          llms,
          conversationId: input.conversationId,
          messages: input.messages,
          facts,
          signal: input.signal,
        })
        const replyText = journeySummary || spoken.displayText
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          spokenText: (journeySummary || spoken.spokenText)?.slice(0, 360),
          voicePhase: 'final',
          toolResults: [],
        }
        return {
          reply: replyText,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta, meta.spokenText),
          toolBatch: null,
        }
      }

      // Sprint 45 — open-ended reasoning owns the consultant reply when proposing destinations.
      if (
        !isBrainCoreEnabled()
        && reasoningResult
        && reasoningMeta
        && memory.requirements.destinationFlexible
        && !memory.requirements.destination
        && reasoningResult.primary
      ) {
        memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
        const candidateHints = [
          reasoningResult.primary
            ? `${reasoningResult.primary.name}: ${reasoningResult.primary.whySelected.slice(0, 2).join('; ')}`
            : null,
          ...reasoningResult.alternatives.slice(0, 3).map(
            (c) => `${c.name}: ${c.whySelected.slice(0, 1).join('')}`,
          ),
        ].filter(Boolean) as string[]
        const facts = buildTravelFacts({
          memory,
          objective: 'propose_options',
          missingSlots: (reasoningResult.followUpFields?.length
            ? reasoningResult.followUpFields
            : memory.missingFields).map(String),
          optionHints: candidateHints,
          recommendations: [
            reasoningResult.summary,
            ...reasoningResult.rationale.slice(0, 4),
          ].filter(Boolean),
          warnings: [
            ...(reasoningResult.primary?.riskNotes ?? []),
            ...(reasoningResult.primary?.advisoryNotes ?? []),
          ],
        })
        const spoken = await speakTravelFacts({
          llms,
          conversationId: input.conversationId,
          messages: input.messages,
          facts,
          signal: input.signal,
        })
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          spokenText: spoken.spokenText,
          voicePhase: 'final',
          toolResults: [],
        }
        return {
          reply: spoken.displayText,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta, spoken.spokenText),
          toolBatch: null,
        }
      }

      // Sprint 22 — clarification from TripPlanningEngine (shared with voice via runIntegratedBrainTurn).
      if (
        (tripPlanningOn || executionOn || searchOn || orchestratorOn)
        && brainMeta?.clarificationQuestion
        && brainMeta.planning?.stage === 'clarify'
      ) {
        memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        {
          const facts = buildTravelFacts({
            memory,
            objective: 'collect_missing',
            missingSlots: memory.missingFields.map(String),
            recommendations: [brainMeta.clarificationQuestion],
          })
          const spoken = await speakTravelFacts({
            llms,
            conversationId: input.conversationId,
            messages: input.messages,
            facts,
            signal: input.signal,
          })
          return {
            reply: spoken.displayText,
            memory,
            tripPlan: memory.tripPlan,
            meta: attachTurnMeta({ ...meta, spokenText: spoken.spokenText, voicePhase: 'final' }, spoken.spokenText),
            toolBatch: null,
          }
        }
      }

      // Sprint 21 — contextual one-question follow-up (text + voice share this path).
      if (
        travelEngineOn
        && !tripPlanningOn
        && brainMeta?.action === 'ask_missing'
        && brainMeta.contextualReply
      ) {
        memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        {
          const facts = buildTravelFacts({
            memory,
            objective: 'collect_missing',
            missingSlots: memory.missingFields.map(String),
            recommendations: [brainMeta.contextualReply],
          })
          const spoken = await speakTravelFacts({
            llms,
            conversationId: input.conversationId,
            messages: input.messages,
            facts,
            signal: input.signal,
          })
          return {
            reply: spoken.displayText,
            memory,
            tripPlan: memory.tripPlan,
            meta: attachTurnMeta({ ...meta, spokenText: spoken.spokenText, voicePhase: 'final' }, spoken.spokenText),
            toolBatch: null,
          }
        }
      }

      // Sprint 17 — smart itinerary intents (above order / confirmation / history).
      if (
        SMART_ITINERARY_INTENTS.has(extracted.intent)
        && isSmartItineraryEnabled()
      ) {
        const records = await listBookingRecords()
        const __mod_findLatestBookingRecord = await loadBooking()

        const latest = __mod_findLatestBookingRecord.findLatestBookingRecord(records)
        const __mod_buildSmartItineraryConciergeReply = await loadSmartItinerary()

        const reply = __mod_buildSmartItineraryConciergeReply.buildSmartItineraryConciergeReply({
          intent: extracted.intent as SmartItineraryConciergeIntent,
          record: latest,
          locale: memory.locale,
        })
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        return {
          reply,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta, reply),
          toolBatch: null,
        }
      }

      // Sprint 15 — order / payment intents (above confirmation / history).
      // Alpha journey cues continue into Booking Execution + Payments instead.
      if (
        ORDER_PAYMENT_INTENTS.has(extracted.intent)
        && isOrderManagementEnabled()
        && !alphaJourneyCue
      ) {
        const records = await listBookingRecords()
        const __mod_findLatestBookingRecord = await loadBooking()

        const latest = __mod_findLatestBookingRecord.findLatestBookingRecord(records)
        const customerId = getBookingHistoryUserId() ?? latest?.userId
        const orderMod = await loadOrderManagement()
        const order = latest
          ? orderMod.findManagedOrderBySessionId(latest.sessionId)
          : null

        const reply = orderMod.buildOrderConciergeReply(
          extracted.intent as OrderConciergeIntent,
          {
            bookingSessionId: latest?.sessionId,
            customerId: customerId ?? undefined,
            order,
          },
        )
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        return {
          reply,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta),
          toolBatch: null,
        }
      }

      // Sprint 14 — confirmation intents (above history / concierge intake).
      // Alpha journey cues continue into Booking Execution + Payments instead.
      if (
        CONFIRMATION_INTENTS.has(extracted.intent)
        && isBookingConfirmationEnabled()
        && !alphaJourneyCue
      ) {
        const records = await listBookingRecords()
        const __mod_findLatestBookingRecord = await loadBooking()

        const latest = __mod_findLatestBookingRecord.findLatestBookingRecord(records)
        const bookingMod = await loadBooking()
        const confirmMod = await loadBookingConfirmation()
        const session = latest
          ? bookingMod.getBookingOrchestrator().getBookingSession(latest.sessionId)
          : null
        const confirmationState = session
          ? confirmMod.confirmationStateFromSession(session)
          : null

        const reply = confirmMod.buildConfirmationConciergeReply({
          intent: extracted.intent as ConfirmationConciergeIntent,
          state: confirmationState,
          record: latest,
          locale: memory.locale,
        })
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        return {
          reply,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta),
          toolBatch: null,
        }
      }

      // Sprint 13 — booking history intents (above concierge intake; no tools).
      if (
        BOOKING_HISTORY_INTENTS.has(extracted.intent)
        && isBookingHistoryEnabled()
      ) {
        const records = await listBookingRecords()
        const __mod_buildBookingHistoryConciergeReply = await loadBooking()

        const reply = __mod_buildBookingHistoryConciergeReply.buildBookingHistoryConciergeReply({
          intent: extracted.intent as BookingHistoryIntent,
          records,
          locale: memory.locale,
        })
        const meta: AgentProviderMeta = {
          kind: 'travel_agent',
          version: 2,
          memory,
          tripPlan: memory.tripPlan,
          itinerary: memory.tripPlan,
          toolResults: [],
        }
        return {
          reply,
          memory,
          tripPlan: memory.tripPlan,
          meta: attachTurnMeta(meta),
          toolBatch: null,
        }
      }

      const __mod_rebuildConciergeStateFromMessages = await loadConciergeMeta()


      let conciergeState: ConciergeState | null = __mod_rebuildConciergeStateFromMessages.rebuildConciergeStateFromMessages(
        input.messages.slice(0, -1),
      )

      // Concierge sits above the agent: consultant dialogue or agent handoff.
      // It never selects providers — only whether the agent should execute.
      if (isConciergeEnabled() && conciergeService) {
        const conciergeResult = conciergeService.runTurn({
          locale: memory.locale,
          memory,
          userText,
          intent: extracted.intent,
          requirements: memory.requirements,
          missingFields: memory.missingFields,
          previous: conciergeState,
        })
        conciergeState = conciergeResult.state

        if (!conciergeResult.handoff.shouldExecuteAgent) {
          // Experience Sprint 2 — Concierge decides policy/facts only; LLM writes the reply.
          memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
          // Clarifying turns (city / style) must not dump recommendations or planning drafts.
          const clarifyingMode = new Set([
            'destination_cities',
            'budget_framed_cities',
            'style_narrow',
          ]).has(conciergeResult.decision.valueMode ?? 'none')

          let optionHints: string[] | undefined
          const decisionBrief = conciergeResult.decision.valueBrief
          if (decisionBrief && decisionBrief.length > 0) {
            optionHints = decisionBrief
          } else if (
            !clarifyingMode
            && (
              conciergeResult.decision.action === 'propose_options'
              || conciergeResult.decision.action === 'advise'
            )
          ) {
            const __mod_buildConciergeRecommendations = await loadConciergeRecommendations()

            const recs = __mod_buildConciergeRecommendations.buildConciergeRecommendations({
              locale: memory.locale,
              requirements: memory.requirements,
              softSignals: conciergeResult.decision.state.softSignals,
            })
            optionHints = recs.optionLines
          }

          // Planning Draft — deterministic estimates for Conversation Brain (not TripPlan).
          const planningDraft = !clarifyingMode && canBuildPlanningDraft(memory.requirements)
            ? buildPlanningDraft({
              requirements: memory.requirements,
              locale: memory.locale,
            })
            : null

          const valueNotes: string[] = []
          if (planningDraft) {
            const insightLines = planningDraftToInsightLines(planningDraft, memory.locale)
            // Prefer draft ranking + city why-lines as option hints when we have estimates.
            optionHints = [
              ...planningDraft.cities.slice(0, 3).map((city) => `${city.name} — ${city.why}`),
              ...insightLines.slice(1, 3),
            ]
            valueNotes.push(planningDraft.rankingNote)
            if (conciergeResult.decision.preferenceQuestion) {
              valueNotes.push(conciergeResult.decision.preferenceQuestion)
            }
          } else {
            for (const row of [
              conciergeResult.decision.framingNote,
              conciergeResult.decision.preferenceQuestion,
            ]) {
              if (row && row.trim()) valueNotes.push(row)
            }
          }

          const facts = buildTravelFacts({
            memory,
            objective: mapConciergeObjective(conciergeResult.decision.action),
            // Value-first turns leave askFields empty on purpose — do not fall back to
            // the full missingFields census (that recreates form interrogation).
            missingSlots: (conciergeResult.decision.askFields ?? []).map(String),
            softSignals: conciergeResult.decision.state.softSignals as unknown as Record<string, unknown>,
            heardSummary: conciergeResult.decision.state.heardSummary,
            optionHints,
            recommendations: valueNotes.length > 0 ? valueNotes : undefined,
            planningDraft,
          })
          const spoken = await speakTravelFacts({
            llms,
            conversationId: input.conversationId,
            messages: input.messages,
            facts,
            signal: input.signal,
          })
          const meta: AgentProviderMeta = {
            kind: 'travel_agent',
            version: 2,
            memory,
            tripPlan: memory.tripPlan,
            itinerary: memory.tripPlan,
            spokenText: spoken.spokenText,
            voicePhase: 'final',
            toolResults: [],
            concierge: toMetaConcierge(conciergeState),
            ...(planningDraft
              ? {
                planningDraft: {
                  destination: planningDraft.destination,
                  rankedCities: planningDraft.rankedCities,
                  durationDays: planningDraft.durationDays,
                  recommendedDurationDays: planningDraft.recommendedDurationDays,
                  travelerCount: planningDraft.travelerCount,
                  budgetAmount: planningDraft.budgetAmount,
                  budgetCurrency: planningDraft.budgetCurrency,
                  confidence: planningDraft.confidence,
                  confidenceScore: planningDraft.confidenceScore,
                  breakdown: planningDraft.breakdown,
                  missingAssumptions: planningDraft.missingAssumptions,
                  rankingNote: planningDraft.rankingNote,
                },
              }
              : {}),
          }
          return {
            reply: spoken.displayText,
            memory,
            tripPlan: memory.tripPlan,
            meta: attachTurnMeta(meta, spoken.spokenText),
            toolBatch: null,
          }
        }
      }

      const llm = llms.getActive()
      const llmResult = await llm.complete({
        conversationId: input.conversationId,
        messages: input.messages,
        memory,
        locale: memory.locale,
        signal: input.signal,
      })

      let toolBatch: ToolExecutionBatch | null = null
      let objective: ConversationObjective = 'general'
      let savedTitle: string | null = null

      if (extracted.intent === 'save') {
        if (!memory.tripPlan) {
          objective = 'explain_unavailable'
          memory.phase = 'collecting'
        } else if (savePlanHook) {
          const saved = await savePlanHook({
            conversationId: input.conversationId,
            tripPlan: memory.tripPlan,
          })
          savedTitle = saved?.title || memory.tripPlan.title
          objective = 'acknowledge_save'
          memory.phase = 'planned'
        } else {
          objective = 'acknowledge_save'
          savedTitle = memory.tripPlan.title
          memory.phase = 'planned'
        }
      } else if (extracted.intent === 'regenerate_day' && memory.tripPlan) {
        const existingPlan = memory.tripPlan
        const day = extracted.patch.regenerateDay
          ?? memory.requirements.regenerateDay
          ?? 1
        memory = {
          ...memory,
          requirements: {
            ...memory.requirements,
            regenerateDay: day,
            regenerateScope: 'day',
          },
          lastIntent: 'regenerate_day',
          missingFields: [],
        }
        const refreshedDay = regenerateTripDay(existingPlan, day, memory.locale)
        const ran = await runToolsForPlan({
          memory,
          conversationId: input.conversationId,
          userText,
          signal: input.signal,
          basePlan: refreshedDay,
          priorAutonomous,
          onProgress: input.onProgress,
          travelPlanner: travelPlannerResult,
        })
        toolBatch = ran.batch
        if (ran.autonomous) autonomousSnapshot = ran.autonomous
        if (ran.bookingIntelligence) bookingIntelligenceResult = ran.bookingIntelligence
        if (ran.budgetIntelligence) budgetIntelligenceResult = ran.budgetIntelligence
        if (ran.travelPlanner) travelPlannerResult = ran.travelPlanner
        if (ran.travelerPersonalization) {
          const priorLearning = travelerPersonalizationResult?.diagnostics.learningEvents ?? []
          travelerPersonalizationResult = {
            ...ran.travelerPersonalization,
            diagnostics: {
              ...ran.travelerPersonalization.diagnostics,
              learningEvents: priorLearning.length > 0
                ? priorLearning
                : ran.travelerPersonalization.diagnostics.learningEvents,
            },
          }
        }
        if (ran.tripOptimizer) tripOptimizerResult = ran.tripOptimizer
        if (ran.autonomousDecision) autonomousDecisionResult = ran.autonomousDecision
        if (ran.priceIntelligence) priceIntelligenceResult = ran.priceIntelligence
        if (ran.dynamicPackages) dynamicPackagesResult = ran.dynamicPackages
        if (ran.itineraryRefinement) itineraryRefinementResult = ran.itineraryRefinement
        if (ran.bookingExecution) bookingExecutionResult = ran.bookingExecution
        if (ran.payments) paymentsResult = ran.payments
        memory = withTripPlan({ ...memory, phase: 'editing', missingFields: [] }, ran.plan)
        objective = 'present_plan'
      } else if (extracted.intent === 'edit' && !hasPlanningPatch(extracted.patch) && memory.tripPlan) {
        objective = 'acknowledge_edit'
        memory.phase = 'editing'
      } else if (
        (
          extracted.intent === 'regenerate'
          || extracted.intent === 'edit'
          || extracted.intent === 'plan'
          || extracted.intent === 'answer'
          || alphaJourneyCue
        )
        && memory.missingFields.length === 0
      ) {
        const scope = memory.requirements.regenerateScope
          ?? extracted.patch.regenerateScope
          ?? (extracted.intent === 'regenerate' ? 'whole' : null)
        memory = {
          ...memory,
          requirements: {
            ...memory.requirements,
            regenerateScope: scope,
          },
        }
        const scoped = scope === 'flight' || scope === 'hotel' || scope === 'activities'
        const basePlan = memory.tripPlan && extracted.intent === 'edit'
          ? applyTripPlanEdits(memory.tripPlan, extracted.patch, memory.locale)
          : (scoped && memory.tripPlan ? memory.tripPlan : undefined)
        const seed = extracted.intent === 'regenerate' && (!scope || scope === 'whole')
          ? `regen-${Date.now()}`
          : undefined
        const ran = await runToolsForPlan({
          memory,
          conversationId: input.conversationId,
          userText,
          signal: input.signal,
          seed,
          basePlan,
          priorAutonomous,
          onProgress: input.onProgress,
          travelPlanner: travelPlannerResult,
        })
        let plan = ran.plan
        toolBatch = ran.batch
        if (ran.autonomous) autonomousSnapshot = ran.autonomous
        if (ran.bookingIntelligence) bookingIntelligenceResult = ran.bookingIntelligence
        if (ran.budgetIntelligence) budgetIntelligenceResult = ran.budgetIntelligence
        if (ran.travelPlanner) travelPlannerResult = ran.travelPlanner
        if (ran.travelerPersonalization) {
          const priorLearning = travelerPersonalizationResult?.diagnostics.learningEvents ?? []
          travelerPersonalizationResult = {
            ...ran.travelerPersonalization,
            diagnostics: {
              ...ran.travelerPersonalization.diagnostics,
              learningEvents: priorLearning.length > 0
                ? priorLearning
                : ran.travelerPersonalization.diagnostics.learningEvents,
            },
          }
        }
        if (ran.tripOptimizer) tripOptimizerResult = ran.tripOptimizer
        if (ran.autonomousDecision) autonomousDecisionResult = ran.autonomousDecision
        if (ran.priceIntelligence) priceIntelligenceResult = ran.priceIntelligence
        if (ran.dynamicPackages) dynamicPackagesResult = ran.dynamicPackages
        if (ran.itineraryRefinement) itineraryRefinementResult = ran.itineraryRefinement
        if (ran.bookingExecution) bookingExecutionResult = ran.bookingExecution
        if (ran.payments) paymentsResult = ran.payments
        if (llmResult.draft?.notes?.length) {
          plan = { ...plan, notes: [...plan.notes, ...llmResult.draft.notes] }
        }
        memory = withTripPlan({ ...memory, phase: 'planned', missingFields: [] }, plan)
        objective = 'present_plan'
      } else if (memory.missingFields.length > 0) {
        memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
        objective = 'collect_missing'
      } else if (memory.tripPlan) {
        const existingPlan = memory.tripPlan
        memory = withTripPlan({ ...memory, phase: 'planned' }, existingPlan)
        objective = 'present_plan'
      } else {
        objective = 'collect_missing'
      }

      // Sprint 54 — keep the travel goal alive across clarification turns.
      if (isAutonomousEnabled()) {
        const __mod_upsertTravelGoal = await loadAutonomous()

        const goal = __mod_upsertTravelGoal.upsertTravelGoal({
          conversationId: input.conversationId,
          userText,
          memory,
          priorGoal: autonomousSnapshot?.goal ?? priorAutonomous?.goal ?? null,
        })
        if (!autonomousSnapshot || autonomousSnapshot.outcome === 'blocked' || !autonomousSnapshot.plan) {
          autonomousSnapshot = {
            state: 'COMPLETE',
            progressPhase: objective === 'collect_missing' ? 'Completed' : (autonomousSnapshot?.progressPhase ?? 'Thinking'),
            goal,
            plan: autonomousSnapshot?.plan ?? null,
            completedTaskIds: autonomousSnapshot?.completedTaskIds ?? priorAutonomous?.completedTaskIds ?? [],
            pendingTaskIds: autonomousSnapshot?.pendingTaskIds ?? priorAutonomous?.pendingTaskIds ?? [],
            lastProviderId: autonomousSnapshot?.lastProviderId ?? priorAutonomous?.lastProviderId ?? null,
            totalRetries: autonomousSnapshot?.totalRetries ?? priorAutonomous?.totalRetries ?? 0,
            durationMs: autonomousSnapshot?.durationMs ?? 0,
            outcome: objective === 'collect_missing' ? 'blocked' : (autonomousSnapshot?.outcome ?? 'ok'),
            logs: autonomousSnapshot?.logs ?? priorAutonomous?.logs ?? [],
            recoveredFromFailures: autonomousSnapshot?.recoveredFromFailures
              ?? priorAutonomous?.recoveredFromFailures
              ?? false,
          }
        } else {
          autonomousSnapshot = { ...autonomousSnapshot, goal }
        }
      }

      const toolSummaries = toolBatch ? toToolSummaries(toolBatch.results) : undefined
      const toolHadNoResults = (toolBatch?.results ?? []).some((r) => {
        const err = typeof r.error === 'string' ? r.error : ''
        const summary = typeof r.summary === 'string' ? r.summary : ''
        return /no_results|no (?:flight|hotel) offers|no results/i.test(`${err} ${summary}`)
      })

      const decisionConfidence = autonomousDecisionResult?.recommendations?.confidence
        ?? dynamicPackagesResult?.selected?.confidence
        ?? priceIntelligenceResult?.recommendation.confidence
        ?? 0.78

      // Sprint 97 — integrate ConciergeComposer into conversation response (presentation only).
      const __mod_integrateConciergeIntoTurn = await loadConciergeIntegration()

      conciergeIntegration = __mod_integrateConciergeIntoTurn.integrateConciergeIntoTurn({
        conversationId: input.conversationId,
        memory,
        packageSelected: dynamicPackagesResult?.selected
          ? {
            id: dynamicPackagesResult.selected.id,
            title: dynamicPackagesResult.selected.title,
            totalPrice: dynamicPackagesResult.selected.totalPrice,
            currency: dynamicPackagesResult.selected.currency,
            confidence: dynamicPackagesResult.selected.confidence,
            labels: dynamicPackagesResult.selected.labels,
            explanation: dynamicPackagesResult.selected.explanation,
          }
          : null,
        packageRanked: (dynamicPackagesResult?.ranked ?? []).slice(0, 5).map((p) => ({
          id: p.id,
          title: p.title,
          totalPrice: p.totalPrice,
          currency: p.currency,
          confidence: p.confidence,
          labels: p.labels,
          explanation: p.explanation,
        })),
        decision: autonomousDecisionResult
          ? {
            explanation: autonomousDecisionResult.recommendations.explanation,
            confidence: autonomousDecisionResult.recommendations.confidence,
            bestOverallId: autonomousDecisionResult.recommendations.bestOverall?.id ?? null,
            bestBudgetId: autonomousDecisionResult.recommendations.bestBudget?.id ?? null,
            fastestId: autonomousDecisionResult.recommendations.fastest?.id ?? null,
            bestComfortId: autonomousDecisionResult.recommendations.bestComfort?.id ?? null,
          }
          : null,
        priceTimingNote: priceIntelligenceResult?.recommendation.explanation ?? null,
        priceConfidence: priceIntelligenceResult
          ? priceIntelligenceResult.recommendation.confidence / 100
          : null,
        engineConfidence: decisionConfidence > 1 ? decisionConfidence / 100 : decisionConfidence,
      })

      // Sprint 99 — assemble unified Alpha traveler experience (presentation only).
      {
        const { flightOffers: alphaFlights, hotelStays: alphaHotels } = offersFromToolBatch(
          toolBatch ?? undefined,
        )
        const __mod_assembleAlphaTravelerExperience = await loadAlphaExperience()

        alphaTravelerAssembly = __mod_assembleAlphaTravelerExperience.assembleAlphaTravelerExperience({
          conversationId: input.conversationId,
          memory,
          conciergeIntegration,
          packageSelected: dynamicPackagesResult?.selected
            ? {
              id: dynamicPackagesResult.selected.id,
              title: dynamicPackagesResult.selected.title,
              totalPrice: dynamicPackagesResult.selected.totalPrice,
              currency: dynamicPackagesResult.selected.currency,
              confidence: dynamicPackagesResult.selected.confidence,
              explanation: dynamicPackagesResult.selected.explanation,
              components: dynamicPackagesResult.selected.components,
            }
            : null,
          flightOffers: alphaFlights.length ? alphaFlights : null,
          hotelOffers: alphaHotels.length ? alphaHotels : null,
          decisionExplanation: autonomousDecisionResult?.recommendations.explanation ?? null,
          priceTimingNote: priceIntelligenceResult?.recommendation.explanation ?? null,
          priceConfidence: priceIntelligenceResult
            ? priceIntelligenceResult.recommendation.confidence / 100
            : null,
          engineConfidence: decisionConfidence > 1 ? decisionConfidence / 100 : decisionConfidence,
        })
      }

      // Sprint 101 — Smart Booking Assistant after Alpha Experience (presentation only).
      {
        const { flightOffers: bookingFlights, hotelStays: bookingHotels } = offersFromToolBatch(
          toolBatch ?? undefined,
        )
        const priceRec = priceIntelligenceResult?.recommendation
        const __mod_assembleBookingAssistant = await loadBookingAssistant()

        bookingAssistantAssembly = __mod_assembleBookingAssistant.assembleBookingAssistant({
          conversationId: input.conversationId,
          memory,
          alphaExperience: alphaTravelerAssembly?.experience ?? null,
          packageSelected: dynamicPackagesResult?.selected
            ? {
              id: dynamicPackagesResult.selected.id,
              title: dynamicPackagesResult.selected.title,
              totalPrice: dynamicPackagesResult.selected.totalPrice,
              currency: dynamicPackagesResult.selected.currency,
              confidence: dynamicPackagesResult.selected.confidence,
            }
            : null,
          flightOffers: bookingFlights.length ? bookingFlights : null,
          hotelOffers: bookingHotels.length ? bookingHotels : null,
          priceTimingAction: priceRec?.action ?? null,
          priceOpportunities: priceRec?.opportunities ?? null,
          priceExplanation: priceRec?.explanation ?? null,
          seatsRemaining: typeof bookingFlights[0]?.seatsRemaining === 'number'
            ? bookingFlights[0].seatsRemaining as number
            : typeof bookingFlights[0]?.availableSeats === 'number'
              ? bookingFlights[0].availableSeats as number
              : null,
          roomsRemaining: typeof bookingHotels[0]?.roomsRemaining === 'number'
            ? bookingHotels[0].roomsRemaining as number
            : null,
          visaRequiredSignal: travelPlannerResult?.riskFlags?.includes('visa_check_required')
            ? true
            : null,
          bookingReadyFromEngine: bookingIntelligenceResult?.readiness.bookingReady ?? null,
          paymentSessionActive: paymentsResult
            ? ['pending', 'authorized', 'partially_captured'].includes(paymentsResult.snapshot.status)
            : null,
          bookingConfirmed: Boolean(
            bookingExecutionResult
            && bookingExecutionResult.snapshot.confirmedCount > 0,
          ),
          preferencesApplied: Boolean(travelerPersonalizationResult || adaptiveLearningResult),
          engineConfidence: decisionConfidence > 1 ? decisionConfidence / 100 : decisionConfidence,
        })
      }

      const constitutionMod = await loadConstitution()

      const constitutionPreview = constitutionMod.applyConstitutionToTurn({
        userText,
        memory,
        tripPlan: memory.tripPlan,
        replyText: '',
        intent: memory.lastIntent,
        mission: travelPlannerResult?.travelPurpose ?? memory.requirements.tripPurpose,
        confidence: decisionConfidence,
        explanation: {
          why: autonomousDecisionResult?.recommendations.explanation
            ?? dynamicPackagesResult?.selected?.explanation?.split('\n')[0]
            ?? null,
          benefits: dynamicPackagesResult?.selected?.reasons?.slice(0, 3),
          tradeoffs: tripOptimizerResult?.recommendationFacts?.slice(0, 2),
          confidence: decisionConfidence,
        },
        alternativeCount: Math.max(
          dynamicPackagesResult?.ranked.length ?? 0,
          autonomousDecisionResult ? 2 : 0,
        ),
        toolHadNoResults,
        recoveredFromFailures: Boolean(autonomousSnapshot?.recoveredFromFailures),
        packagesPresent: Boolean(dynamicPackagesResult?.selected || dynamicPackagesResult?.ranked.length),
      })

      const facts = buildTravelFacts({
        memory,
        objective,
        tripPlan: memory.tripPlan,
        missingSlots: memory.missingFields.map(String),
        toolResults: toolSummaries,
        savedTitle,
        recommendations: [
          ...(travelPlannerResult?.recommendationFacts ?? []),
          ...(budgetIntelligenceResult?.recommendationFacts ?? []),
          ...(tripOptimizerResult?.recommendationFacts ?? []),
          ...(autonomousDecisionResult?.recommendations.explanation
            ? [autonomousDecisionResult.recommendations.explanation]
            : []),
          ...(bookingIntelligenceResult?.recommendationFacts ?? []),
          ...(bookingExecutionResult?.executionFacts ?? []),
          ...(paymentsResult?.paymentFacts ?? []),
          ...(dynamicPackagesResult?.selected?.explanation
            ? [dynamicPackagesResult.selected.explanation]
            : []),
          ...(conciergeIntegration?.recommendationFacts ?? []),
          ...constitutionPreview.recommendationFacts,
          ...constitutionPreview.recoveryNotes,
        ],
        warnings: bookingIntelligenceResult && !bookingIntelligenceResult.readiness.bookingReady
          ? [bookingIntelligenceResult.readiness.clarification].filter(Boolean) as string[]
          : budgetIntelligenceResult?.diagnostics.overflow
            ? ['Selected options exceed your stated budget — ask for cheaper alternatives if needed.']
          : bookingExecutionResult && bookingExecutionResult.snapshot.failedCount > 0
            ? [`Booking execution failures: ${bookingExecutionResult.snapshot.failedCount}`]
            : paymentsResult && paymentsResult.snapshot.status === 'failed'
              ? [`Payment failed: ${paymentsResult.session.lastError ?? 'unknown'}`]
              : toolHadNoResults
                ? constitutionPreview.recoveryNotes
              : undefined,
      })
      const spoken = await speakTravelFacts({
        llms,
        conversationId: input.conversationId,
        messages: input.messages,
        facts,
        signal: input.signal,
      })

      // Sprint 89 — validate traveler-facing reply; keep meta on every interaction.
      const constitutionFinal = constitutionMod.applyConstitutionToTurn({
        userText,
        memory,
        tripPlan: memory.tripPlan,
        replyText: spoken.displayText,
        intent: memory.lastIntent,
        mission: travelPlannerResult?.travelPurpose ?? memory.requirements.tripPurpose,
        confidence: decisionConfidence,
        explanation: {
          why: autonomousDecisionResult?.recommendations.explanation
            ?? dynamicPackagesResult?.selected?.explanation?.split('\n')[0]
            ?? constitutionPreview.snapshot.explanation?.why
            ?? null,
          benefits: constitutionPreview.snapshot.explanation?.benefits,
          tradeoffs: constitutionPreview.snapshot.explanation?.tradeoffs,
          confidence: decisionConfidence,
        },
        alternativeCount: Math.max(
          dynamicPackagesResult?.ranked.length ?? 0,
          autonomousDecisionResult ? 2 : 0,
          constitutionPreview.snapshot.alternativeCount ?? 0,
        ),
        toolHadNoResults,
        recoveredFromFailures: Boolean(autonomousSnapshot?.recoveredFromFailures),
        packagesPresent: Boolean(dynamicPackagesResult?.selected || dynamicPackagesResult?.ranked.length),
      })
      constitutionMeta = constitutionFinal.meta

      let displayReply = spoken.displayText
      if (/no results|لا توجد نتائج/i.test(displayReply) && !memory.tripPlan) {
        displayReply = [
          displayReply.replace(/\bno results\b/gi, 'limited matches'),
          '',
          constitutionFinal.recoveryNotes[0]
            ?? 'I am expanding nearby airports, flexible dates, alternative hotels, and other providers for closer options.',
        ].join('\n')
      }

      const meta: AgentProviderMeta = {
        kind: 'travel_agent',
        version: 2,
        memory,
        tripPlan: memory.tripPlan,
        itinerary: memory.tripPlan,
        spokenText: spoken.spokenText,
        voicePhase: 'final',
        toolResults: toolBatch ? toToolSummaries(toolBatch.results) : [],
        ...(conciergeState ? { concierge: toMetaConcierge(conciergeState) } : {}),
      }

      return {
        reply: displayReply,
        memory,
        tripPlan: memory.tripPlan,
        meta: attachTurnMeta(meta, spoken.spokenText),
        toolBatch,
      }
    },

    async regeneratePlan({ conversationId, memory, signal }) {
      const ran = await runToolsForPlan({
        memory: { ...memory, lastIntent: 'regenerate', missingFields: [] },
        conversationId,
        signal,
        seed: `regen-${Date.now()}`,
      })
      return ran.plan
    },

    async regenerateDay({ conversationId, plan, day, locale, signal }) {
      const memory: AgentMemory = {
        locale,
        phase: 'editing',
        requirements: {
          ...plan.requirements,
          regenerateDay: day,
          regenerateScope: 'day',
        },
        tripPlan: plan,
        itinerary: plan,
        missingFields: [],
        lastIntent: 'regenerate_day',
      }
      const refreshedDay = regenerateTripDay(plan, day, locale)
      const ran = await runToolsForPlan({
        memory,
        conversationId,
        signal,
        basePlan: refreshedDay,
      })
      return ran.plan
    },

    async regenerateScoped({ conversationId, memory, scope, signal }) {
      const nextMemory: AgentMemory = {
        ...memory,
        lastIntent: 'regenerate',
        missingFields: [],
        requirements: {
          ...memory.requirements,
          regenerateScope: scope,
        },
      }
      const ran = await runToolsForPlan({
        memory: nextMemory,
        conversationId,
        signal,
        basePlan: memory.tripPlan ?? undefined,
      })
      return ran.plan
    },

    async editPlan({ conversationId, plan, patch, locale, signal }) {
      const requirements = {
        ...plan.requirements,
        ...patch,
        destinations: patch.destinations?.length
          ? patch.destinations
          : plan.requirements.destinations,
        interests: patch.interests?.length
          ? patch.interests
          : plan.requirements.interests,
        destination: patch.destination ?? plan.requirements.destination,
      }
      const memory: AgentMemory = {
        locale,
        phase: 'editing',
        requirements,
        tripPlan: plan,
        itinerary: plan,
        missingFields: [],
        lastIntent: 'edit',
      }
      const base = applyTripPlanEdits({ ...plan, conversationId }, patch, locale)
      const ran = await runToolsForPlan({
        memory,
        conversationId,
        signal,
        basePlan: base,
      })
      return ran.plan
    },

    async savePlan({ tripPlan, existingSavedTripId }) {
      const saved = await saveGeneratedItinerary({
        itinerary: tripPlan,
        existingSavedTripId,
      })
      return { id: saved.id, title: saved.title }
    },
  }

  return service
}

/** Impl-level singleton (tests importing .impl directly). Product uses facade. */
export const travelAgentService = createTravelAgentService()
