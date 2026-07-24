/**
 * Single orchestration layer for Travel AI Agent planning.
 * Chat (text + voice) and Saved Trips integrate through this service only.
 */

import type { ChatMessage } from '../chat/chatTypes'
import { getFeatureRegistry } from '../ai'
import {
  createConciergeService,
  type ConciergeService,
  type ConciergeState,
} from '../concierge'
import { buildConciergeRecommendations } from '../concierge/recommendationBridge'
import { rebuildConciergeStateFromMessages } from '../concierge/meta'
import { applyTripPlanEdits, buildTripPlan, regenerateTripDay } from './buildItinerary'
import { applyIntelligentDecisions } from './decision'
import { extractFromUserText } from './extractRequirements'
import { createAgentLlmRegistry } from './llm/factory'
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
import { createDefaultAgentToolRegistry } from './tools/stubs'
import type { AgentToolRegistry, AgentToolResult, ToolExecutionBatch } from './tools/types'
import {
  goalFromMeta,
  isAutonomousAgentEnabled,
  runAutonomousTurn,
  upsertTravelGoal,
  type AutonomousAgentSnapshot,
  type AutonomousProgressEvent,
} from './autonomous'
import {
  enrichWithBookingIntelligence,
  isBookingIntelligenceEnabled,
  type BookingIntelligenceResult,
} from './bookingIntelligence'
import {
  enrichWithBudgetIntelligence,
  isBudgetIntelligenceEnabled,
  type BudgetIntelligenceResult,
} from './budgetIntelligence'
import {
  enrichWithTravelerPersonalization,
  isTravelerPersonalizationEnabled,
  runTravelerPersonalization,
  type TravelerPersonalizationResult,
} from './travelerPersonalization'
import {
  enrichWithTripOptimizer,
  isTripOptimizerEnabled,
  type TripOptimizerResult,
} from './tripOptimizer'
import {
  isTravelPlannerEnabled,
  runTravelPlanner,
  type TravelPlannerResult,
} from './travelPlanner'
import {
  enrichWithAutonomousDecision,
  isAutonomousDecisionEnabled,
  type AutonomousDecisionResult,
} from './autonomousDecision'
import {
  getLearnedProfile,
  isAdaptiveLearningEnabled,
  runAdaptiveLearningTurn,
  type AdaptiveLearningResult,
} from './adaptiveLearning'
import {
  enrichWithPriceIntelligence,
  isPriceIntelligenceEnabled,
  type BookingTimingResult,
} from './priceIntelligence'
import {
  enrichWithDynamicPackages,
  isDynamicPackagesEnabled,
  type PackageBuilderResult,
} from './packageBuilder'
import { applyConstitutionToTurn } from './constitution'
import {
  enrichWithItineraryRefinement,
  isItineraryRefinementEnabled,
  type RefinementResult,
} from './itineraryRefinement'
import {
  enrichWithBookingExecution,
  findLatestConfirmedBookingExecution,
  isBookingExecutionEnabled,
  shouldRunBookingExecution,
  type BookingExecutionResult,
} from './bookingExecution'
import {
  enrichWithPaymentsPlatform,
  findLatestPaymentsResult,
  isPaymentsEnabled,
  shouldRunPayments,
  shouldShowPaymentSummary,
  type PaymentsPlatformResult,
} from './paymentsPlatform'
import {
  integrateConciergeIntoTurn,
  type ConciergeTurnIntegrationResult,
} from './conciergeIntegration'
import {
  assembleAlphaTravelerExperience,
  type AgentAlphaTravelerExperienceAttachment,
} from './alphaExperience'
import {
  assembleBookingAssistant,
  type AgentBookingAssistantAttachment,
} from './bookingAssistant'
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
import {
  buildBookingHistoryConciergeReply,
  findLatestBookingRecord,
  getBookingHistoryUserId,
  getBookingOrchestrator,
  loadUserBookingRecords,
  type BookingHistoryIntent,
  type BookingRecord,
} from '../booking'
import {
  buildConfirmationConciergeReply,
  confirmationStateFromSession,
  type ConfirmationConciergeIntent,
} from '../bookingConfirmation'
import {
  buildOrderConciergeReply,
  findManagedOrderBySessionId,
  type OrderConciergeIntent,
} from '../orderManagement'
import {
  buildSmartItineraryConciergeReply,
  type SmartItineraryConciergeIntent,
} from '../smartItinerary'
import {
  brainMemoryToRequirementsPatch,
  isBrainAgentHandoffEnabled,
  isBrainConciergeIntegrationEnabled,
  isBrainExecutionEnabled,
  isBrainSearchEnabled,
  isBrainTravelEngineEnabled,
  isBrainTripOrchestratorEnabled,
  isBrainTripPlanningEnabled,
  runIntegratedBrainPipeline,
  toMetaBrain,
  withBrainMeta,
  type BrainMetaSnapshot,
} from '../brain/integration'
import {
  getOrCreateAITripOrchestrator,
} from '../brain/orchestrator'
import type { BrainTurnResult } from '../brain/types'
import {
  runRahhalBrainTurn,
  isRahhalBrainEnabled,
  type RahhalBrainMetaSnapshot,
  type RahhalBrainTurnResult,
} from '../brain/core'
import {
  detectBookingFlowConversationEdit,
  getBookingFlowController,
  isBookingFlowEnabled,
  searchOptionsToBookingSelectedItems,
} from '../bookingFlow'
import type { SearchAggregationTurnResult } from '../brain/search'
import {
  applyReasoningToRequirements,
  isPreferenceMemoryEnabled,
  isTravelReasoningEnabled,
  learnPreferencesFromRequirements,
  matchDestinationSelection,
  runTravelReasoning,
  seedRequirementsFromPreferences,
  toReasoningSnapshot,
  type TravelReasoningResult,
} from './reasoning'

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
   * Phase 2 Stage 2 — Consultant Pipeline activation (read-only enrichment after planTurn).
   * Default: FeatureRegistry `ai.consultant_pipeline` (OFF). Never mutates production planning.
   */
  consultantPipelineEnabled?: boolean
  /**
   * Phase 2 Stage 3 — Unified Consultant Response aggregation (read-only).
   * Default: FeatureRegistry `ai.consultant_response` (OFF). Never mutates production planning.
   */
  consultantResponseEnabled?: boolean
  /**
   * Phase 2 Stage 4 — AI Runtime Coordinator (read-only orchestration).
   * Default: FeatureRegistry `ai.runtime_coordinator` (OFF). Never mutates production planning.
   */
  runtimeCoordinatorEnabled?: boolean
  /**
   * Phase 3 Stage 1 — Conversation Orchestrator (conversation management above Runtime Coordinator).
   * Default: FeatureRegistry `ai.conversation_orchestrator` (OFF). Never mutates production planning.
   */
  conversationOrchestratorEnabled?: boolean
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
    const goal = goalFromMeta(meta)
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
  const tools = options.tools ?? createDefaultAgentToolRegistry()
  const executor = createToolExecutor(tools)
  const llms = options.llms ?? createAgentLlmRegistry()
  const savePlanHook = options.savePlan
  const conciergeService = options.concierge === false
    ? null
    : (options.concierge ?? createConciergeService())

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
        ? runTravelPlanner({
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

      if (isBudgetIntelEnabled()) {
        const budgeted = await enrichWithBudgetIntelligence({
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
        const personalized = await enrichWithTravelerPersonalization({
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
        const optimized = await enrichWithTripOptimizer({
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
          ? getLearnedProfile(input.conversationId)
          : null
        const packaged = await enrichWithDynamicPackages({
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
        const refined = enrichWithItineraryRefinement({
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
          ? getLearnedProfile(input.conversationId)
          : null
        const decided = await enrichWithAutonomousDecision({
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
        const timed = enrichWithPriceIntelligence({
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
      const enriched = await enrichWithBookingIntelligence({
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
        const executed = await enrichWithBookingExecution({
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
      const payCue = shouldRunPayments({
        userText: input.userText,
        intent: input.memory.lastIntent,
        bookingExecutionStatus: bookingExecution?.snapshot.status ?? null,
      })
      const summaryCue = shouldShowPaymentSummary(input.userText)
      if (!bookingExecution && (payCue || summaryCue)) {
        bookingExecution = findLatestConfirmedBookingExecution(input.conversationId) ?? undefined
      }
      if (isPaymentsPlatformEnabled() && bookingExecution && payCue) {
        const paid = await enrichWithPaymentsPlatform({
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
        payments = findLatestPaymentsResult(input.conversationId) ?? undefined
        if (!bookingExecution) {
          bookingExecution = findLatestConfirmedBookingExecution(input.conversationId) ?? undefined
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
      const autonomous = await runAutonomousTurn({
        conversationId: input.conversationId,
        userText: input.userText ?? '',
        memory: input.memory,
        registry: tools,
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
        shouldRunBookingExecution({
          userText: input.userText,
          intent: input.memory.lastIntent,
          bookingReady: true,
        })
        || shouldRunPayments({
          userText: input.userText,
          intent: input.memory.lastIntent,
        })
        || shouldShowPaymentSummary(input.userText)
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

    const selected = selectToolsForTurn({
      requirements: input.memory.requirements,
      intent: input.memory.lastIntent,
      missingFields: input.memory.missingFields,
      searchPlan: travelPlanner?.searchPlan,
    })

    const batch = selected.length > 0
      ? await executor.execute({
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
      const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
      const userText = lastUser?.content ?? ''
      // Alpha — booking / payment / confirmation cues must reach Execution + Payments.
      const alphaBookingCue = shouldRunBookingExecution({
        userText,
        bookingReady: true,
      })
      const alphaPaymentCue = shouldRunPayments({ userText })
      const alphaSummaryCue = shouldShowPaymentSummary(userText)
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
        travelPlannerResult = runTravelPlanner({
          userText,
          memory,
          locale: memory.locale,
        })
      }

      // Sprint 76 — learn preferences from conversation even when tools do not run.
      if (isTravelerPersonalizationOn()) {
        travelerPersonalizationResult = runTravelerPersonalization({
          userId: input.conversationId,
          userText,
          memory,
        })
      }

      // Sprint 80 — adaptive learning (local preference adaptation) before Decision Engine.
      if (isAdaptiveLearningOn()) {
        adaptiveLearningResult = runAdaptiveLearningTurn({
          userId: input.conversationId,
          userText,
          enabled: options.adaptiveLearningEnabled,
        })
      }

      if (isBrainCoreEnabled()) {
        const brainTurn = runRahhalBrainTurn(
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
          memory = {
            ...memory,
            requirements: seedRequirementsFromPreferences(memory.requirements, {
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
            const selected = matchDestinationSelection(userText, catalogNames)
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
          reasoningResult = runTravelReasoning({
            locale: memory.locale,
            requirements: memory.requirements,
            userText,
          })
          memory = {
            ...memory,
            requirements: applyReasoningToRequirements(memory.requirements, reasoningResult),
          }
          reasoningMeta = toReasoningSnapshot(reasoningResult)
          learnPreferencesFromRequirements(memory.requirements, { userId: preferenceUserId })
        } else if (
          (isReasoningEnabled() || isPreferenceMemoryEnabled())
          && hasPlanningPatch(extracted.patch as Record<string, unknown>)
        ) {
          learnPreferencesFromRequirements(memory.requirements, { userId: preferenceUserId })
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
        memory = withTripPlan(memory, memory.tripPlan ?? memory.itinerary)
      }

      // Sprint 20–27 — every user message through Brain when flags are on.
      let brainMeta: BrainMetaSnapshot | undefined
      const travelEngineOn = isTravelEngineEnabled()
      const tripPlanningOn = isTripPlanningEnabled()
      const executionOn = isExecutionEnabled()
      const searchOn = isSearchEnabled()
      const orchestratorOn = isTripOrchestratorEnabled()
      if (isBrainEnabled() && userText.trim()) {
        let brainResult: BrainTurnResult | null = null

        if (orchestratorOn) {
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
        withBrainMeta(meta, brainMeta)

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
        const withBooking = bookingIntelligenceResult
          ? { ...withAutonomous, bookingIntelligence: toMetaBookingIntelligence(bookingIntelligenceResult) }
          : withAutonomous
        const withBudget = budgetIntelligenceResult
          ? { ...withBooking, budgetIntelligence: toMetaBudgetIntelligence(budgetIntelligenceResult) }
          : withBooking
        const withPersonalization = travelerPersonalizationResult
          ? {
            ...withBudget,
            travelerPersonalization: toMetaTravelerPersonalization(travelerPersonalizationResult),
          }
          : withBudget
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
        const latest = findLatestBookingRecord(records)
        const reply = buildSmartItineraryConciergeReply({
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
        const latest = findLatestBookingRecord(records)
        const customerId = getBookingHistoryUserId() ?? latest?.userId
        const order = latest
          ? findManagedOrderBySessionId(latest.sessionId)
          : null
        const reply = buildOrderConciergeReply(
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
        const latest = findLatestBookingRecord(records)
        const session = latest
          ? getBookingOrchestrator().getBookingSession(latest.sessionId)
          : null
        const confirmationState = session ? confirmationStateFromSession(session) : null
        const reply = buildConfirmationConciergeReply({
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
        const reply = buildBookingHistoryConciergeReply({
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

      let conciergeState: ConciergeState | null = rebuildConciergeStateFromMessages(
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
          let optionHints: string[] | undefined
          const decisionBrief = conciergeResult.decision.valueBrief
          if (decisionBrief && decisionBrief.length > 0) {
            optionHints = decisionBrief
          } else if (
            conciergeResult.decision.action === 'propose_options'
            || conciergeResult.decision.action === 'advise'
          ) {
            const recs = buildConciergeRecommendations({
              locale: memory.locale,
              requirements: memory.requirements,
              softSignals: conciergeResult.decision.state.softSignals,
            })
            optionHints = recs.optionLines
          }
          // Planning Draft — deterministic estimates for Conversation Brain (not TripPlan).
          const planningDraft = canBuildPlanningDraft(memory.requirements)
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
        const goal = upsertTravelGoal({
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
      conciergeIntegration = integrateConciergeIntoTurn({
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
        alphaTravelerAssembly = assembleAlphaTravelerExperience({
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
        bookingAssistantAssembly = assembleBookingAssistant({
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

      const constitutionPreview = applyConstitutionToTurn({
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
      const constitutionFinal = applyConstitutionToTurn({
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

  // Phase 2 Stage 2/3/4 + Phase 3 Stage 1 — optional enrichment layers.
  // Flags OFF → identical production behavior (no coordinator/pipeline import latency).
  const productionPlanTurn = service.planTurn.bind(service)
  service.planTurn = async (input) => {
    const result = await productionPlanTurn(input)
    const conversationForced = options.conversationOrchestratorEnabled
    const runtimeForced = options.runtimeCoordinatorEnabled
    const pipelineForced = options.consultantPipelineEnabled
    const responseForced = options.consultantResponseEnabled
    const conversationOn =
      conversationForced === true
      || (conversationForced !== false
        && getFeatureRegistry().isEnabled('ai.conversation_orchestrator'))
    const runtimeOn =
      runtimeForced === true
      || (runtimeForced !== false
        && getFeatureRegistry().isEnabled('ai.runtime_coordinator'))
    const pipelineOn =
      pipelineForced === true
      || (pipelineForced !== false
        && getFeatureRegistry().isEnabled('ai.consultant_pipeline'))
    const responseOn =
      responseForced === true
      || (responseForced !== false
        && getFeatureRegistry().isEnabled('ai.consultant_response'))

    const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
    const userText = lastUser?.content ?? ''

    // Phase 3 Stage 1 — Conversation Orchestrator (entry when ON; invokes Runtime Coordinator).
    if (conversationOn) {
      const { enrichTurnWithConversationOrchestrator } = await import('./conversation')
      return enrichTurnWithConversationOrchestrator(result, {
        userText,
        conversationId: input.conversationId,
        enabled: true,
        signal: input.signal,
      }) as Promise<TravelAgentTurnResult>
    }

    // Stage 4 — Runtime Coordinator path (preferred when ON; avoids duplicate work).
    if (runtimeOn) {
      const { enrichTurnWithRuntimeCoordinator } = await import('./orchestrator/runtime')
      return enrichTurnWithRuntimeCoordinator(result, {
        userText,
        conversationId: input.conversationId,
        enabled: true,
        signal: input.signal,
      }) as Promise<TravelAgentTurnResult>
    }

    if (!pipelineOn && !responseOn) return result

    const { finalizeConsultantTurnEnrichment } = await import('./orchestrator/consultantActivation')
    return finalizeConsultantTurnEnrichment(result, {
      userText,
      conversationId: input.conversationId,
      attachPipelineMeta: pipelineOn,
      attachResponseMeta: responseOn,
    })
  }

  return service
}

export const travelAgentService = createTravelAgentService()
