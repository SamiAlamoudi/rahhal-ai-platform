/**
 * Sprint 42 — Conversation booking bridge.
 * Orchestrates existing Sprint 33/34/35 engines from chat actions — no new engines.
 */

import type { UnifiedTravelPlanOption } from '../../brain/unifiedTravel/types'
import {
  createTravelExecutionEngine,
  type ExecutionResult,
  type BookingSessionRecord,
} from '../../execution'
import {
  createPaymentOrchestrator,
  type PaymentResult,
  type PlatformPaymentSession,
  type PlatformPaymentMethod,
} from '../../payments'
import {
  createPostBookingService,
  type PostBookingTripRecord,
} from '../../trips'
import { isTravelExecutionEngineEnabled } from '../../execution/ExecutionFeatureFlags'
import { isPaymentsPlatformEnabled } from '../../payments/PaymentFeatureFlags'
import { isTripManagementEnabled } from '../../trips/TripFeatureFlags'

export type ConversationBookingAction =
  | 'reserve'
  | 'pay'
  | 'cancel'
  | 'refund'
  | 'view_documents'
  | 'open_trip'

export interface ConversationBookingContext {
  conversationId: string
  userId?: string
  locale?: 'ar' | 'en'
  selectedItinerary: UnifiedTravelPlanOption
  travelers?: { adults?: number; children?: number; infants?: number }
}

export interface ConversationBookingState {
  execution: ExecutionResult | null
  paymentSession: PlatformPaymentSession | null
  paymentResult: PaymentResult | null
  trip: PostBookingTripRecord | null
  lastAction: ConversationBookingAction | null
  message: string
}

export interface ConversationBookingBridge {
  reserve(ctx: ConversationBookingContext): Promise<ConversationBookingState>
  pay(state: ConversationBookingState, method?: PlatformPaymentMethod): Promise<ConversationBookingState>
  cancel(state: ConversationBookingState, reason?: string): Promise<ConversationBookingState>
  refund(state: ConversationBookingState): Promise<ConversationBookingState>
  viewDocuments(state: ConversationBookingState): { documents: Array<{ label: string; uri: string }> }
  openTrip(state: ConversationBookingState): PostBookingTripRecord | null
  getExecutionSession(sessionId: string): BookingSessionRecord | null
}

function emptyState(message: string, lastAction: ConversationBookingAction | null = null): ConversationBookingState {
  return {
    execution: null,
    paymentSession: null,
    paymentResult: null,
    trip: null,
    lastAction,
    message,
  }
}

export function createConversationBookingBridge(options?: {
  executionEnabled?: boolean
  paymentsEnabled?: boolean
  tripsEnabled?: boolean
}): ConversationBookingBridge {
  const executionEnabled = options?.executionEnabled
  const paymentsEnabled = options?.paymentsEnabled
  const tripsEnabled = options?.tripsEnabled

  const execution = createTravelExecutionEngine({
    enabled: executionEnabled,
  })
  const payments = createPaymentOrchestrator({
    enabled: paymentsEnabled,
  })
  const trips = createPostBookingService({
    enabled: tripsEnabled,
  })

  const execOn = () =>
    typeof executionEnabled === 'boolean' ? executionEnabled : isTravelExecutionEngineEnabled()
  const payOn = () =>
    typeof paymentsEnabled === 'boolean' ? paymentsEnabled : isPaymentsPlatformEnabled()
  const tripOn = () =>
    typeof tripsEnabled === 'boolean' ? tripsEnabled : isTripManagementEnabled()

  return {
    async reserve(ctx) {
      if (!execOn()) {
        return emptyState('Travel Execution Engine is disabled', 'reserve')
      }
      const result = await execution.execute({
        conversationId: ctx.conversationId,
        userId: ctx.userId,
        selectedItinerary: ctx.selectedItinerary,
        travelers: ctx.travelers,
        locale: ctx.locale ?? 'ar',
      })
      return {
        ...emptyState(
          result.summary.success
            ? `Reserved ${result.summary.references.bookingReference}`
            : (result.summary.error ?? 'Reservation failed'),
          'reserve',
        ),
        execution: result,
      }
    },

    async pay(state, method: PlatformPaymentMethod = 'card') {
      if (!state.execution?.summary.success) {
        return { ...state, lastAction: 'pay', message: 'Reserve before paying' }
      }
      if (!payOn()) {
        return { ...state, lastAction: 'pay', message: 'Payments platform is disabled' }
      }
      let paymentSession = state.paymentSession
      if (!paymentSession) {
        paymentSession = payments.startFromExecution(state.execution, {
          locale: state.execution.session.context.locale,
        })
      }
      const paymentResult = await payments.pay(paymentSession.sessionId, { method })

      let trip: PostBookingTripRecord | null = state.trip
      if (paymentResult.success && tripOn()) {
        try {
          trip = trips.createFromPayment(paymentResult, {
            userId: state.execution.session.context.userId,
            destination: state.execution.session.context.selectedItinerary.hotel?.area
              ?? state.execution.session.context.selectedItinerary.flight?.to
              ?? 'Trip',
            hotelName: state.execution.session.context.selectedItinerary.hotel?.name ?? null,
            travelers: state.execution.session.context.travelers.adults
              + state.execution.session.context.travelers.children
              + state.execution.session.context.travelers.infants,
          })
        } catch {
          // Trip management may reject if payment refs incomplete in edge cases.
        }
      }

      return {
        execution: state.execution,
        paymentSession: paymentResult.session,
        paymentResult,
        trip,
        lastAction: 'pay',
        message: paymentResult.message,
      }
    },

    async cancel(state, reason = 'user_cancelled') {
      if (state.trip && tripOn()) {
        const cancelled = trips.cancelTrip(state.trip.tripId, reason)
        return {
          ...state,
          trip: cancelled,
          lastAction: 'cancel',
          message: `Trip cancelled (${cancelled.lifecycle})`,
        }
      }
      if (state.execution?.summary.sessionId && execOn()) {
        const session = execution.cancel(state.execution.summary.sessionId, reason)
        return {
          ...state,
          execution: {
            ...state.execution,
            session,
            summary: { ...state.execution.summary, state: session.state, success: false },
          },
          lastAction: 'cancel',
          message: 'Execution cancelled',
        }
      }
      return { ...state, lastAction: 'cancel', message: 'Nothing to cancel' }
    },

    async refund(state) {
      const sessionId = state.paymentSession?.sessionId ?? state.paymentResult?.session.sessionId
      if (!sessionId || !payOn()) {
        return { ...state, lastAction: 'refund', message: 'No payable session for refund' }
      }
      try {
        const outcome = await payments.refund(sessionId, {
          kind: 'full',
          reason: 'conversation_refund',
        })
        if (state.trip && tripOn()) {
          trips.updateRefundStatus(state.trip.tripId, outcome.success ? 'completed' : 'failed')
        }
        return {
          ...state,
          paymentSession: outcome.session,
          lastAction: 'refund',
          message: outcome.success ? 'Refund processed' : 'Refund failed',
        }
      } catch (e) {
        return {
          ...state,
          lastAction: 'refund',
          message: e instanceof Error ? e.message : 'Refund failed',
        }
      }
    },

    viewDocuments(state) {
      if (!state.trip) return { documents: [] }
      const docs = state.trip.documents
      const out: Array<{ label: string; uri: string }> = []
      if (docs.eTicket?.pdfUri) out.push({ label: 'E-Ticket', uri: docs.eTicket.pdfUri })
      if (docs.hotelVoucher?.pdfUri) out.push({ label: 'Hotel voucher', uri: docs.hotelVoucher.pdfUri })
      if (docs.boardingPass?.barcodePayload) {
        out.push({ label: 'Boarding pass', uri: `boarding:${docs.boardingPass.passId}` })
      }
      if (docs.pdfItinerary?.pdfUri) out.push({ label: 'Itinerary PDF', uri: docs.pdfItinerary.pdfUri })
      if (docs.invoiceBundle?.pdfUri) out.push({ label: 'Invoice', uri: docs.invoiceBundle.pdfUri })
      return { documents: out }
    },

    openTrip(state) {
      return state.trip
    },

    getExecutionSession(sessionId) {
      try {
        return execution.getSession(sessionId)
      } catch {
        return null
      }
    },
  }
}
