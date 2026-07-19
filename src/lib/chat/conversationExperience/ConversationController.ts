/**
 * Sprint 32 — ConversationController
 * Conversational UX layer that orchestrates UnifiedTravelPlanner + AITripOrchestrator.
 * Does NOT duplicate planning, booking, or provider logic.
 */

import {
  UnifiedTravelPlanner,
  type UnifiedTravelPlanResult,
  type UnifiedTravelPlannerHandle,
  type UnifiedTravelPlannerOptions,
} from '../../brain/unifiedTravel'
import {
  appendMessage,
  createConversationMessage,
  createConversationSession,
  updateSessionState,
} from './ConversationSession'
import {
  applyCommandToState,
  applyUserTextToState,
  detectConversationCommand,
} from './ConversationState'
import {
  ConversationEvents,
  createConversationEvent,
} from './ConversationEvents'
import { FollowUpQuestionEngine, createFollowUpQuestionEngine } from './FollowUpQuestionEngine'
import { ResponseComposer, createResponseComposer } from './ResponseComposer'
import { ConversationRenderer, createConversationRenderer } from './ConversationRenderer'
import { StreamingResponse } from './StreamingResponse'
import { isConversationUiEnabled } from './feature'
import { buildPayNowOffer, shouldOfferPayNow } from '../../payments/conversation/payNowPrompt'
import {
  answerTripQuery,
  getPostBookingService,
  shouldHandleTripQueries,
  type PostBookingService,
} from '../../trips'
import {
  answerRefundQuery,
  createPolicyEngine,
  linesFromPlan,
  shouldHandleRefundQueries,
  type PolicyEngine,
  type RefundConversationQueryKind,
} from '../../refunds'
import {
  answerDisruptionQuery,
  createTravelDisruptionEngine,
  shouldHandleDisruptionQueries,
  type DisruptionConversationQueryKind,
  type TravelDisruptionEngine,
} from '../../disruption'
import {
  answerLoyaltyQuery,
  createLoyaltyPlatform,
  shouldHandleLoyaltyQueries,
  type LoyaltyConversationQueryKind,
  type LoyaltyPlatform,
} from '../../loyalty'
import {
  answerDocumentQuery,
  createTravelDocumentsPlatform,
  shouldHandleDocumentQueries,
  type DocumentConversationQueryKind,
  type TravelDocumentsPlatform,
} from '../../travelDocuments'
import {
  answerSupplierQuery,
  createSupplierMarketplace,
  shouldHandleSupplierQueries,
  type SupplierConversationQueryKind,
  type SupplierMarketplace,
} from '../../suppliers'
import type {
  ConversationSession,
  ConversationTurnInput,
  ConversationTurnResult,
  ConversationPhase,
} from './types'
import type { ChatStreamChunk } from '../chatTypes'

export type ConversationControllerOptions = {
  /** Override FeatureRegistry for this instance. */
  enabled?: boolean
  /** Inject UnifiedTravelPlanner (tests). */
  planner?: UnifiedTravelPlannerHandle
  /** Sprint 35 post-booking service (tests). */
  postBookingService?: PostBookingService
  /** Sprint 36 policy engine (tests). */
  policyEngine?: PolicyEngine
  /** Sprint 37 travel disruption engine (tests). */
  disruptionEngine?: TravelDisruptionEngine
  /** Sprint 38 loyalty platform (tests). */
  loyaltyPlatform?: LoyaltyPlatform
  /** Sprint 39 travel documents platform (tests). */
  travelDocumentsPlatform?: TravelDocumentsPlatform
  /** Sprint 40 supplier marketplace (tests). */
  supplierMarketplace?: SupplierMarketplace
  plannerOptions?: UnifiedTravelPlannerOptions
  events?: ConversationEvents
  followUps?: FollowUpQuestionEngine
  composer?: ResponseComposer
  renderer?: ConversationRenderer
  /** Prefer skipping nested orchestrator when planner already injects one. */
  skipPlannerOrchestrator?: boolean
}

export type ConversationControllerHandle = {
  handleTurn(input: ConversationTurnInput): Promise<ConversationTurnResult>
  streamTurn(input: ConversationTurnInput): AsyncGenerator<ChatStreamChunk>
  getSession(conversationId: string): ConversationSession | null
  listSessions(): ConversationSession[]
  reset(conversationId?: string): void
  events: ConversationEvents
  isEnabled(): boolean
}

export function ConversationController(
  options: ConversationControllerOptions = {},
): ConversationControllerHandle {
  const events = options.events ?? new ConversationEvents()
  const followUps = options.followUps ?? createFollowUpQuestionEngine()
  const composer = options.composer ?? createResponseComposer()
  const renderer = options.renderer ?? createConversationRenderer()
  const streaming = new StreamingResponse({ delayMs: 0 })
  const sessions = new Map<string, ConversationSession>()

  const planner =
    options.planner
    ?? UnifiedTravelPlanner({
      enabled: true,
      skipOrchestrator: options.skipPlannerOrchestrator === true,
      ...options.plannerOptions,
    })
  const postBookingService = options.postBookingService ?? getPostBookingService()
  const policyEngine = options.policyEngine ?? createPolicyEngine({ enabled: true })
  const disruptionEngine =
    options.disruptionEngine
    ?? createTravelDisruptionEngine({
      enabled: true,
      postBooking: postBookingService,
      notifications: postBookingService.getNotificationScheduler(),
    })
  const loyaltyPlatform =
    options.loyaltyPlatform ?? createLoyaltyPlatform({ enabled: true })
  const travelDocumentsPlatform =
    options.travelDocumentsPlatform
    ?? createTravelDocumentsPlatform({ enabled: true })
  const supplierMarketplace =
    options.supplierMarketplace ?? createSupplierMarketplace({ enabled: true })

  function enabled(): boolean {
    if (typeof options.enabled === 'boolean') return options.enabled
    return isConversationUiEnabled()
  }

  function getOrCreateSession(conversationId: string, locale: 'ar' | 'en'): ConversationSession {
    const existing = sessions.get(conversationId)
    if (existing) return existing
    const session = createConversationSession({ conversationId, locale })
    sessions.set(conversationId, session)
    events.emit(createConversationEvent('session_started', conversationId, { sessionId: session.id }))
    return session
  }

  async function runTurn(input: ConversationTurnInput): Promise<ConversationTurnResult> {
    const started = Date.now()
    const locale = input.locale === 'ar' ? 'ar' : 'en'

    if (!enabled()) {
      const session = getOrCreateSession(input.conversationId, locale)
      const userMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'user',
        content: input.userText,
      })
      const structured = composer.compose({
        planResult: null,
        phase: 'error',
        locale,
        clarificationQuestion:
          'Conversation UI is disabled (brain.conversation_ui is OFF).',
      })
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: false },
      })
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: null,
        commandKind: 'unknown',
        durationMs: Date.now() - started,
      }
    }

    events.emit(createConversationEvent('turn_started', input.conversationId, {
      userText: input.userText,
    }))

    let session = getOrCreateSession(input.conversationId, locale)
    let state = applyUserTextToState(
      { ...session.state, locale },
      input.userText,
    )

    const commandKind = state.pendingFollowUpField
      ? 'clarify_answer'
      : detectConversationCommand(input.userText)

    events.emit(createConversationEvent('command_detected', input.conversationId, {
      commandKind,
    }))

    state = applyCommandToState(state, commandKind)

    // Numeric traveler answers for pending follow-up.
    if (commandKind === 'clarify_answer' || state.pendingFollowUpField === 'travelers') {
      const travelers = parseTravelers(input.userText)
      if (travelers) {
        state = {
          ...state,
          context: {
            ...state.context,
            adults: travelers.adults,
            children: travelers.children,
          },
          travelersConfirmed: true,
          pendingFollowUpField: null,
        }
      }
    }

    const userMessage = createConversationMessage({
      conversationId: input.conversationId,
      role: 'user',
      content: input.userText,
      commandKind,
    })
    session = appendMessage(session, userMessage)

    // Ask follow-up only when absolutely required (destination / travelers).
    // Skip for post-booking / policy / disruption commands — those do not need a new plan.
    const skipClarifyingForCommand =
      commandKind === 'compare_options'
      || commandKind === 'pay_now'
      || commandKind === 'my_trip'
      || commandKind === 'show_itinerary'
      || commandKind === 'download_ticket'
      || commandKind === 'any_delays'
      || commandKind === 'what_hotel'
      || commandKind === 'cancel_refund_quote'
      || commandKind === 'cancel_hotel_only'
      || commandKind === 'flight_delay_policy'
      || commandKind === 'deposit_refund'
      || commandKind === 'cancel_after_checkin'
      || commandKind === 'airline_cancels'
      || commandKind === 'one_traveler_cancels'
      || commandKind === 'flight_delayed'
      || commandKind === 'flight_cancelled'
      || commandKind === 'missed_connection'
      || commandKind === 'hotel_cancelled'
      || commandKind === 'gate_changed'
      || commandKind === 'schedule_changed'
      || commandKind === 'car_unavailable'
      || commandKind === 'activity_cancelled'
      || commandKind === 'airport_closure'
      || commandKind === 'weather_disruption'
      || commandKind === 'strike'
      || commandKind === 'visa_rejection'
      || commandKind === 'border_restriction'
      || commandKind === 'use_rahhal_points'
      || commandKind === 'most_rewards_hotel'
      || commandKind === 'upgrade_with_points'
      || commandKind === 'points_earn_estimate'
      || commandKind === 'wallet_balance'
      || commandKind === 'membership_benefits'
      || commandKind === 'can_travel_to'
      || commandKind === 'need_visa'
      || commandKind === 'passport_expiry'
      || commandKind === 'transit_visa'
      || commandKind === 'what_documents'
      || commandKind === 'vaccination_requirements'
      || commandKind === 'trusted_suppliers_only'
      || commandKind === 'premium_hotel_providers'
      || commandKind === 'avoid_poor_refunds'
      || commandKind === 'fastest_confirmation'
      || commandKind === 'rank_suppliers'

    if (followUps.shouldAskBeforePlanning(state) && !skipClarifyingForCommand) {
      const question = followUps.nextQuestion(state)
      const phase: ConversationPhase = 'clarifying'
      state = {
        ...state,
        phase,
        pendingFollowUpField: question?.field ?? 'destination',
      }
      events.emit(createConversationEvent('follow_up', input.conversationId, {
        field: question?.field,
        question: question?.question,
      }))

      const structured = composer.compose({
        planResult: null,
        phase,
        locale,
        clarificationQuestion: question?.question ?? state.pendingFollowUpField,
      })
      structured.followUps = question ? [question] : []
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, clarifying: true },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)

      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: null,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Compare without re-planning when we already have options.
    if (commandKind === 'compare_options' && state.lastPlanResult?.plans.length) {
      state = { ...state, phase: 'comparing', compareMode: true }
      const structured = composer.compose({
        planResult: state.lastPlanResult,
        phase: 'comparing',
        locale,
        compareMode: true,
      })
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, compare: true },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      events.emit(createConversationEvent('response_composed', input.conversationId, {
        compare: true,
      }))
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: state.lastPlanResult,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Sprint 35 — trip queries (My Trip / itinerary / ticket / delays / hotel).
    const tripQueryKinds = new Set([
      'my_trip',
      'show_itinerary',
      'download_ticket',
      'any_delays',
      'what_hotel',
    ])
    if (
      tripQueryKinds.has(commandKind)
      && shouldHandleTripQueries()
    ) {
      const reply = answerTripQuery({
        kind: commandKind as 'my_trip' | 'show_itinerary' | 'download_ticket' | 'any_delays' | 'what_hotel',
        service: postBookingService,
        userId: input.userId ?? 'anonymous',
        locale,
      })
      state = { ...state, phase: 'presenting' }
      const structured = composer.compose({
        planResult: state.lastPlanResult,
        phase: 'presenting',
        locale,
        clarificationQuestion: reply,
      })
      structured.summary = reply
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, tripManagement: true, tripQuery: commandKind },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      events.emit(createConversationEvent('response_composed', input.conversationId, {
        tripQuery: commandKind,
      }))
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: state.lastPlanResult,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Sprint 40 — supplier marketplace preferences.
    const supplierQueryKinds = new Set<SupplierConversationQueryKind>([
      'trusted_suppliers_only',
      'premium_hotel_providers',
      'avoid_poor_refunds',
      'fastest_confirmation',
      'rank_suppliers',
    ])
    if (
      supplierQueryKinds.has(commandKind as SupplierConversationQueryKind)
      && shouldHandleSupplierQueries()
    ) {
      const reply = answerSupplierQuery({
        kind: commandKind as SupplierConversationQueryKind,
        marketplace: supplierMarketplace,
        locale,
      })
      state = { ...state, phase: 'presenting' }
      const structured = composer.compose({
        planResult: state.lastPlanResult,
        phase: 'presenting',
        locale,
        clarificationQuestion: reply,
      })
      structured.summary = reply
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, supplierMarketplace: true, supplierQuery: commandKind },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      events.emit(createConversationEvent('response_composed', input.conversationId, {
        supplierQuery: commandKind,
      }))
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: state.lastPlanResult,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Sprint 39 — travel documents / visa intelligence.
    const documentQueryKinds = new Set<DocumentConversationQueryKind>([
      'can_travel_to',
      'need_visa',
      'passport_expiry',
      'transit_visa',
      'what_documents',
      'vaccination_requirements',
    ])
    if (
      documentQueryKinds.has(commandKind as DocumentConversationQueryKind)
      && shouldHandleDocumentQueries()
    ) {
      const top = state.lastPlanResult?.topPlan
      const reply = answerDocumentQuery({
        kind: commandKind as DocumentConversationQueryKind,
        platform: travelDocumentsPlatform,
        userId: input.userId ?? 'anonymous',
        userText: input.userText,
        locale,
        nationality: 'SA',
        defaults: {
          destination: top?.flight?.to ?? undefined,
          tripDurationDays: top?.hotel?.nights ?? 7,
          hasTravelInsurance: true,
          blankPages: 3,
          machineReadable: true,
        },
      })
      state = { ...state, phase: 'presenting' }
      const structured = composer.compose({
        planResult: state.lastPlanResult,
        phase: 'presenting',
        locale,
        clarificationQuestion: reply,
      })
      structured.summary = reply
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, travelDocuments: true, documentQuery: commandKind },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      events.emit(createConversationEvent('response_composed', input.conversationId, {
        documentQuery: commandKind,
      }))
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: state.lastPlanResult,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Sprint 38 — loyalty / rewards / membership (LoyaltyPlatform).
    const loyaltyQueryKinds = new Set<LoyaltyConversationQueryKind>([
      'use_rahhal_points',
      'most_rewards_hotel',
      'upgrade_with_points',
      'points_earn_estimate',
      'wallet_balance',
      'membership_benefits',
    ])
    if (
      loyaltyQueryKinds.has(commandKind as LoyaltyConversationQueryKind)
      && shouldHandleLoyaltyQueries()
    ) {
      const userId = input.userId ?? 'anonymous'
      const top = state.lastPlanResult?.topPlan
      const estimateAmount = top?.cost.total ?? 2000
      const reply = answerLoyaltyQuery({
        kind: commandKind as LoyaltyConversationQueryKind,
        platform: loyaltyPlatform,
        userId,
        locale,
        estimateAmount,
        estimateService: top?.hotel ? 'hotel' : top?.flight ? 'flight' : 'hotel',
        context: {
          conversationNotes: [`User: ${input.userText}`],
          preferredHotels: top?.hotel?.name ? [top.hotel.name] : undefined,
          preferredAirlines: top?.flight?.airline ? [top.flight.airline] : undefined,
        },
      })
      state = { ...state, phase: 'presenting' }
      const structured = composer.compose({
        planResult: state.lastPlanResult,
        phase: 'presenting',
        locale,
        clarificationQuestion: reply,
      })
      structured.summary = reply
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, loyaltyPlatform: true, loyaltyQuery: commandKind },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      events.emit(createConversationEvent('response_composed', input.conversationId, {
        loyaltyQuery: commandKind,
      }))
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: state.lastPlanResult,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Sprint 37 — travel disruption recovery (TravelDisruptionEngine).
    const disruptionQueryKinds = new Set<DisruptionConversationQueryKind>([
      'flight_delayed',
      'flight_cancelled',
      'missed_connection',
      'hotel_cancelled',
      'gate_changed',
      'schedule_changed',
      'car_unavailable',
      'activity_cancelled',
      'airport_closure',
      'weather_disruption',
      'strike',
      'visa_rejection',
      'border_restriction',
    ])
    if (
      disruptionQueryKinds.has(commandKind as DisruptionConversationQueryKind)
      && shouldHandleDisruptionQueries()
    ) {
      const trip = postBookingService.listUserTrips(input.userId ?? 'anonymous')[0]
      const top = state.lastPlanResult?.topPlan
      const currency = trip?.currency ?? top?.cost.currency ?? 'SAR'
      const delayMatch = input.userText.match(/delayed by\s+(\d+)\s*(hours?|hrs?|minutes?|mins?)?/i)
      let delayMinutes: number | undefined
      if (delayMatch) {
        const n = Number(delayMatch[1])
        const unit = (delayMatch[2] ?? 'hours').toLowerCase()
        delayMinutes = /min/.test(unit) ? n : n * 60
      }
      const reply = answerDisruptionQuery({
        kind: commandKind as DisruptionConversationQueryKind,
        engine: disruptionEngine,
        context: {
          tripId: trip?.tripId ?? 'trip_conversation',
          userId: input.userId ?? 'anonymous',
          conversationId: input.conversationId,
          destination:
            trip?.destination
            ?? top?.flight?.to
            ?? state.lastPlanResult?.headline
            ?? 'destination',
          origin: trip?.origin ?? top?.flight?.from ?? null,
          currency,
          hotelName: trip?.hotelName ?? top?.hotel?.name ?? null,
          flightConfirmation: trip?.references.flightConfirmation ?? null,
          hotelConfirmation: trip?.references.hotelConfirmation ?? null,
          startDate: trip?.documents.itinerary?.startDate ?? null,
          endDate: trip?.documents.itinerary?.endDate ?? null,
          cabinClass: top?.flight?.cabin ?? 'economy',
          hotelStars: top?.hotel?.stars ?? 4,
          conversationNotes: [`User: ${input.userText}`],
          currentDelayMinutes: delayMinutes,
        },
        delayMinutes,
        locale,
      })
      state = { ...state, phase: 'presenting' }
      const structured = composer.compose({
        planResult: state.lastPlanResult,
        phase: 'presenting',
        locale,
        clarificationQuestion: reply,
      })
      structured.summary = reply
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, travelDisruption: true, disruptionQuery: commandKind },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      events.emit(createConversationEvent('response_composed', input.conversationId, {
        disruptionQuery: commandKind,
      }))
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: state.lastPlanResult,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Sprint 36 — cancellation / refund policy questions (PolicyEngine quotes).
    const refundQueryKinds = new Set<RefundConversationQueryKind>([
      'cancel_refund_quote',
      'cancel_hotel_only',
      'flight_delay_policy',
      'deposit_refund',
      'cancel_after_checkin',
      'airline_cancels',
      'one_traveler_cancels',
    ])
    if (
      refundQueryKinds.has(commandKind as RefundConversationQueryKind)
      && shouldHandleRefundQueries()
    ) {
      const trip = postBookingService.listUserTrips(input.userId ?? 'anonymous')[0]
      const currency =
        trip?.currency
        ?? state.lastPlanResult?.topPlan?.cost.currency
        ?? 'SAR'
      const reply = answerRefundQuery({
        kind: commandKind as RefundConversationQueryKind,
        engine: policyEngine,
        tripId: trip?.tripId ?? 'trip_conversation',
        userId: input.userId ?? 'anonymous',
        lines: linesFromPlan(state.lastPlanResult?.topPlan, currency),
        currency,
        platformFee: 40,
        locale,
      })
      state = { ...state, phase: 'presenting' }
      const structured = composer.compose({
        planResult: state.lastPlanResult,
        phase: 'presenting',
        locale,
        clarificationQuestion: reply,
      })
      structured.summary = reply
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, refundPolicy: true, refundQuery: commandKind },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      events.emit(createConversationEvent('response_composed', input.conversationId, {
        refundQuery: commandKind,
      }))
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: state.lastPlanResult,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Sprint 34 — pay now handoff (no re-planning; uses existing plan totals only).
    const payNowPlan = state.lastPlanResult
    const payNowTop = payNowPlan?.topPlan ?? null
    if (commandKind === 'pay_now' && payNowPlan && payNowTop) {
      state = { ...state, phase: 'presenting' }
      const offer = buildPayNowOffer({
        total: payNowTop.cost.total,
        currency: payNowTop.cost.currency,
        locale,
      })
      const structured = composer.compose({
        planResult: payNowPlan,
        phase: 'presenting',
        locale,
      })
      // Reinforce explicit pay confirmation copy even if payments flag is off mid-turn.
      structured.summary = shouldOfferPayNow()
        ? `${offer.summaryLine}\n\n${offer.questionLine}\n\n${
          locale === 'ar'
            ? 'سأجهّز الدفع الآمن لرحلتك.'
            : 'I will prepare secure checkout for your trip.'
        }`
        : structured.summary
      if (!structured.suggestedFollowUpActions.some((a) => a.id === 'pay_now')) {
        structured.suggestedFollowUpActions.unshift(offer.suggestedAction)
      }
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: {
          conversationUi: true,
          payNow: true,
          paymentsPlatform: shouldOfferPayNow(),
          estimatedTotal: payNowTop.cost.total,
          currency: payNowTop.cost.currency,
        },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      events.emit(createConversationEvent('response_composed', input.conversationId, {
        payNow: true,
      }))
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: payNowPlan,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    // Plan / regenerate / edit via UnifiedTravelPlanner (reuses orchestrator internally).
    state = { ...state, phase: 'planning' }
    events.emit(createConversationEvent('planning_started', input.conversationId, {
      editCount: state.editCount,
    }))

    let planResult: UnifiedTravelPlanResult
    try {
      planResult = await planner.planTrip({
        conversationId: input.conversationId,
        userText: input.userText,
        locale,
        userId: input.userId,
        signal: input.signal,
        contextOverrides: state.context,
      })
    } catch (error) {
      events.emit(createConversationEvent('error', input.conversationId, {
        message: error instanceof Error ? error.message : 'planning_failed',
      }))
      state = { ...state, phase: 'error' }
      const structured = composer.compose({
        planResult: null,
        phase: 'error',
        locale,
        clarificationQuestion:
          locale === 'ar'
            ? 'تعذر إكمال التخطيط. حاول مرة أخرى.'
            : 'Could not complete planning. Please try again.',
      })
      const renderedText = renderer.render(structured, locale)
      const assistantMessage = createConversationMessage({
        conversationId: input.conversationId,
        role: 'assistant',
        content: renderedText,
        structured,
        meta: { conversationUi: true, error: true },
      })
      session = appendMessage(updateSessionState(session, state), assistantMessage)
      sessions.set(input.conversationId, session)
      return {
        session,
        userMessage,
        assistantMessage,
        structured,
        renderedText,
        planResult: null,
        commandKind,
        durationMs: Date.now() - started,
      }
    }

    events.emit(createConversationEvent('planning_completed', input.conversationId, {
      stage: planResult.stage,
      plans: planResult.plans.length,
    }))

    // Planner may still ask for destination.
    if (planResult.stage === 'clarifying') {
      state = {
        ...state,
        phase: 'clarifying',
        pendingFollowUpField: planResult.followUps[0]?.field ?? 'destination',
        lastPlanResult: planResult,
      }
    } else {
      state = {
        ...state,
        phase: state.compareMode ? 'comparing' : 'presenting',
        pendingFollowUpField: null,
        lastPlanResult: planResult,
        // Merge planner-enriched context hints from successful plans.
        context: {
          ...state.context,
          destination: state.context.destination || planResult.topPlan?.flight?.to || state.context.destination,
          origin: state.context.origin || planResult.topPlan?.flight?.from || state.context.origin,
        },
      }
    }

    const structured = composer.compose({
      planResult,
      phase: state.phase,
      locale,
      compareMode: state.compareMode || commandKind === 'compare_options',
      clarificationQuestion:
        planResult.stage === 'clarifying'
          ? planResult.followUps[0]?.question ?? planResult.headline
          : null,
    })

    events.emit(createConversationEvent('response_composed', input.conversationId, {
      confidence: structured.confidenceScore,
      topPlanId: structured.topPlanId,
    }))

    const renderedText = renderer.render(structured, locale)
    const assistantMessage = createConversationMessage({
      conversationId: input.conversationId,
      role: 'assistant',
      content: renderedText,
      structured,
      meta: {
        conversationUi: true,
        plannerStage: planResult.stage,
        confidenceScore: planResult.confidenceScore,
        orchestrator: planResult.orchestrator,
        memory: planResult.memory,
      },
    })

    session = appendMessage(updateSessionState(session, state), assistantMessage)
    sessions.set(input.conversationId, session)

    events.emit(createConversationEvent('turn_completed', input.conversationId, {
      durationMs: Date.now() - started,
      phase: state.phase,
    }))

    return {
      session,
      userMessage,
      assistantMessage,
      structured,
      renderedText,
      planResult,
      commandKind,
      durationMs: Date.now() - started,
    }
  }

  return {
    events,
    isEnabled: enabled,

    handleTurn: runTurn,

    async *streamTurn(input: ConversationTurnInput): AsyncGenerator<ChatStreamChunk> {
      const result = await runTurn(input)
      yield* streaming.stream(result.renderedText, result.structured, {
        signal: input.signal,
        delayMs: 0,
        meta: {
          conversationUi: enabled(),
          commandKind: result.commandKind,
          phase: result.session.state.phase,
          planResult: result.planResult
            ? {
              stage: result.planResult.stage,
              confidenceScore: result.planResult.confidenceScore,
              topPlanId: result.planResult.topPlan?.id ?? null,
            }
            : null,
        },
        onDelta: (text) => {
          events.emit(createConversationEvent('stream_delta', input.conversationId, { text }))
        },
      })
      events.emit(createConversationEvent('stream_done', input.conversationId, {
        messageId: result.assistantMessage.id,
      }))
    },

    getSession(conversationId: string) {
      return sessions.get(conversationId) ?? null
    },

    listSessions() {
      return [...sessions.values()]
    },

    reset(conversationId?: string) {
      if (conversationId) {
        sessions.delete(conversationId)
        return
      }
      sessions.clear()
      events.clear()
    },
  }
}

let sharedController: ConversationControllerHandle | null = null

export function getOrCreateConversationController(
  options?: ConversationControllerOptions,
): ConversationControllerHandle {
  if (!sharedController) {
    sharedController = ConversationController(options)
  }
  return sharedController
}

export function resetConversationController(): void {
  sharedController?.reset()
  sharedController = null
}

function parseTravelers(text: string): { adults: number; children: number } | null {
  const lower = text.toLowerCase().trim()
  if (/^(just )?(me|myself|solo)$/.test(lower) || /^one(\s+adult)?$/.test(lower)) {
    return { adults: 1, children: 0 }
  }
  if (/^two(\s+adults?)?$/.test(lower)) return { adults: 2, children: 0 }
  if (/^three(\s+adults?)?$/.test(lower)) return { adults: 3, children: 0 }
  if (/^four(\s+adults?)?$/.test(lower)) return { adults: 4, children: 0 }

  const adultsMatch = lower.match(/(\d+)\s*adults?/)
  const childrenMatch = lower.match(/(\d+)\s*(children|kids|child)/)
  const bare = lower.match(/^(\d+)\s*(travelers?|people|persons?)?$/)
  if (adultsMatch || childrenMatch) {
    return {
      adults: adultsMatch ? Number(adultsMatch[1]) : 2,
      children: childrenMatch ? Number(childrenMatch[1]) : 0,
    }
  }
  if (bare) {
    return { adults: Math.max(1, Number(bare[1])), children: 0 }
  }
  return null
}
