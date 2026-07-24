/**
 * Single orchestration layer for Travel AI Agent planning.
 * Chat (text + voice) and Saved Trips integrate through this service only.
 */

import type { ChatMessage } from '../chat/chatTypes'
import { getFeatureRegistry } from '../ai'
import {
  createConciergeService,
  type ConciergeService,
} from '../concierge'
import { applyTripPlanEdits, buildTripPlan, regenerateTripDay } from './buildItinerary'
import { applyIntelligentDecisions } from './decision'
import { createAgentLlmRegistry } from './llm/factory'
import type { AgentLlmRegistry } from './llm/types'
import { saveGeneratedItinerary } from './itineraryPersistence'
import { createToolExecutor } from './tools/executor'
import { mergeToolResultsIntoPlan } from './tools/mergeToolResults'
import { selectToolsForTurn } from './tools/selectTools'
import { createDefaultAgentToolRegistry } from './tools/stubs'
import type { AgentToolRegistry, ToolExecutionBatch } from './tools/types'
import {
  isAutonomousAgentEnabled,
  runAutonomousTurn,
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
} from './travelPlanner'
import {
  enrichWithAutonomousDecision,
  isAutonomousDecisionEnabled,
  type AutonomousDecisionResult,
} from './autonomousDecision'
import {
  getLearnedProfile,
  isAdaptiveLearningEnabled,
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
import type {
  AgentMemory,
  AgentProviderMeta,
  RegenerateScope,
  TripPlan,
  TripRequirements,
} from './types'
import {
  getBookingHistoryUserId,
  loadUserBookingRecords,
  type BookingRecord,
} from '../booking'
import {
  isBrainAgentHandoffEnabled,
  isBrainConciergeIntegrationEnabled,
  isBrainExecutionEnabled,
  isBrainSearchEnabled,
  isBrainTravelEngineEnabled,
  isBrainTripOrchestratorEnabled,
  isBrainTripPlanningEnabled,
} from '../brain/integration'
import { isRahhalBrainEnabled } from '../brain/core'
import { isBookingFlowEnabled } from '../bookingFlow'
import { isTravelReasoningEnabled } from './reasoning'
import { runPlanTurn } from './planTurn/runPlanTurn'
import type { RunToolsForPlanInput, RunToolsForPlanResult } from './planTurn/context'
import { offersFromToolBatch } from './planTurn/helpers'

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

  const runToolsForPlan = async (input: RunToolsForPlanInput): Promise<RunToolsForPlanResult> => {
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
      return runPlanTurn(input, {
        options,
        llms,
        savePlanHook,
        conciergeService,
        listBookingRecords,
        runToolsForPlan,
        isConciergeEnabled,
        isBookingHistoryEnabled,
        isBookingConfirmationEnabled,
        isOrderManagementEnabled,
        isSmartItineraryEnabled,
        isBrainEnabled,
        isBrainHandoffEnabled,
        isTravelEngineEnabled,
        isTripPlanningEnabled,
        isExecutionEnabled,
        isSearchEnabled,
        isTripOrchestratorEnabled,
        isReasoningEnabled,
        isClarificationEnabled,
        isBrainCoreEnabled,
        isAutonomousEnabled,
        isTravelerPersonalizationOn,
        isTravelPlannerOn,
        isAdaptiveLearningOn,
        isFlowEnabled,
      })
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

export const travelAgentService = createTravelAgentService()
