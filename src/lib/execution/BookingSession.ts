/**
 * Sprint 33 — BookingSession store for execution sessions.
 */

import { buildBookingContext } from './BookingContext'
import { BookingReferenceGenerator } from './BookingReferenceGenerator'
import { BookingTimeline } from './BookingTimeline'
import { ExecutionAudit } from './ExecutionAudit'
import type {
  BookingSessionRecord,
  CreateExecutionSessionInput,
  ExecutionState,
} from './ExecutionTypes'
import { ExecutionError } from './ExecutionErrors'

export class BookingSession {
  private readonly sessions = new Map<string, BookingSessionRecord>()
  private readonly refs = new BookingReferenceGenerator()

  create(input: CreateExecutionSessionInput): BookingSessionRecord {
    const context = buildBookingContext(input)
    const timeline = new BookingTimeline()
    const audit = new ExecutionAudit()
    timeline.add('CREATED', 'Execution session created')
    audit.record('session.created', 'CREATED', {
      conversationId: context.conversationId,
      tripId: context.tripId,
    })

    const record: BookingSessionRecord = {
      context,
      state: 'CREATED',
      references: {
        bookingReference: this.refs.bookingReference(context.sessionId),
        tripReference: this.refs.tripReference(context.tripId),
        executionReference: this.refs.executionReference(context.sessionId),
        flightConfirmation: null,
        hotelConfirmation: null,
      },
      flightReservation: null,
      hotelReservation: null,
      warnings: [],
      retryCount: 0,
      error: null,
      timeline: timeline.list(),
      audit: audit.list(),
      startedAt: null,
      completedAt: null,
    }
    this.sessions.set(context.sessionId, record)
    return cloneSession(record)
  }

  get(sessionId: string): BookingSessionRecord {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new ExecutionError('SESSION_NOT_FOUND', `Execution session ${sessionId} not found`)
    }
    return cloneSession(session)
  }

  update(
    sessionId: string,
    patch: Partial<Omit<BookingSessionRecord, 'context'>> & {
      context?: Partial<BookingSessionRecord['context']>
      appendTimeline?: { state: ExecutionState; label: string; detail?: string }
      appendAudit?: { action: string; state: ExecutionState; detail?: Record<string, unknown> }
    },
  ): BookingSessionRecord {
    const current = this.sessions.get(sessionId)
    if (!current) {
      throw new ExecutionError('SESSION_NOT_FOUND', `Execution session ${sessionId} not found`)
    }

    const timeline = new BookingTimeline()
    timeline.hydrate(current.timeline)
    if (patch.appendTimeline) {
      timeline.add(
        patch.appendTimeline.state,
        patch.appendTimeline.label,
        patch.appendTimeline.detail,
      )
    }

    const audit = new ExecutionAudit()
    audit.hydrate(current.audit)
    if (patch.appendAudit) {
      audit.record(
        patch.appendAudit.action,
        patch.appendAudit.state,
        patch.appendAudit.detail ?? {},
      )
    }

    const next: BookingSessionRecord = {
      ...current,
      ...patch,
      context: {
        ...current.context,
        ...patch.context,
        updatedAt: new Date().toISOString(),
      },
      references: patch.references ?? current.references,
      timeline: timeline.list(),
      audit: audit.list(),
    }
    this.sessions.set(sessionId, next)
    return cloneSession(next)
  }

  list(): BookingSessionRecord[] {
    return [...this.sessions.values()].map(cloneSession)
  }

  clear(): void {
    this.sessions.clear()
  }
}

function cloneSession(session: BookingSessionRecord): BookingSessionRecord {
  return {
    ...session,
    context: {
      ...session.context,
      selectedItinerary: session.context.selectedItinerary,
      travelers: { ...session.context.travelers },
      pricing: { ...session.context.pricing },
    },
    references: { ...session.references },
    flightReservation: session.flightReservation ? { ...session.flightReservation } : null,
    hotelReservation: session.hotelReservation ? { ...session.hotelReservation } : null,
    warnings: [...session.warnings],
    timeline: session.timeline.map((t) => ({ ...t })),
    audit: session.audit.map((a) => ({ ...a, detail: { ...a.detail } })),
  }
}

let sharedBookingSession: BookingSession | null = null

export function getBookingSessionStore(): BookingSession {
  if (!sharedBookingSession) sharedBookingSession = new BookingSession()
  return sharedBookingSession
}

export function resetBookingSessionStore(): void {
  sharedBookingSession?.clear()
  sharedBookingSession = null
}
