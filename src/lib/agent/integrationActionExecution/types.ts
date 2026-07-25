/**
 * Integration Sprint 11 — Action Execution Layer contracts.
 * Intent → validation → confirmation → provider execution → result → summary.
 * Live execution prepared but not enabled.
 */

export const INTEGRATION_ACTION_EXECUTION_VERSION =
  '1.0.0-integration-action-execution'

export type ActionKind =
  | 'book_flight'
  | 'reserve_hotel'
  | 'save_itinerary'
  | 'share_trip'
  | 'cancel_booking'
  | 'modify_booking'

/** Safe execution modes. `live` is prepared for the future and never runs by default. */
export type ActionExecutionMode = 'dry_run' | 'mock' | 'preview' | 'live'

export type ActionPipelineStage =
  | 'intent'
  | 'validation'
  | 'confirmation'
  | 'provider_execution'
  | 'result'
  | 'conversation_summary'

export type ActionConfirmationKind =
  | 'booking'
  | 'cancellation'
  | 'modification'
  | 'payment'
  | 'none'

export type ActionIntent =
  | 'request_action'
  | 'confirm_action'
  | 'decline_action'
  | 'unknown'

export interface ActionValidation {
  ok: boolean
  missing: string[]
  warnings: string[]
}

export interface ActionConfirmationGate {
  required: boolean
  kind: ActionConfirmationKind
  confirmed: boolean
  promptEn: string
  promptAr: string
}

export interface ActionExecutionResultPayload {
  success: boolean
  mode: ActionExecutionMode
  providerId: string | null
  orderId: string | null
  reference: string | null
  detailEn: string
  detailAr: string
  liveBlocked: boolean
}

export interface PendingAction {
  id: string
  kind: ActionKind
  createdAt: string
  offerId: string | null
  summaryEn: string
  summaryAr: string
}

export interface ActionHistoryEntry {
  id: string
  kind: ActionKind
  status: 'pending' | 'confirmed' | 'completed' | 'declined' | 'failed' | 'previewed'
  mode: ActionExecutionMode
  at: string
  detailEn: string
}

export interface ActionExecutionMemory {
  pending: PendingAction | null
  lastConfirmation: {
    kind: ActionConfirmationKind
    confirmed: boolean
    at: string
  } | null
  completed: ActionHistoryEntry | null
  history: ActionHistoryEntry[]
}

export interface ActionExecutionResult {
  version: string
  enabled: boolean
  ok: boolean
  intent: ActionIntent
  action: ActionKind | null
  mode: ActionExecutionMode
  stages: ActionPipelineStage[]
  validation: ActionValidation | null
  confirmation: ActionConfirmationGate | null
  execution: ActionExecutionResultPayload | null
  memory: ActionExecutionMemory
  liveReady: boolean
  consultantSummaryEn: string
  consultantSummaryAr: string
  latencyMs: number
  logs: string[]
}

/** Future live capabilities — all false until a later sprint. */
export interface FutureLiveActionCapabilities {
  amadeusBooking: false
  hotelReservation: false
  carBooking: false
  paymentGateway: false
}

export const FUTURE_LIVE_ACTION_CAPABILITIES: FutureLiveActionCapabilities = {
  amadeusBooking: false,
  hotelReservation: false,
  carBooking: false,
  paymentGateway: false,
}
