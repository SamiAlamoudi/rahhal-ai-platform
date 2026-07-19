/**
 * Sprint 33 — BookingPipeline
 * Validate → reserve flight → reserve hotel → references → persist → summary → events.
 */

import { BookingStateMachine } from './BookingStateMachine'
import type { BookingSession } from './BookingSession'
import { ExecutionError } from './ExecutionErrors'
import { createExecutionEvent, type ExecutionEvents } from './ExecutionEvents'
import type { ExecutionLogger } from './ExecutionLogger'
import type { ExecutionMetrics } from './ExecutionMetrics'
import { ExecutionRetryPolicy } from './ExecutionRetryPolicy'
import type { FlightReservationPort, HotelReservationPort } from './providers'
import type { BookingSessionRecord, ExecutionEvent } from './ExecutionTypes'

export interface BookingPipelineDeps {
  sessions: BookingSession
  events: ExecutionEvents
  logger: ExecutionLogger
  metrics: ExecutionMetrics
  flightReserver: FlightReservationPort
  hotelReserver: HotelReservationPort
  retryPolicy: ExecutionRetryPolicy
  collectedEvents: ExecutionEvent[]
}

export class BookingPipeline {
  private readonly deps: BookingPipelineDeps

  constructor(deps: BookingPipelineDeps) {
    this.deps = deps
  }

  async run(sessionId: string): Promise<BookingSessionRecord> {
    const { sessions, logger, metrics, flightReserver, hotelReserver } = this.deps

    let session = sessions.get(sessionId)
    const machine = new BookingStateMachine(session.state)
    const startedAt = new Date().toISOString()
    metrics.recordStarted()
    this.pushEvent('ExecutionStarted', sessionId, { tripId: session.context.tripId })
    logger.info('Execution started', sessionId)

    session = sessions.update(sessionId, {
      startedAt,
      appendTimeline: { state: 'CREATED', label: 'Pipeline started' },
      appendAudit: { action: 'pipeline.started', state: 'CREATED' },
    })

    try {
      // 1) Validate
      this.validate(session)
      machine.transition('VALIDATED', 'request validated')
      session = sessions.update(sessionId, {
        state: 'VALIDATED',
        appendTimeline: { state: 'VALIDATED', label: 'Request validated' },
        appendAudit: { action: 'pipeline.validated', state: 'VALIDATED' },
      })

      // 2) Reserve flight (required when present)
      if (session.context.selectedItinerary.flight) {
        const flightReservation = await this.withRetry(async () =>
          flightReserver.reserve({
            flight: session.context.selectedItinerary.flight!,
            adults: session.context.travelers.adults,
            currency: session.context.currency,
          }),
        )
        metrics.recordFlightLatency(flightReservation.latencyMs)

        if (!flightReservation.success) {
          throw new ExecutionError(
            'FLIGHT_RESERVE_FAILED',
            flightReservation.errorMessage ?? 'Flight reservation failed',
            { retryable: false, details: { providerId: flightReservation.providerId } },
          )
        }

        machine.transition('FLIGHT_RESERVED', 'flight reserved')
        session = sessions.update(sessionId, {
          state: 'FLIGHT_RESERVED',
          flightReservation,
          references: {
            ...session.references,
            flightConfirmation: flightReservation.confirmationNumber,
          },
          warnings: flightReservation.warning
            ? [...session.warnings, flightReservation.warning]
            : session.warnings,
          appendTimeline: {
            state: 'FLIGHT_RESERVED',
            label: 'Flight reserved',
            detail: flightReservation.confirmationNumber ?? undefined,
          },
          appendAudit: {
            action: 'flight.reserved',
            state: 'FLIGHT_RESERVED',
            detail: { providerId: flightReservation.providerId },
          },
        })
        this.pushEvent('FlightReserved', sessionId, {
          confirmationNumber: flightReservation.confirmationNumber,
          providerId: flightReservation.providerId,
        })
      }

      // 3) Reserve hotel (required when present)
      if (session.context.selectedItinerary.hotel) {
        const hotelReservation = await this.withRetry(async () =>
          hotelReserver.reserve({
            hotel: session.context.selectedItinerary.hotel!,
            adults: session.context.travelers.adults,
            children: session.context.travelers.children,
            currency: session.context.currency,
          }),
        )
        metrics.recordHotelLatency(hotelReservation.latencyMs)

        if (!hotelReservation.success) {
          // Rollback reserved flight if supported
          await this.rollbackFlight(sessionId, machine)
          throw new ExecutionError(
            'HOTEL_RESERVE_FAILED',
            hotelReservation.errorMessage ?? 'Hotel reservation failed',
            { retryable: false, details: { providerId: hotelReservation.providerId } },
          )
        }

        machine.transition('HOTEL_RESERVED', 'hotel reserved')
        session = sessions.update(sessionId, {
          state: 'HOTEL_RESERVED',
          hotelReservation,
          references: {
            ...sessions.get(sessionId).references,
            hotelConfirmation: hotelReservation.confirmationNumber,
          },
          warnings: hotelReservation.warning
            ? [...sessions.get(sessionId).warnings, hotelReservation.warning]
            : sessions.get(sessionId).warnings,
          appendTimeline: {
            state: 'HOTEL_RESERVED',
            label: 'Hotel reserved',
            detail: hotelReservation.confirmationNumber ?? undefined,
          },
          appendAudit: {
            action: 'hotel.reserved',
            state: 'HOTEL_RESERVED',
            detail: { providerId: hotelReservation.providerId },
          },
        })
        this.pushEvent('HotelReserved', sessionId, {
          confirmationNumber: hotelReservation.confirmationNumber,
          providerId: hotelReservation.providerId,
        })
      }

      // 4) Complete
      machine.transition('COMPLETED', 'execution complete')
      const completedAt = new Date().toISOString()
      session = sessions.update(sessionId, {
        state: 'COMPLETED',
        completedAt,
        error: null,
        appendTimeline: { state: 'COMPLETED', label: 'Execution completed' },
        appendAudit: { action: 'pipeline.completed', state: 'COMPLETED' },
      })
      this.pushEvent('ExecutionCompleted', sessionId, {
        bookingReference: session.references.bookingReference,
      })
      metrics.recordCompleted(Date.parse(completedAt) - Date.parse(startedAt))
      logger.info('Execution completed', sessionId)
      return sessions.get(sessionId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed'
      const failedAt = new Date().toISOString()
      if (machine.getState() !== 'ROLLBACK' && machine.canTransition('FAILED')) {
        machine.transition('FAILED', message)
      } else if (machine.getState() === 'ROLLBACK' && machine.canTransition('FAILED')) {
        machine.transition('FAILED', message)
      }

      session = sessions.update(sessionId, {
        state: 'FAILED',
        completedAt: failedAt,
        error: message,
        appendTimeline: { state: 'FAILED', label: 'Execution failed', detail: message },
        appendAudit: {
          action: 'pipeline.failed',
          state: 'FAILED',
          detail: { message },
        },
      })
      this.pushEvent('ExecutionFailed', sessionId, { message })
      metrics.recordFailed(Date.parse(failedAt) - Date.parse(startedAt))
      logger.error(message, sessionId)
      return sessions.get(sessionId)
    }
  }

  private validate(session: BookingSessionRecord): void {
    const option = session.context.selectedItinerary
    if (!option.flight && !option.hotel) {
      throw new ExecutionError('VALIDATION_FAILED', 'Itinerary has no bookable segments')
    }
    if (session.context.pricing.total <= 0) {
      throw new ExecutionError('VALIDATION_FAILED', 'Pricing snapshot must be positive')
    }
    if (session.context.travelers.adults < 1) {
      throw new ExecutionError('VALIDATION_FAILED', 'At least one adult traveler is required')
    }
  }

  private async rollbackFlight(
    sessionId: string,
    machine: BookingStateMachine,
  ): Promise<void> {
    const { sessions, flightReserver, metrics, logger } = this.deps
    const session = sessions.get(sessionId)
    if (!session.flightReservation?.success || !session.flightReservation.confirmationNumber) {
      return
    }

    this.pushEvent('RollbackStarted', sessionId, {
      reason: 'hotel_reserve_failed',
    })
    if (machine.canTransition('ROLLBACK')) {
      machine.transition('ROLLBACK', 'hotel failed')
    }
    metrics.recordRollback()
    logger.warn('Rollback started — cancelling flight hold', sessionId)

    sessions.update(sessionId, {
      state: 'ROLLBACK',
      appendTimeline: { state: 'ROLLBACK', label: 'Rollback started' },
      appendAudit: { action: 'rollback.started', state: 'ROLLBACK' },
    })

    if (flightReserver.cancel && session.flightReservation.cancellable) {
      await flightReserver.cancel(
        session.flightReservation.confirmationNumber,
        session.flightReservation.providerId,
      )
    }

    this.pushEvent('RollbackCompleted', sessionId, {
      flightConfirmation: session.flightReservation.confirmationNumber,
    })
    sessions.update(sessionId, {
      appendTimeline: { state: 'ROLLBACK', label: 'Flight hold cancelled' },
      appendAudit: { action: 'rollback.completed', state: 'ROLLBACK' },
      warnings: [...session.warnings, 'Flight hold cancelled after hotel failure'],
    })
    logger.info('Rollback completed', sessionId)
  }

  private async withRetry<T extends { success: boolean }>(
    run: () => Promise<T>,
  ): Promise<T> {
    const { retryPolicy, metrics } = this.deps
    let attempt = 0
    let last: T | null = null
    while (true) {
      attempt += 1
      last = await run()
      if (last.success) return last
      if (!retryPolicy.shouldRetry(attempt, true)) return last
      metrics.recordRetry()
      await sleep(retryPolicy.delayMs(attempt))
    }
  }

  private pushEvent(
    type: Parameters<typeof createExecutionEvent>[0],
    sessionId: string,
    data?: Record<string, unknown>,
  ): void {
    const event = createExecutionEvent(type, sessionId, data)
    this.deps.collectedEvents.push(event)
    this.deps.events.emit(event)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
