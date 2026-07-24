import type { ChatMessage } from '../../chat/chatTypes'
import { runConversationBrain, type ConversationObjective, type TravelFacts } from '../conversationBrain'
import { assertTurnNotAborted } from './abortCheckpoint'
import { goalFromMeta, type AutonomousAgentSnapshot } from '../autonomous'
import type {
  AgentIntent,
  AgentProviderMeta,
  AgentToolRunSummary,
} from '../types'
import type { AgentLlmRegistry } from '../llm/types'
import type { AgentToolResult, ToolExecutionBatch } from '../tools/types'
import type { RahhalBrainMetaSnapshot, RahhalBrainTurnResult } from '../../brain/core'
import type { BookingIntelligenceResult } from '../bookingIntelligence'
import type { BudgetIntelligenceResult } from '../budgetIntelligence'
import type { TravelerPersonalizationResult } from '../travelerPersonalization'
import type { TripOptimizerResult } from '../tripOptimizer'
import type { TravelPlannerResult } from '../travelPlanner'
import type { AutonomousDecisionResult } from '../autonomousDecision'
import type { AdaptiveLearningResult } from '../adaptiveLearning'
import type { BookingTimingResult } from '../priceIntelligence'
import type { PackageBuilderResult } from '../packageBuilder'
import type { RefinementResult } from '../itineraryRefinement'
import type { BookingExecutionResult } from '../bookingExecution'
import type { PaymentsPlatformResult } from '../paymentsPlatform'
import type { ConciergeState } from '../../concierge'

export const BOOKING_HISTORY_INTENTS = new Set<AgentIntent>([
  'show_trips',
  'show_latest_booking',
  'show_booking_details',
  'summarize_itinerary',
])

export const CONFIRMATION_INTENTS = new Set<AgentIntent>([
  'booking_confirmed',
  'show_confirmation',
  'booking_reference',
  'booking_status',
])

export const ORDER_PAYMENT_INTENTS = new Set<AgentIntent>([
  'how_much_will_i_pay',
  'is_order_ready',
  'show_checkout',
  'what_is_payment_status',
])

export const SMART_ITINERARY_INTENTS = new Set<AgentIntent>([
  'show_my_itinerary',
  'whats_todays_plan',
  'when_leave_for_airport',
  'summarize_my_trip',
])

export function hasPlanningPatch(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).some((key) => {
    if (key === 'regenerateDay') return false
    const value = patch[key]
    if (Array.isArray(value)) return value.length > 0
    return value != null && value !== ''
  })
}

export function toMetaConcierge(state: ConciergeState): NonNullable<AgentProviderMeta['concierge']> {
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

export function toMetaTravelExecutive(
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

export function toMetaExecutivePlatform(
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

export function toMetaExecutiveOs(
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

export function toMetaLiveIntelligence(
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

export function toMetaRahhalBrain(
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

export function toMetaAutonomous(
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

export function toMetaBookingIntelligence(
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

export function toMetaBudgetIntelligence(
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

export function toMetaTravelerPersonalization(
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

export function toMetaTripOptimizer(
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

export function toMetaTravelPlanner(
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

export function toMetaAutonomousDecision(
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

export function toMetaAdaptiveLearning(
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

export function toMetaPriceIntelligence(
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

export function toMetaDynamicPackages(
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

export function toMetaItineraryRefinement(
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

export function offersFromToolBatch(batch: ToolExecutionBatch | undefined): {
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

export function toMetaBookingExecution(
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

export function toMetaPayments(
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

export function priorAutonomousFromMessages(messages: ChatMessage[]): AutonomousAgentSnapshot | null {
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

export function toToolSummaries(results: AgentToolResult[]): AgentToolRunSummary[] {
  return results.map((result) => ({
    tool: result.tool,
    status: result.status,
    summary: result.summary,
    providerId: result.meta?.providerId,
    durationMs: result.meta?.durationMs,
  }))
}

export async function speakTravelFacts(input: {
  llms: AgentLlmRegistry
  conversationId: string
  messages: ChatMessage[]
  facts: TravelFacts
  signal?: AbortSignal
}): Promise<{ displayText: string; spokenText: string; providerId: string }> {
  assertTurnNotAborted(input.signal)
  return runConversationBrain(input)
}

export function mapConciergeObjective(action: string): ConversationObjective {
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
