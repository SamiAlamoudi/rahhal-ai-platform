/**
 * Sprint 94 — agent bridge for Live Booking Orchestrator.
 */

import {
  runBookingOrchestrator,
  SPRINT94_BOOKING_ORCHESTRATOR_VERSION,
  type BookableTraveler,
  type BookableTrip,
  type BookingOrchestratorResult,
} from '../../../core'
import { isBookingOrchestratorEnabled } from './feature'

export { SPRINT94_BOOKING_ORCHESTRATOR_VERSION }

export interface AgentBookingOrchestratorRequest {
  trip: BookableTrip
  travelers: BookableTraveler[]
  sessionId?: string
  providerId?: string
  quotedTotal?: number
  currentTotal?: number
  enabled?: boolean
  providerHealthy?: boolean
  failFlight?: boolean
}

export interface AgentBookingOrchestratorMeta {
  version: string
  sessionId: string
  state: string
  reservationCount: number
  paymentRequired: boolean
  durationMs: number
}

export interface AgentBookingOrchestratorResponse {
  enabled: boolean
  result: BookingOrchestratorResult | null
  meta: AgentBookingOrchestratorMeta | null
}

export function toAgentBookingOrchestratorMeta(
  result: BookingOrchestratorResult,
): AgentBookingOrchestratorMeta {
  return {
    version: result.version,
    sessionId: result.session.sessionId,
    state: result.session.state,
    reservationCount: result.session.reservations.length,
    paymentRequired: result.summary.paymentRequired,
    durationMs: result.durationMs,
  }
}

export async function runLiveBookingOrchestrator(
  input: AgentBookingOrchestratorRequest,
): Promise<AgentBookingOrchestratorResponse> {
  if (!isBookingOrchestratorEnabled({ enabled: input.enabled })) {
    return { enabled: false, result: null, meta: null }
  }

  const result = await runBookingOrchestrator({
    trip: input.trip,
    travelers: input.travelers,
    sessionId: input.sessionId,
    providerId: input.providerId,
    quotedTotal: input.quotedTotal,
    currentTotal: input.currentTotal,
    providerHealthy: input.providerHealthy,
    failFlight: input.failFlight,
  })

  return {
    enabled: true,
    result,
    meta: toAgentBookingOrchestratorMeta(result),
  }
}
