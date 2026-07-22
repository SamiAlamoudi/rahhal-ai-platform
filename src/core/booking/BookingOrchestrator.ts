/**
 * Sprint 94 — BookingOrchestrator
 * Converts an approved bookable Trip into an executable booking workflow.
 */

import { createBookingPlan } from './BookingPlan'
import {
  attachReservation,
  createBookingSession,
  transitionSession,
} from './BookingSession'
import { executeBookingStep, rollbackReservations } from './BookingExecutor'
import { createBookingAudit } from './BookingAudit'
import { validateBooking } from './BookingValidator'
import { deriveStateFromReservations } from './BookingState'
import { buildBookingSummary } from './BookingSerializer'
import {
  SPRINT94_BOOKING_ORCHESTRATOR_VERSION,
  type BookingOrchestratorInput,
  type BookingOrchestratorResult,
  type BookingSession,
} from './types'

function newSessionId(now: number): string {
  return `bk_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export class BookingOrchestrator {
  async run(input: BookingOrchestratorInput): Promise<BookingOrchestratorResult> {
    const started = Date.now()
    const nowFn = input.now ?? Date.now
    const providerId = input.providerId ?? 'booking-orchestrator'
    const currency = (input.currency ?? input.trip.currency ?? 'SAR').toUpperCase()
    const quotedTotal = input.quotedTotal
      ?? input.trip.pricingSummary?.total
      ?? sumTrip(input.trip)
    const currentTotal = input.currentTotal ?? quotedTotal
    const timeoutMs = input.timeoutMs ?? 15 * 60_000
    const audit = createBookingAudit()

    const plan = createBookingPlan({
      trip: input.trip,
      providerId,
      now: nowFn,
    })

    let session: BookingSession = createBookingSession({
      sessionId: input.sessionId ?? newSessionId(nowFn()),
      tripId: input.trip.id,
      provider: providerId,
      plan,
      travelers: input.travelers,
      quotedTotal,
      currency,
      timeoutMs,
      now: nowFn,
    })

    audit.record('booking.session.created', session.sessionId, {
      tripId: input.trip.id,
      stepCount: plan.steps.length,
    })
    audit.record('booking.plan.created', session.sessionId, {
      planId: plan.id,
      totalAmount: plan.totalAmount,
    })

    const validation = validateBooking({
      trip: input.trip,
      travelers: input.travelers,
      quotedTotal,
      currentTotal,
      currency,
      now: nowFn(),
      expiresAt: session.expiresAt,
      providerHealthy: input.providerHealthy !== false,
    })

    audit.record('booking.validated', session.sessionId, {
      ok: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings,
    })

    if (!validation.ok) {
      session = {
        ...session,
        warnings: [...session.warnings, ...validation.warnings],
        lastError: validation.errors.join('; '),
        state: validation.errors.includes('Booking timeout') ? 'Expired' : 'Cancelled',
        updatedAt: new Date(nowFn()).toISOString(),
      }
      if (session.state === 'Expired') {
        audit.record('booking.expired', session.sessionId, { errors: validation.errors })
      } else {
        audit.record('booking.cancelled', session.sessionId, { errors: validation.errors })
      }
      return {
        version: SPRINT94_BOOKING_ORCHESTRATOR_VERSION,
        session,
        summary: buildBookingSummary(session),
        audit: audit.events,
        durationMs: Date.now() - started,
      }
    }

    session = {
      ...transitionSession(session, 'Started', nowFn),
      warnings: [...session.warnings, ...validation.warnings],
    }
    audit.record('booking.started', session.sessionId)

    let retrying = false
    for (const step of plan.steps) {
      // Expiry check between steps
      if (nowFn() > Date.parse(session.expiresAt)) {
        session = transitionSession(session, 'Expired', nowFn)
        audit.record('booking.expired', session.sessionId)
        break
      }

      audit.record('booking.step.started', session.sessionId, {
        stepId: step.id,
        kind: step.kind,
        placeholder: step.placeholder,
      })

      if (retrying) {
        session = transitionSession(session, 'Retrying', nowFn)
      } else {
        session = transitionSession(session, 'Waiting', nowFn)
        audit.record('booking.waiting', session.sessionId, { stepId: step.id })
      }

      const stepStarted = Date.now()
      const reservation = await executeBookingStep(step, {
        providerId: step.providerId || providerId,
        failFlight: input.failFlight === true && step.kind === 'flight',
        maxRetries: input.maxRetries ?? 3,
        onRetry: (stepId, attempt) => {
          retrying = true
          session = {
            ...transitionSession(session, 'Retrying', nowFn),
            retryCount: session.retryCount + 1,
          }
          audit.record('booking.retry', session.sessionId, { stepId, attempt })
        },
      })

      audit.record('booking.provider.response', session.sessionId, {
        stepId: step.id,
        status: reservation.status,
        reservationId: reservation.reservationId,
      }, Date.now() - stepStarted)

      session = attachReservation(session, reservation, nowFn)

      if (reservation.status === 'failed') {
        audit.record('booking.step.failed', session.sessionId, {
          stepId: step.id,
          error: reservation.error,
        })
        session = {
          ...session,
          lastError: reservation.error ?? 'reservation_failed',
          rollback: {
            required: true,
            completed: false,
            reservationIds: session.reservationIds,
            reason: reservation.error ?? 'step_failed',
          },
        }
        const rolled = await rollbackReservations(session.reservations)
        session = {
          ...session,
          reservations: rolled,
          reservationIds: [],
          rollback: { ...session.rollback, completed: true },
        }
        audit.record('booking.rollback', session.sessionId, {
          reason: session.rollback.reason,
        })
        session = transitionSession(session, 'Cancelled', nowFn)
        audit.record('booking.cancelled', session.sessionId)
        break
      }

      audit.record('booking.step.confirmed', session.sessionId, {
        stepId: step.id,
        reservationId: reservation.reservationId,
        placeholder: reservation.placeholder,
      })
      retrying = false
    }

    if (session.state !== 'Cancelled' && session.state !== 'Expired') {
      const derived = deriveStateFromReservations({
        reservations: session.reservations,
        started: true,
        retrying: false,
        cancelled: false,
        expired: false,
      })
      session = transitionSession(session, derived, nowFn)
      if (derived === 'PartiallyConfirmed') {
        audit.record('booking.partial', session.sessionId)
      }
      if (derived === 'Confirmed') {
        session = {
          ...session,
          lockedTotal: quotedTotal,
        }
        // Mark workflow complete for orchestrator success path (payment still required).
        session = transitionSession(session, 'Completed', nowFn)
        session = { ...session, paymentRequired: true }
        audit.record('booking.completed', session.sessionId, {
          reservationCount: session.reservations.length,
          lockedTotal: session.lockedTotal,
        })
      }
    }

    return {
      version: SPRINT94_BOOKING_ORCHESTRATOR_VERSION,
      session,
      summary: buildBookingSummary(session),
      audit: audit.events,
      durationMs: Date.now() - started,
    }
  }
}

function sumTrip(trip: BookingOrchestratorInput['trip']): number {
  const flights = (trip.flights ?? []).reduce((s, f) => s + f.price, 0)
  const hotel = trip.hotel?.price ?? 0
  const transfers = (trip.transfers ?? []).reduce((s, t) => s + t.price, 0)
  const insurance = trip.insurance?.price ?? 0
  return Math.round((flights + hotel + transfers + insurance) * 100) / 100
}

export function createBookingOrchestrator(): BookingOrchestrator {
  return new BookingOrchestrator()
}

export async function runBookingOrchestrator(
  input: BookingOrchestratorInput,
): Promise<BookingOrchestratorResult> {
  return createBookingOrchestrator().run(input)
}
