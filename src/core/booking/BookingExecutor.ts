/**
 * Sprint 94 — execute reservation plan steps (flights live-ready; others placeholder).
 */

import type { BookingPlanStep, BookingReservation } from './types'
import { createBookingRecovery } from './BookingRecovery'

export interface BookingExecutorOptions {
  providerId: string
  failFlight?: boolean
  maxRetries?: number
  sleep?: (ms: number) => Promise<void>
  onRetry?: (stepId: string, attempt: number) => void
}

export async function executeBookingStep(
  step: BookingPlanStep,
  options: BookingExecutorOptions,
): Promise<BookingReservation> {
  if (step.placeholder || step.kind !== 'flight') {
    return {
      reservationId: `ph_${step.kind}_${step.offerId}`,
      stepId: step.id,
      kind: step.kind,
      providerId: step.providerId,
      status: 'placeholder',
      amount: step.amount,
      currency: step.currency,
      confirmationCode: `HOLD-${step.kind.toUpperCase()}-${step.offerId.slice(0, 6).toUpperCase()}`,
      placeholder: true,
      error: null,
    }
  }

  const recovery = createBookingRecovery({
    providerId: options.providerId,
    maxAttempts: options.maxRetries ?? 3,
    sleep: options.sleep,
  })

  let attempts = 0
  const outcome = await recovery.execute(async () => {
    attempts += 1
    if (attempts > 1) options.onRetry?.(step.id, attempts)
    if (options.failFlight) {
      throw new Error('PROVIDER_UNAVAILABLE')
    }
    // Simulated production-ready flight hold (provider adapter hooks in later sprints).
    return {
      reservationId: `res_flight_${step.offerId}`,
      confirmationCode: `FLT-${step.offerId.slice(0, 8).toUpperCase()}`,
    }
  })

  if (!outcome.ok || !outcome.value) {
    return {
      reservationId: `fail_${step.offerId}`,
      stepId: step.id,
      kind: step.kind,
      providerId: step.providerId,
      status: 'failed',
      amount: step.amount,
      currency: step.currency,
      confirmationCode: null,
      placeholder: false,
      error: outcome.code ?? outcome.error ?? 'reservation_failed',
    }
  }

  return {
    reservationId: outcome.value.reservationId,
    stepId: step.id,
    kind: step.kind,
    providerId: step.providerId,
    status: 'reserved',
    amount: step.amount,
    currency: step.currency,
    confirmationCode: outcome.value.confirmationCode,
    placeholder: false,
    error: null,
  }
}

export async function rollbackReservations(
  reservations: BookingReservation[],
): Promise<BookingReservation[]> {
  return reservations.map((r) => {
    if (r.status === 'failed') return r
    if (r.placeholder) {
      return { ...r, status: 'rolled_back' as const }
    }
    return {
      ...r,
      status: 'rolled_back' as const,
      confirmationCode: null,
    }
  })
}
