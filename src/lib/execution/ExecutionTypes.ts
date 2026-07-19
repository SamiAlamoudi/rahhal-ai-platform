/**
 * Sprint 33 — Travel Execution Engine types (booking execution foundation).
 * Distinct from Sprint 23 brain/execution (search tasks).
 */

import type { UnifiedTravelPlanOption } from '../brain/unifiedTravel/types'

export type ExecutionState =
  | 'CREATED'
  | 'VALIDATED'
  | 'FLIGHT_RESERVED'
  | 'HOTEL_RESERVED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ROLLBACK'

export type ExecutionEventType =
  | 'ExecutionStarted'
  | 'FlightReserved'
  | 'HotelReserved'
  | 'ExecutionCompleted'
  | 'ExecutionFailed'
  | 'RollbackStarted'
  | 'RollbackCompleted'

export interface TravelerInfo {
  adults: number
  children: number
  infants: number
  summary: string
}

export interface PricingSnapshot {
  currency: string
  flights: number
  hotels: number
  taxesAndFees: number
  total: number
}

export interface BookingReferences {
  bookingReference: string
  tripReference: string
  executionReference: string
  flightConfirmation: string | null
  hotelConfirmation: string | null
}

export interface ProviderReservationResult {
  success: boolean
  providerId: string
  providerName: string
  confirmationNumber: string | null
  latencyMs: number
  cancellable: boolean
  warning?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

export interface BookingContext {
  sessionId: string
  tripId: string
  conversationId: string
  userId: string
  selectedItinerary: UnifiedTravelPlanOption
  travelers: TravelerInfo
  pricing: PricingSnapshot
  currency: string
  locale: 'ar' | 'en'
  createdAt: string
  updatedAt: string
}

export interface BookingSessionRecord {
  context: BookingContext
  state: ExecutionState
  references: BookingReferences
  flightReservation: ProviderReservationResult | null
  hotelReservation: ProviderReservationResult | null
  warnings: string[]
  retryCount: number
  error: string | null
  timeline: BookingTimelineEntry[]
  audit: ExecutionAuditEntry[]
  startedAt: string | null
  completedAt: string | null
}

export interface BookingTimelineEntry {
  id: string
  at: string
  state: ExecutionState
  label: string
  detail?: string
}

export interface ExecutionAuditEntry {
  id: string
  at: string
  action: string
  state: ExecutionState
  detail: Record<string, unknown>
}

export interface ExecutionEvent {
  type: ExecutionEventType
  at: string
  sessionId: string
  data?: Record<string, unknown>
}

export interface ExecutionMetricsSnapshot {
  executionsStarted: number
  executionsCompleted: number
  executionsFailed: number
  rollbacks: number
  retries: number
  totalDurationMs: number
  avgDurationMs: number
  flightLatencyMsTotal: number
  hotelLatencyMsTotal: number
  successRate: number
  failureRate: number
}

export interface ExecutionSummary {
  sessionId: string
  state: ExecutionState
  references: BookingReferences
  flightConfirmation: ProviderReservationResult | null
  hotelConfirmation: ProviderReservationResult | null
  pricing: PricingSnapshot
  currency: string
  warnings: string[]
  providersUsed: string[]
  confidenceScore: number
  executionDurationMs: number
  retryCount: number
  success: boolean
  error: string | null
}

export interface ExecutionResult {
  session: BookingSessionRecord
  summary: ExecutionSummary
  events: ExecutionEvent[]
}

export interface CreateExecutionSessionInput {
  conversationId: string
  tripId?: string
  userId?: string
  selectedItinerary: UnifiedTravelPlanOption
  travelers?: Partial<TravelerInfo>
  locale?: 'ar' | 'en'
}

