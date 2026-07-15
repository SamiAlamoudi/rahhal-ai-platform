/**
 * TicketOrchestrator — Phase T ticketing & confirmation engine.
 *
 * Runs after booking is eligible and payment is captured/approved (mock).
 * Uses mock ticket providers only; Booking / Payment / TravelAgent stay provider-blind.
 */

import type { BookingOrchestrator } from '../booking/bookingOrchestrator'
import type { BookingSession } from '../booking/bookingTypes'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { PaymentSession } from '../payment/paymentTypes'
import { appendAudit } from './audit'
import {
  assessTicketingEligibility,
  bookingItemsToTicketLines,
  buildPaymentSummary,
  buildTravelersFromOrder,
} from './bookingPaymentTicketingBridge'
import { buildConfirmationDocument } from './confirmationDocuments'
import { MockFlightTicketProvider } from './mockFlightTicketProvider'
import { MockHotelVoucherProvider } from './mockHotelVoucherProvider'
import type { TicketProviderAdapter } from './ticketProviderAdapter'
import {
  assertCanTransitionTicketSession,
  canTransitionTicketSession,
  type TicketSessionEvent,
  resolveTicketSessionEvent,
} from './ticketSessionStateMachine'
import type {
  TicketLineItem,
  TicketLineStatus,
  TicketSession,
  TicketSessionStatus,
} from './types'

export interface TicketOrchestratorOptions {
  flightProvider?: TicketProviderAdapter
  hotelProvider?: TicketProviderAdapter
  /** Optional booking orchestrator for status reflection. */
  bookingOrchestrator?: BookingOrchestrator | null
  /** Default TTL for ticket sessions. */
  ttlMs?: number
}

export interface StartTicketingInput {
  bookingSession: BookingSession
  order: RahhalOrder
  paymentSession: PaymentSession | null
  /** Per-line forced failures for tests: bookingItemId → true */
  forceFailByBookingItemId?: Record<string, boolean>
}

export interface IssueTicketsResult {
  success: boolean
  complete: boolean
  partial: boolean
  session: TicketSession | null
  message: string
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export class TicketOrchestrator {
  private readonly flightProvider: TicketProviderAdapter
  private readonly hotelProvider: TicketProviderAdapter
  private readonly bookingOrchestrator: BookingOrchestrator | null
  private readonly ttlMs: number
  private readonly sessions = new Map<string, TicketSession>()
  /** issuanceKey → sessionId for duplicate prevention */
  private readonly issuanceIndex = new Map<string, string>()

  constructor(options: TicketOrchestratorOptions = {}) {
    this.flightProvider = options.flightProvider ?? new MockFlightTicketProvider()
    this.hotelProvider = options.hotelProvider ?? new MockHotelVoucherProvider()
    this.bookingOrchestrator = options.bookingOrchestrator ?? null
    this.ttlMs = options.ttlMs ?? 60 * 60 * 1000
  }

  getSession(sessionId: string): TicketSession | null {
    const session = this.sessions.get(sessionId)
    return session ? cloneSession(session) : null
  }

  getSessionByIssuanceKey(issuanceKey: string): TicketSession | null {
    const id = this.issuanceIndex.get(issuanceKey)
    return id ? this.getSession(id) : null
  }

  /**
   * Create a ticket session when booking+payment are eligible.
   * Prevents duplicate sessions for the same booking+order.
   */
  startTicketing(input: StartTicketingInput): IssueTicketsResult {
    const eligibility = assessTicketingEligibility(input)
    if (!eligibility.eligible) {
      return {
        success: false,
        complete: false,
        partial: false,
        session: null,
        message: eligibility.reason || 'Not eligible for ticketing',
      }
    }

    const existingId = this.issuanceIndex.get(eligibility.issuanceKey)
    if (existingId) {
      const existing = this.sessions.get(existingId)
      if (existing && !['cancelled', 'voided', 'expired', 'failed'].includes(existing.status)) {
        return {
          success: false,
          complete: existing.status === 'delivered' || existing.status === 'issued',
          partial: isPartial(existing),
          session: cloneSession(existing),
          message: 'Duplicate ticket issuance prevented for this booking/order',
        }
      }
    }

    const now = nowIso()
    const travelers = buildTravelersFromOrder(input.order)
    const lines = bookingItemsToTicketLines(input.bookingSession.items, travelers, now)
    if (!lines.length) {
      return {
        success: false,
        complete: false,
        partial: false,
        session: null,
        message: 'No flight/hotel lines available to ticket',
      }
    }

    const bookingReference = `BKREF-${input.order.bookingNumber || input.order.orderNumber}`
    let session: TicketSession = {
      id: generateId('tkt'),
      bookingSessionId: input.bookingSession.id,
      orderId: input.order.id,
      orderNumber: input.order.orderNumber,
      status: 'created',
      confirmationNumber: null,
      bookingReference,
      lines,
      travelers,
      paymentSummary: buildPaymentSummary(input.order, input.paymentSession),
      documents: [],
      audit: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + this.ttlMs).toISOString(),
      issuedAt: null,
      deliveredAt: null,
      issuanceKey: eligibility.issuanceKey,
    }

    session = transitionSession(session, 'pending', 'queue', 'Ticket session queued after payment capture')
    this.sessions.set(session.id, session)
    this.issuanceIndex.set(eligibility.issuanceKey, session.id)

    return {
      success: true,
      complete: false,
      partial: false,
      session: cloneSession(session),
      message: 'Ticket session created',
    }
  }

  /**
   * Issue all pending lines. Supports partial success.
   * Failed issuance does not mark booking as confirmed.
   */
  async issueTickets(
    sessionId: string,
    options: { forceFailByBookingItemId?: Record<string, boolean> } = {},
  ): Promise<IssueTicketsResult> {
    const current = this.sessions.get(sessionId)
    if (!current) {
      return emptyFailure('Ticket session not found')
    }
    if (this.isExpired(current)) {
      const expired = transitionSession(current, 'expired', 'expire', 'Ticket session expired')
      this.sessions.set(sessionId, expired)
      return {
        success: false,
        complete: false,
        partial: false,
        session: cloneSession(expired),
        message: 'Ticket session expired',
      }
    }

    let session = transitionSession(current, 'issuing', 'start_issuing', 'Issuance started')
    this.sessions.set(sessionId, session)

    const seed = session.issuanceKey
    const nextLines: TicketLineItem[] = []

    for (const line of session.lines) {
      if (line.status === 'issued') {
        nextLines.push(line)
        continue
      }
      if (line.status === 'voided' || line.status === 'cancelled') {
        nextLines.push(line)
        continue
      }

      const provider = line.kind === 'flight' ? this.flightProvider : this.hotelProvider
      const forceFail = Boolean(options.forceFailByBookingItemId?.[line.bookingItemId])
      const issuingLine: TicketLineItem = {
        ...line,
        status: 'issuing',
        attemptCount: line.attemptCount + 1,
        updatedAt: nowIso(),
        error: null,
      }
      session = {
        ...session,
        audit: appendAudit(session.audit, {
          type: 'line_issuing',
          message: `Issuing ${line.kind} line`,
          lineId: line.id,
          fromStatus: line.status,
          toStatus: 'issuing',
          metadata: { attempt: issuingLine.attemptCount, providerId: provider.providerId },
        }),
      }

      const result = await provider.issue({
        ticketSessionId: session.id,
        lineId: line.id,
        bookingItemId: line.bookingItemId,
        title: line.title,
        providerId: line.providerId,
        travelers: line.travelers,
        flightSegments: line.flightSegments,
        hotelRooms: line.hotelRooms,
        hotelName: line.hotelName,
        hotelAddress: line.hotelAddress,
        checkIn: line.checkIn,
        checkOut: line.checkOut,
        seed,
        forceFail,
      })

      if (!result.success) {
        nextLines.push({
          ...issuingLine,
          status: 'failed',
          error: result.message,
          updatedAt: nowIso(),
        })
        session = {
          ...session,
          audit: appendAudit(session.audit, {
            type: 'line_failed',
            message: result.message,
            lineId: line.id,
            fromStatus: 'issuing',
            toStatus: 'failed',
            metadata: { providerId: provider.providerId },
          }),
        }
        continue
      }

      nextLines.push({
        ...issuingLine,
        status: 'issued',
        providerBookingReference: result.providerBookingReference,
        airlinePnr: result.airlinePnr,
        hotelConfirmationNumber: result.hotelConfirmationNumber,
        flightSegments: result.flightSegments.length ? result.flightSegments : issuingLine.flightSegments,
        hotelRooms: result.hotelRooms.length ? result.hotelRooms : issuingLine.hotelRooms,
        issuedAt: nowIso(),
        updatedAt: nowIso(),
        error: null,
      })
      session = {
        ...session,
        audit: appendAudit(session.audit, {
          type: 'line_issued',
          message: result.message,
          lineId: line.id,
          fromStatus: 'issuing',
          toStatus: 'issued',
          metadata: {
            providerId: provider.providerId,
            hasPnr: Boolean(result.airlinePnr),
            hasHotelConfirmation: Boolean(result.hotelConfirmationNumber),
          },
        }),
      }

      // Reflect provider booking reference on booking session when available.
      if (this.bookingOrchestrator && result.providerBookingReference) {
        try {
          this.bookingOrchestrator.addProviderReference(
            session.bookingSessionId,
            line.providerId,
            result.providerBookingReference,
          )
        } catch {
          /* booking reflection is best-effort */
        }
      }
    }

    session = { ...session, lines: nextLines, updatedAt: nowIso() }
    session = finalizeSessionStatus(session)
    this.sessions.set(sessionId, session)

    return {
      success: session.status === 'issued' || session.status === 'delivered' || isPartial(session),
      complete: session.status === 'issued' || session.status === 'delivered',
      partial: isPartial(session),
      session: cloneSession(session),
      message: describeIssuance(session),
    }
  }

  /** Create session (if needed) and issue immediately. */
  async startAndIssue(input: StartTicketingInput): Promise<IssueTicketsResult> {
    const started = this.startTicketing(input)
    if (!started.session) return started
    // Duplicate prevention returns the existing in-flight/completed session.
    if (!started.success) return started
    return this.issueTickets(started.session.id, {
      forceFailByBookingItemId: input.forceFailByBookingItemId,
    })
  }

  /** Safe retry of failed lines only. */
  async retryFailed(sessionId: string): Promise<IssueTicketsResult> {
    const current = this.sessions.get(sessionId)
    if (!current) return emptyFailure('Ticket session not found')

    if (current.status === 'failed' || current.status === 'reissue_required') {
      const queued = transitionSession(current, 'pending', 'queue', 'Retry queued for failed issuance')
      this.sessions.set(sessionId, queued)
    }

    const session = this.sessions.get(sessionId)!
    // Reset failed lines to pending for another attempt.
    const lines = session.lines.map((line) => (
      line.status === 'failed'
        ? { ...line, status: 'pending' as TicketLineStatus, error: null, updatedAt: nowIso() }
        : line
    ))
    this.sessions.set(sessionId, {
      ...session,
      lines,
      audit: appendAudit(session.audit, {
        type: 'retry_requested',
        message: 'Retry requested for failed lines',
        metadata: { failedLines: lines.filter((l) => l.status === 'pending').length },
      }),
      updatedAt: nowIso(),
    })

    return this.issueTickets(sessionId)
  }

  deliver(sessionId: string): IssueTicketsResult {
    const current = this.sessions.get(sessionId)
    if (!current) return emptyFailure('Ticket session not found')
    if (current.status !== 'issued') {
      return {
        success: false,
        complete: false,
        partial: isPartial(current),
        session: cloneSession(current),
        message: `Cannot deliver from status ${current.status}`,
      }
    }
    const delivered = transitionSession(current, 'delivered', 'deliver', 'Confirmation documents delivered')
    const withDocs = {
      ...delivered,
      deliveredAt: nowIso(),
      documents: delivered.documents.length
        ? delivered.documents
        : [buildConfirmationDocument(delivered)],
    }
    this.sessions.set(sessionId, withDocs)
    return {
      success: true,
      complete: true,
      partial: false,
      session: cloneSession(withDocs),
      message: 'Tickets delivered',
    }
  }

  cancel(sessionId: string): IssueTicketsResult {
    const current = this.sessions.get(sessionId)
    if (!current) return emptyFailure('Ticket session not found')
    if (!canTransitionTicketSession(current.status, 'cancelled')) {
      return {
        success: false,
        complete: false,
        partial: isPartial(current),
        session: cloneSession(current),
        message: `Cannot cancel from status ${current.status}`,
      }
    }
    const lines = current.lines.map((line) => (
      line.status === 'issued' || line.status === 'issuing' || line.status === 'pending' || line.status === 'failed'
        ? { ...line, status: 'cancelled' as TicketLineStatus, updatedAt: nowIso() }
        : line
    ))
    const cancelled = transitionSession(
      { ...current, lines },
      'cancelled',
      'cancel',
      'Ticket session cancelled',
    )
    this.sessions.set(sessionId, cancelled)
    return {
      success: true,
      complete: false,
      partial: false,
      session: cloneSession(cancelled),
      message: 'Ticket session cancelled',
    }
  }

  async voidSession(sessionId: string): Promise<IssueTicketsResult> {
    const current = this.sessions.get(sessionId)
    if (!current) return emptyFailure('Ticket session not found')
    if (!canTransitionTicketSession(current.status, 'voided')
      && current.status !== 'issued'
      && current.status !== 'delivered') {
      return {
        success: false,
        complete: false,
        partial: isPartial(current),
        session: cloneSession(current),
        message: `Cannot void from status ${current.status}`,
      }
    }

    const lines: TicketLineItem[] = []
    let audit = current.audit
    for (const line of current.lines) {
      if (line.status !== 'issued') {
        lines.push(line)
        continue
      }
      const provider = line.kind === 'flight' ? this.flightProvider : this.hotelProvider
      const result = await provider.voidIssuance(line, current.issuanceKey)
      lines.push({
        ...line,
        status: result.success ? 'voided' : line.status,
        updatedAt: nowIso(),
        error: result.success ? null : result.message,
      })
      audit = appendAudit(audit, {
        type: result.success ? 'line_voided' : 'line_void_failed',
        message: result.message,
        lineId: line.id,
        fromStatus: line.status,
        toStatus: result.success ? 'voided' : line.status,
      })
    }

    const voided = transitionSession(
      { ...current, lines, audit },
      'voided',
      'void',
      'Ticket session voided',
    )
    this.sessions.set(sessionId, voided)
    return {
      success: true,
      complete: false,
      partial: false,
      session: cloneSession(voided),
      message: 'Ticket session voided',
    }
  }

  markReissueRequired(sessionId: string): IssueTicketsResult {
    const current = this.sessions.get(sessionId)
    if (!current) return emptyFailure('Ticket session not found')
    const next = transitionSession(
      current,
      'reissue_required',
      'require_reissue',
      'Reissue required for future workflow',
    )
    this.sessions.set(sessionId, next)
    return {
      success: true,
      complete: false,
      partial: isPartial(next),
      session: cloneSession(next),
      message: 'Marked reissue_required',
    }
  }

  expire(sessionId: string): IssueTicketsResult {
    const current = this.sessions.get(sessionId)
    if (!current) return emptyFailure('Ticket session not found')
    const expired = transitionSession(current, 'expired', 'expire', 'Ticket session expired')
    const lines = expired.lines.map((line) => (
      line.status === 'pending' || line.status === 'issuing' || line.status === 'failed'
        ? { ...line, status: 'expired' as TicketLineStatus, updatedAt: nowIso() }
        : line
    ))
    const next = { ...expired, lines }
    this.sessions.set(sessionId, next)
    return {
      success: true,
      complete: false,
      partial: false,
      session: cloneSession(next),
      message: 'Ticket session expired',
    }
  }

  private isExpired(session: TicketSession): boolean {
    return Date.parse(session.expiresAt) < Date.now()
  }
}

function transitionSession(
  session: TicketSession,
  to: TicketSessionStatus,
  event: TicketSessionEvent,
  message: string,
): TicketSession {
  const target = to === resolveTicketSessionEvent(session.status, event)
    ? to
    : to
  assertCanTransitionTicketSession(session.status, target)
  return {
    ...session,
    status: target,
    updatedAt: nowIso(),
    audit: appendAudit(session.audit, {
      type: `session_${event}`,
      message,
      fromStatus: session.status,
      toStatus: target,
    }),
  }
}

function finalizeSessionStatus(session: TicketSession): TicketSession {
  const issued = session.lines.filter((l) => l.status === 'issued').length
  const failed = session.lines.filter((l) => l.status === 'failed').length
  const total = session.lines.length

  if (issued === total && total > 0) {
    const confirmationNumber = `CNF-${stableConfirm(session)}`
    let next: TicketSession = {
      ...session,
      confirmationNumber,
      issuedAt: session.issuedAt ?? nowIso(),
    }
    next = transitionSession(next, 'issued', 'mark_issued', 'All ticket lines issued')
    const document = buildConfirmationDocument(next)
    next = {
      ...next,
      documents: [document],
      audit: appendAudit(next.audit, {
        type: 'document_built',
        message: 'Confirmation document generated',
        metadata: { documentId: document.id },
      }),
    }
    // Auto-deliver mock confirmations (architecture delivery, no UI).
    next = transitionSession(next, 'delivered', 'deliver', 'Confirmation delivered (mock)')
    return { ...next, deliveredAt: nowIso() }
  }

  if (issued > 0 && failed > 0) {
    // Stay in failed-ish reissue lane — partial issuance is not full confirmation.
    const next = transitionSession(
      session,
      'failed',
      'fail',
      `Partial issuance: ${issued}/${total} lines issued`,
    )
    return {
      ...next,
      confirmationNumber: null,
      documents: [],
      audit: appendAudit(next.audit, {
        type: 'partial_issuance',
        message: 'Partial issuance — booking must not be treated as fully confirmed',
        metadata: { issued, failed, total },
      }),
    }
  }

  if (failed === total) {
    return transitionSession(session, 'failed', 'fail', 'All ticket lines failed')
  }

  return session
}

function stableConfirm(session: TicketSession): string {
  let hash = 0
  const raw = session.issuanceKey
  for (let i = 0; i < raw.length; i += 1) hash = ((hash << 5) - hash) + raw.charCodeAt(i)
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 8)
}

function isPartial(session: TicketSession): boolean {
  const issued = session.lines.some((l) => l.status === 'issued')
  const failed = session.lines.some((l) => l.status === 'failed')
  return issued && failed
}

function describeIssuance(session: TicketSession): string {
  const issued = session.lines.filter((l) => l.status === 'issued').length
  const failed = session.lines.filter((l) => l.status === 'failed').length
  if (session.status === 'delivered') return 'All tickets issued and delivered'
  if (session.status === 'issued') return 'All tickets issued'
  if (issued && failed) return `Partial issuance: ${issued} issued, ${failed} failed`
  if (failed) return 'Ticket issuance failed'
  return `Ticket session status: ${session.status}`
}

function emptyFailure(message: string): IssueTicketsResult {
  return {
    success: false,
    complete: false,
    partial: false,
    session: null,
    message,
  }
}

function cloneSession(session: TicketSession): TicketSession {
  return {
    ...session,
    lines: session.lines.map((l) => ({
      ...l,
      travelers: [...l.travelers],
      flightSegments: l.flightSegments.map((s) => ({ ...s })),
      hotelRooms: l.hotelRooms.map((r) => ({ ...r })),
    })),
    travelers: [...session.travelers],
    documents: session.documents.map((d) => ({
      ...d,
      travelers: [...d.travelers],
      flightSegments: d.flightSegments.map((s) => ({ ...s })),
      roomDetails: d.roomDetails.map((r) => ({ ...r })),
      airlinePnrs: [...d.airlinePnrs],
      hotelConfirmationNumbers: [...d.hotelConfirmationNumbers],
      bookingReferences: [...d.bookingReferences],
      cancellationNotes: [...d.cancellationNotes],
      lines: d.lines.map((l) => ({ ...l })),
      qrCodeData: { ...d.qrCodeData, lineReferences: [...d.qrCodeData.lineReferences] },
      paymentSummary: { ...d.paymentSummary },
    })),
    audit: session.audit.map((a) => ({ ...a, metadata: { ...a.metadata } })),
    paymentSummary: { ...session.paymentSummary },
  }
}

let singleton: TicketOrchestrator | null = null

export function getTicketOrchestrator(
  options: TicketOrchestratorOptions = {},
): TicketOrchestrator {
  if (!singleton || options.flightProvider || options.hotelProvider || options.bookingOrchestrator) {
    singleton = new TicketOrchestrator(options)
  }
  return singleton
}

export function resetTicketOrchestrator(): void {
  singleton = null
}
