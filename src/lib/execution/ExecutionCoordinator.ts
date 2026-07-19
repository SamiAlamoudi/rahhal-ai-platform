/**
 * Sprint 33 — orchestrates booking sessions through the pipeline.
 */

import { BookingPipeline } from './BookingPipeline'
import { BookingSession } from './BookingSession'
import { ExecutionError } from './ExecutionErrors'
import { ExecutionEvents } from './ExecutionEvents'
import { ExecutionLogger } from './ExecutionLogger'
import { ExecutionMetrics } from './ExecutionMetrics'
import { ExecutionRetryPolicy } from './ExecutionRetryPolicy'
import { buildExecutionResult } from './ExecutionResult'
import {
  createSandboxFlightReserver,
  createSandboxHotelReserver,
  type FlightReservationPort,
  type HotelReservationPort,
} from './providers'
import type { ExecutionRetryPolicyConfig } from './ExecutionRetryPolicy'
import type {
  BookingSessionRecord,
  CreateExecutionSessionInput,
  ExecutionEvent,
  ExecutionMetricsSnapshot,
  ExecutionResult,
  ExecutionSummary,
} from './ExecutionTypes'

export interface TravelExecutionEngineOptions {
  /** Override feature-flag check (tests). When omitted, uses registry. */
  enabled?: boolean
  retryPolicy?: Partial<ExecutionRetryPolicyConfig>
  flightReserver?: FlightReservationPort
  hotelReserver?: HotelReservationPort
  onEvent?: (event: ExecutionEvent) => void
}

export class ExecutionCoordinator {
  private readonly sessions: BookingSession
  private readonly events: ExecutionEvents
  private readonly logger: ExecutionLogger
  private readonly metrics: ExecutionMetrics
  private readonly flightReserver: FlightReservationPort
  private readonly hotelReserver: HotelReservationPort
  private readonly retryPolicy: ExecutionRetryPolicy
  private readonly onEvent?: (event: ExecutionEvent) => void
  private readonly summaries = new Map<string, ExecutionSummary>()

  constructor(options: TravelExecutionEngineOptions = {}) {
    this.sessions = new BookingSession()
    this.events = new ExecutionEvents()
    this.logger = new ExecutionLogger()
    this.metrics = new ExecutionMetrics()
    this.flightReserver = options.flightReserver ?? createSandboxFlightReserver()
    this.hotelReserver = options.hotelReserver ?? createSandboxHotelReserver()
    this.retryPolicy = new ExecutionRetryPolicy(options.retryPolicy)
    this.onEvent = options.onEvent

    if (this.onEvent) {
      this.events.on('*', this.onEvent)
    }
  }

  createBookingSession(input: CreateExecutionSessionInput): BookingSessionRecord {
    return this.sessions.create(input)
  }

  async execute(input: CreateExecutionSessionInput): Promise<ExecutionResult> {
    const session = this.sessions.create(input)
    return this.runPipeline(session.context.sessionId)
  }

  async executeSession(sessionId: string): Promise<ExecutionResult> {
    const session = this.sessions.get(sessionId)
    if (session.state !== 'CREATED') {
      throw new ExecutionError(
        'STATE_TRANSITION_INVALID',
        `Cannot execute session in state ${session.state}`,
        { details: { state: session.state } },
      )
    }
    return this.runPipeline(sessionId)
  }

  async retry(sessionId: string): Promise<ExecutionResult> {
    const session = this.sessions.get(sessionId)
    if (session.state !== 'FAILED') {
      throw new ExecutionError(
        'STATE_TRANSITION_INVALID',
        `Cannot retry session in state ${session.state}`,
        { details: { state: session.state } },
      )
    }

    this.sessions.update(sessionId, {
      state: 'CREATED',
      retryCount: session.retryCount + 1,
      error: null,
      flightReservation: null,
      hotelReservation: null,
      completedAt: null,
      startedAt: null,
      warnings: [],
      references: {
        ...session.references,
        flightConfirmation: null,
        hotelConfirmation: null,
      },
      appendTimeline: { state: 'CREATED', label: 'Retry requested — reset to CREATED' },
      appendAudit: {
        action: 'pipeline.retry',
        state: 'CREATED',
        detail: { retryCount: session.retryCount + 1 },
      },
    })
    this.metrics.recordRetry()
    this.logger.info('Retry requested', sessionId, { retryCount: session.retryCount + 1 })
    return this.runPipeline(sessionId)
  }

  cancel(sessionId: string, reason?: string): BookingSessionRecord {
    const session = this.sessions.get(sessionId)
    const cancellable = ['CREATED', 'VALIDATED', 'FLIGHT_RESERVED', 'HOTEL_RESERVED', 'ROLLBACK']
    if (!cancellable.includes(session.state)) {
      throw new ExecutionError(
        'STATE_TRANSITION_INVALID',
        `Cannot cancel session in state ${session.state}`,
        { details: { state: session.state } },
      )
    }

    return this.sessions.update(sessionId, {
      state: 'CANCELLED',
      completedAt: new Date().toISOString(),
      error: reason ?? 'cancelled_by_user',
      appendTimeline: {
        state: 'CANCELLED',
        label: 'Session cancelled',
        detail: reason,
      },
      appendAudit: {
        action: 'pipeline.cancelled',
        state: 'CANCELLED',
        detail: { reason },
      },
    })
  }

  getSession(sessionId: string): BookingSessionRecord {
    return this.sessions.get(sessionId)
  }

  getSummary(sessionId: string): ExecutionSummary | null {
    return this.summaries.get(sessionId) ?? null
  }

  getMetricsSnapshot(): ExecutionMetricsSnapshot {
    return this.metrics.snapshot()
  }

  getEventBus(): ExecutionEvents {
    return this.events
  }

  getLogger(): ExecutionLogger {
    return this.logger
  }

  getSessionStore(): BookingSession {
    return this.sessions
  }

  private async runPipeline(sessionId: string): Promise<ExecutionResult> {
    const collectedEvents: ExecutionEvent[] = []
    const pipeline = new BookingPipeline({
      sessions: this.sessions,
      events: this.events,
      logger: this.logger,
      metrics: this.metrics,
      flightReserver: this.flightReserver,
      hotelReserver: this.hotelReserver,
      retryPolicy: this.retryPolicy,
      collectedEvents,
    })

    const session = await pipeline.run(sessionId)
    const result = buildExecutionResult(session, collectedEvents)
    this.summaries.set(sessionId, result.summary)
    return result
  }
}

export type { ExecutionSummary }
