/**
 * Booking Orchestrator — Sprint 57.
 * Executes flights/hotels/activities/transfers/cars/insurance independently.
 */

import type { BookingProviderRegistry } from '../bookingIntelligence/types'
import { BookingAuditTrail } from './audit'
import { BookingEventBus, createBookingEvent } from './events'
import {
  isBookingExecutionEnabled,
  isBookingResumeEnabled,
  isTransactionManagerEnabled,
} from './feature'
import { assertTransition, isSuccessStatus } from './lifecycle'
import { generateBookingDocuments } from './documents'
import { normalizeProviderBooking, withBookingStatus } from './normalize'
import {
  getDefaultBookingRecordStore,
  type BookingRecordStore,
} from './persistence'
import { ReservationManager } from './reservationManager'
import {
  BookingSessionStore,
  getDefaultBookingSessionStore,
} from './sessionStore'
import { TransactionManager } from './transactionManager'
import { createProviderRequestId, logProviderRequest } from '../liveProviders/providerLog'
import type {
  BookingExecutionLineItem,
  BookingExecutionResult,
  BookingExecutionSession,
  BookingExecutorFn,
  BookingCancellerFn,
  BookingNotificationEvent,
  BookingTravelerInfo,
  RunBookingExecutionInput,
  UnifiedBooking,
} from './types'
import { toBookingProviderDomain } from './types'

export type BookingExecutionEngine = {
  events: BookingEventBus
  audit: BookingAuditTrail
  reservations: ReservationManager
  sessions: BookingSessionStore
  run(input: RunBookingExecutionInput): Promise<BookingExecutionResult>
  expireDueSessions(now?: () => number): BookingExecutionSession[]
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function defaultExecutor(): BookingExecutorFn {
  return async ({
    provider,
    offerId,
    signal,
    travelers,
    conversationId,
    checkIn,
    checkOut,
    roomType,
  }) => {
    const started = Date.now()
    const result = await provider.book(offerId, signal, {
      travelers,
      conversationId,
      checkIn,
      checkOut,
      roomType,
    })
    return { ...result, latencyMs: Date.now() - started }
  }
}

function defaultCanceller(): BookingCancellerFn {
  return async ({ provider, confirmationId, signal }) =>
    provider.cancel(confirmationId, signal)
}

function defaultTravelers(): BookingTravelerInfo[] {
  return [{ firstName: 'Traveler', lastName: 'One', email: null, phone: null }]
}

function sessionStatusFromBookings(
  bookings: UnifiedBooking[],
): BookingExecutionSession['status'] {
  if (bookings.length === 0) return 'draft'
  if (bookings.every((b) => b.status === 'expired')) return 'expired'
  if (bookings.every((b) => b.status === 'cancelled')) return 'cancelled'
  if (bookings.every((b) => b.status === 'failed')) return 'failed'
  if (bookings.every((b) => isSuccessStatus(b.status))) {
    return bookings.every((b) => b.status === 'ticketed') ? 'ticketed' : 'confirmed'
  }
  if (bookings.some((b) => b.status === 'payment_required')) return 'payment_required'
  if (bookings.some((b) => isSuccessStatus(b.status))) return 'pending'
  return 'pending'
}

function buildFacts(session: BookingExecutionSession, rolledBack: boolean): string[] {
  const facts: string[] = [
    `Booking session ${session.id} status=${session.status}`,
    `Confirmed domains: ${session.completedDomains.join(',') || 'none'}`,
  ]
  if (session.failedDomains.length) {
    facts.push(`Failed domains: ${session.failedDomains.join(',')}`)
  }
  if (rolledBack) facts.push('Partial failure triggered rollback')
  for (const booking of session.bookings) {
    if (booking.confirmation) {
      facts.push(
        `${booking.domain} via ${booking.provider}: ${booking.confirmation}`
          + (booking.pnr ? ` PNR ${booking.pnr}` : ''),
      )
    }
  }
  return facts
}

export function createBookingExecutionEngine(options?: {
  sessions?: BookingSessionStore
  reservations?: ReservationManager
  audit?: BookingAuditTrail
  events?: BookingEventBus
  records?: BookingRecordStore
}): BookingExecutionEngine {
  const sessions = options?.sessions ?? getDefaultBookingSessionStore()
  const reservations = options?.reservations ?? new ReservationManager()
  const audit = options?.audit ?? new BookingAuditTrail()
  const events = options?.events ?? new BookingEventBus()
  const records = options?.records ?? getDefaultBookingRecordStore()

  const engine: BookingExecutionEngine = {
    events,
    audit,
    reservations,
    sessions,

    expireDueSessions(now = () => Date.now()) {
      const expiredSessions: BookingExecutionSession[] = []
      for (const session of sessions.list()) {
        if (Date.parse(session.expiresAt) > now()) continue
        if (
          session.status === 'expired'
          || session.status === 'cancelled'
          || session.status === 'confirmed'
          || session.status === 'ticketed'
        ) {
          continue
        }
        const next: BookingExecutionSession = {
          ...session,
          status: 'expired',
          updatedAt: new Date(now()).toISOString(),
          bookings: session.bookings.map((b) =>
            isSuccessStatus(b.status) ? b : withBookingStatus(b, 'expired', now),
          ),
        }
        sessions.save(next)
        events.emit(createBookingEvent('BookingExpired', next.id, null, undefined, now))
        audit.record({
          sessionId: next.id,
          action: 'session_expired',
          fromStatus: session.status,
          toStatus: 'expired',
          now,
        })
        expiredSessions.push(next)
      }
      reservations.expireDue()
      return expiredSessions
    },

    async run(input) {
      if (!isBookingExecutionEnabled()) {
        throw new Error('booking_execution_disabled')
      }

      const now = input.now ?? (() => Date.now())
      const started = now()
      const resumeEnabled = isBookingResumeEnabled({ enabled: input.resumeEnabled })
      const txnEnabled = isTransactionManagerEnabled({
        enabled: input.transaction?.enabled,
      })
      const txn = new TransactionManager({
        ...input.transaction,
        enabled: txnEnabled,
        now,
      })
      const executor = input.executor ?? defaultExecutor()
      const canceller = input.canceller ?? defaultCanceller()
      const travelers = input.travelers?.length ? input.travelers : defaultTravelers()
      const conversationId = input.conversationId ?? null
      const generateDocuments = input.generateDocuments !== false
      const collectedEvents: BookingNotificationEvent[] = []
      const emit = (event: BookingNotificationEvent) => {
        collectedEvents.push(event)
        events.emit(event)
      }

      const idempotencyKey =
        input.idempotencyKey
        ?? `auto_${input.userId}_${input.items.map((i) => i.offerId).join('|')}`

      // Idempotent replay
      const existingByKey = sessions.getByIdempotencyKey(idempotencyKey)
      if (existingByKey && !input.resumeSessionId) {
        const terminal =
          existingByKey.status === 'confirmed'
          || existingByKey.status === 'ticketed'
          || existingByKey.status === 'failed'
          || existingByKey.status === 'cancelled'
          || existingByKey.status === 'expired'
        if (terminal || existingByKey.resumeCursor >= existingByKey.items.length) {
          return {
            snapshot: {
              version: 1,
              sessionId: existingByKey.id,
              status: existingByKey.status,
              bookingIds: existingByKey.bookings.map((b) => b.id),
              confirmedCount: existingByKey.bookings.filter((b) => isSuccessStatus(b.status)).length,
              failedCount: existingByKey.bookings.filter((b) => b.status === 'failed').length,
              cancelledCount: existingByKey.bookings.filter((b) => b.status === 'cancelled').length,
              expiredCount: existingByKey.bookings.filter((b) => b.status === 'expired').length,
              domains: existingByKey.items.map((i) => i.domain),
              providerIds: [...new Set(existingByKey.items.map((i) => i.providerId))],
              durationMs: now() - started,
              resumed: false,
              rolledBack: false,
              idempotentReplay: true,
            },
            session: existingByKey,
            bookings: existingByKey.bookings,
            events: collectedEvents,
            audit: audit.list(existingByKey.id),
            executionFacts: [
              ...buildFacts(existingByKey, false),
              'Idempotent replay — prior booking session returned',
            ],
          }
        }
      }

      let session: BookingExecutionSession
      let resumed = false

      if (input.resumeSessionId && resumeEnabled) {
        const prior = sessions.get(input.resumeSessionId)
        if (!prior) throw new Error('session_not_found')
        session = prior
        resumed = true
        audit.record({
          sessionId: session.id,
          action: 'session_resumed',
          fromStatus: session.status,
          toStatus: session.status,
          now,
        })
      } else if (existingByKey && resumeEnabled && existingByKey.resumeCursor < existingByKey.items.length) {
        session = existingByKey
        resumed = true
      } else {
        const sessionId = input.sessionId ?? createId('bxs')
        session = {
          id: sessionId,
          userId: input.userId,
          status: 'draft',
          items: input.items.map((item) => ({ ...item })),
          bookings: [],
          travelers,
          idempotencyKey,
          createdAt: new Date(now()).toISOString(),
          updatedAt: new Date(now()).toISOString(),
          expiresAt: new Date(now() + (input.expiresInMs ?? 30 * 60_000)).toISOString(),
          lastError: null,
          completedDomains: [],
          failedDomains: [],
          resumeCursor: 0,
          allOrNothing: input.allOrNothing ?? false,
        }
        sessions.save(session)
        emit(createBookingEvent('BookingCreated', session.id, null, { itemCount: session.items.length }, now))
        audit.record({
          sessionId: session.id,
          action: 'session_created',
          fromStatus: null,
          toStatus: 'draft',
          now,
        })
      }

      // Expire check
      if (Date.parse(session.expiresAt) <= now()) {
        session = {
          ...session,
          status: 'expired',
          updatedAt: new Date(now()).toISOString(),
        }
        sessions.save(session)
        emit(createBookingEvent('BookingExpired', session.id, null, undefined, now))
        return finalize(session, collectedEvents, audit, now, started, resumed, false, true)
      }

      assertTransition(session.status === 'draft' ? 'draft' : session.status, 'pending')
      session = {
        ...session,
        status: 'pending',
        updatedAt: new Date(now()).toISOString(),
      }
      sessions.save(session)
      emit(createBookingEvent('BookingPending', session.id, null, undefined, now))

      let rolledBack = false
      const successfulConfirmations: Array<{
        providerId: string
        confirmationId: string
        bookingId: string
      }> = []

      for (let index = session.resumeCursor; index < session.items.length; index += 1) {
        const item = session.items[index]!
        const provider = resolveProvider(input.registry, item)
        if (!provider) {
          const failed = normalizeProviderBooking({
            sessionId: session.id,
            conversationId,
            domain: item.domain,
            providerId: item.providerId,
            offerId: item.offerId,
            status: 'failed',
            travelers,
            pricing: item.price,
            now,
            raw: { error: 'provider_unavailable' },
          })
          records.upsertFromUnified(failed)
          session = appendBooking(session, failed, index, false)
          sessions.save(session)
          emit(createBookingEvent('BookingFailed', session.id, failed.id, { domain: item.domain }, now))
          audit.record({
            sessionId: session.id,
            bookingId: failed.id,
            provider: item.providerId,
            action: 'book_failed',
            error: 'provider_unavailable',
            fromStatus: 'pending',
            toStatus: 'failed',
            now,
          })
          if (session.allOrNothing) {
            rolledBack = await rollbackSuccesses({
              successfulConfirmations,
              registry: input.registry,
              canceller,
              session,
              sessions,
              audit,
              events: emit,
              now,
              txn,
              records,
            })
            break
          }
          continue
        }

        const attempt = await txn.runWithRetry(
          `book:${item.domain}:${item.offerId}`,
          async (_attempt, signal) => {
            const merged = input.signal
              ? abortAny([input.signal, signal])
              : signal
            return executor({
              provider,
              offerId: item.offerId,
              signal: merged,
              travelers,
              conversationId,
              checkIn: item.domain === 'hotels' ? (item.offer?.raw as { checkIn?: string } | undefined)?.checkIn ?? null : null,
              checkOut: item.domain === 'hotels' ? (item.offer?.raw as { checkOut?: string } | undefined)?.checkOut ?? null : null,
              roomType: item.domain === 'hotels' ? item.offer?.seatType ?? null : null,
            })
          },
          {
            signal: input.signal,
            idempotencyKey: `${idempotencyKey}:${item.offerId}`,
          },
        )

        if (!attempt.ok || !attempt.value.ok || !attempt.value.confirmationId) {
          const error =
            (!attempt.ok ? attempt.error : attempt.value.error) || 'book_failed'
          const failed = normalizeProviderBooking({
            sessionId: session.id,
            conversationId,
            domain: item.domain,
            providerId: item.providerId,
            offerId: item.offerId,
            status: 'failed',
            travelers,
            pricing: item.price,
            now,
            order: attempt.ok ? attempt.value.order : undefined,
            raw: {
              error,
              attempts: attempt.attempts,
              errorCode: attempt.ok ? attempt.value.errorCode : undefined,
              timedOut: !attempt.ok ? attempt.timedOut : false,
            },
          })
          records.upsertFromUnified(failed)
          logProviderRequest({
            requestId: createProviderRequestId('bex'),
            provider: item.providerId,
            operation: 'book',
            durationMs: attempt.latencyMs,
            status: 'failed',
            bookingId: failed.id,
            providerReference: null,
            detail: error,
          })
          session = appendBooking(session, failed, index, false)
          sessions.save(session)
          emit(createBookingEvent('BookingFailed', session.id, failed.id, { error }, now))
          audit.record({
            sessionId: session.id,
            bookingId: failed.id,
            provider: item.providerId,
            latencyMs: attempt.latencyMs,
            action: 'book_failed',
            error,
            fromStatus: 'pending',
            toStatus: 'failed',
            detail: { attempts: attempt.attempts, timedOut: !attempt.ok ? attempt.timedOut : false },
            now,
          })
          if (session.allOrNothing) {
            rolledBack = await rollbackSuccesses({
              successfulConfirmations,
              registry: input.registry,
              canceller,
              session,
              sessions,
              audit,
              events: emit,
              now,
              txn,
              records,
            })
            break
          }
          // Partial failure recovery — continue remaining independent bookings.
          continue
        }

        const reservation = reservations.create({
          bookingId: 'pending',
          providerId: item.providerId,
          domain: item.domain,
          providerReference: attempt.value.confirmationId,
          expiresInMs: 20 * 60_000,
          status: 'confirmed',
        })

        let booking = normalizeProviderBooking({
          sessionId: session.id,
          conversationId,
          domain: item.domain,
          providerId: item.providerId,
          offerId: item.offerId,
          confirmationId: attempt.value.confirmationId,
          reservationId: reservation.reservationId,
          status: 'confirmed',
          travelers,
          pricing: item.price,
          title: item.title,
          now,
          expiresAt: reservation.expiresAt,
          order: attempt.value.order,
          raw: attempt.value,
        })
        // Flights advance to ticketed when confirmation succeeds.
        if (item.domain === 'flights') {
          booking = withBookingStatus(booking, 'ticketed', now)
        }

        reservations.setStatus(reservation.reservationId, booking.status)
        // Fix reservation bookingId now that we have the id
        reservations.hydrate(
          reservations.snapshot().map((r) =>
            r.reservationId === reservation.reservationId
              ? { ...r, bookingId: booking.id }
              : r,
          ),
        )

        records.upsertFromUnified(booking)
        logProviderRequest({
          requestId: createProviderRequestId('bex'),
          provider: item.providerId,
          operation: 'book',
          durationMs: attempt.latencyMs,
          status: booking.status,
          bookingId: booking.id,
          providerReference: booking.providerBookingId ?? booking.confirmation,
        })

        session = appendBooking(session, booking, index, true)
        sessions.save(session)
        successfulConfirmations.push({
          providerId: item.providerId,
          confirmationId: attempt.value.confirmationId,
          bookingId: booking.id,
        })
        txn.pushRollback(async () => {
          await canceller({
            provider,
            confirmationId: attempt.value.confirmationId!,
            signal: input.signal,
          })
        })

        emit(createBookingEvent('BookingConfirmed', session.id, booking.id, {
          domain: item.domain,
          confirmation: booking.confirmation,
        }, now))
        audit.record({
          sessionId: session.id,
          bookingId: booking.id,
          provider: item.providerId,
          latencyMs: attempt.latencyMs,
          action: 'book_confirmed',
          fromStatus: 'pending',
          toStatus: booking.status,
          detail: { attempts: attempt.attempts, pnr: booking.pnr },
          now,
        })
      }

      txn.clearRollbacks()
      session = {
        ...session,
        status: rolledBack
          ? 'failed'
          : sessionStatusFromBookings(session.bookings),
        updatedAt: new Date(now()).toISOString(),
      }
      if (!rolledBack && (session.status === 'confirmed' || session.status === 'ticketed')) {
        if (generateDocuments) {
          const bundle = generateBookingDocuments({
            sessionId: session.id,
            bookings: session.bookings.filter((b) => isSuccessStatus(b.status)),
            travelerName: travelers[0]
              ? `${travelers[0].firstName} ${travelers[0].lastName}`.trim()
              : undefined,
            now,
          })
          session = {
            ...session,
            bookings: session.bookings.map((booking) => {
              if (!isSuccessStatus(booking.status)) return booking
              const related = bundle.documents.filter(
                (d) => !d.relatedTicketId
                  || bundle.tickets.some(
                    (t) => t.bookingId === booking.id && t.documentIds.includes(d.id),
                  ),
              )
              const docs = [
                ...booking.documents,
                ...related.map((d) => ({
                  id: d.id,
                  type:
                    d.kind === 'eticket'
                      ? 'eticket' as const
                      : d.kind === 'voucher'
                        ? 'voucher' as const
                        : d.kind === 'invoice'
                          ? 'invoice' as const
                          : 'other' as const,
                  url: d.downloadUrl,
                  label: d.label,
                })),
              ]
              const next = { ...booking, documents: docs }
              records.upsertFromUnified(next)
              return next
            }),
          }
        }
        emit(createBookingEvent('BookingCompleted', session.id, null, {
          bookingCount: session.bookings.length,
        }, now))
      }
      sessions.save(session)
      return finalize(session, collectedEvents, audit, now, started, resumed, rolledBack, false)
    },
  }

  return engine
}

function resolveProvider(
  registry: BookingProviderRegistry,
  item: BookingExecutionLineItem,
) {
  const direct = registry.get(item.providerId)
  if (direct && direct.isAvailable()) return direct
  const domain = toBookingProviderDomain(item.domain)
  return registry.route(domain).find((p) => p.providerId === item.providerId)
    ?? registry.route(domain)[0]
}

function appendBooking(
  session: BookingExecutionSession,
  booking: UnifiedBooking,
  index: number,
  success: boolean,
): BookingExecutionSession {
  const bookings = [...session.bookings.filter((b) => b.offerId !== booking.offerId), booking]
  return {
    ...session,
    bookings,
    resumeCursor: index + 1,
    updatedAt: booking.updatedAt,
    completedDomains: success
      ? [...new Set([...session.completedDomains, booking.domain])]
      : session.completedDomains,
    failedDomains: success
      ? session.failedDomains
      : [...new Set([...session.failedDomains, booking.domain])],
    lastError: success ? session.lastError : (booking.raw as { error?: string } | undefined)?.error ?? session.lastError,
  }
}

async function rollbackSuccesses(input: {
  successfulConfirmations: Array<{ providerId: string; confirmationId: string; bookingId: string }>
  registry: BookingProviderRegistry
  canceller: BookingCancellerFn
  session: BookingExecutionSession
  sessions: BookingSessionStore
  audit: BookingAuditTrail
  events: (event: BookingNotificationEvent) => void
  now: () => number
  txn: TransactionManager
  records?: BookingRecordStore
}): Promise<boolean> {
  const result = await input.txn.rollbackAll()
  // Also cancel via canceller for any still listed
  for (const row of input.successfulConfirmations) {
    const provider = input.registry.get(row.providerId)
    if (!provider) continue
    try {
      await input.canceller({
        provider,
        confirmationId: row.confirmationId,
      })
    } catch {
      /* best-effort */
    }
  }

  const bookings = input.session.bookings.map((b) => {
    if (!isSuccessStatus(b.status)) return b
    return withBookingStatus(b, 'cancelled', input.now)
  })
  for (const booking of bookings) input.records?.upsertFromUnified(booking)
  const session: BookingExecutionSession = {
    ...input.session,
    bookings,
    status: 'failed',
    updatedAt: new Date(input.now()).toISOString(),
    lastError: 'all_or_nothing_rollback',
  }
  input.sessions.save(session)
  input.events(createBookingEvent('BookingCancelled', session.id, null, {
    rolledBack: result.rolledBack,
  }, input.now))
  input.audit.record({
    sessionId: session.id,
    action: 'rollback',
    fromStatus: 'pending',
    toStatus: 'failed',
    detail: { rolledBack: result.rolledBack, errors: result.errors },
    now: input.now,
  })
  // mutate caller's session reference via sessions store — orchestrator reloads
  Object.assign(input.session, session)
  return true
}

function finalize(
  session: BookingExecutionSession,
  collectedEvents: BookingNotificationEvent[],
  audit: BookingAuditTrail,
  now: () => number,
  started: number,
  resumed: boolean,
  rolledBack: boolean,
  idempotentReplay: boolean,
): BookingExecutionResult {
  return {
    snapshot: {
      version: 1,
      sessionId: session.id,
      status: session.status,
      bookingIds: session.bookings.map((b) => b.id),
      confirmedCount: session.bookings.filter((b) => isSuccessStatus(b.status)).length,
      failedCount: session.bookings.filter((b) => b.status === 'failed').length,
      cancelledCount: session.bookings.filter((b) => b.status === 'cancelled').length,
      expiredCount: session.bookings.filter((b) => b.status === 'expired').length,
      domains: session.items.map((i) => i.domain),
      providerIds: [...new Set(session.items.map((i) => i.providerId))],
      durationMs: now() - started,
      resumed,
      rolledBack,
      idempotentReplay,
    },
    session,
    bookings: session.bookings,
    events: collectedEvents,
    audit: audit.list(session.id),
    executionFacts: buildFacts(session, rolledBack),
  }
}

function abortAny(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}

let defaultEngine: BookingExecutionEngine | null = null

export function getDefaultBookingExecutionEngine(): BookingExecutionEngine {
  if (!defaultEngine) defaultEngine = createBookingExecutionEngine()
  return defaultEngine
}

export function resetDefaultBookingExecutionEngine(): void {
  defaultEngine = null
}

export async function runBookingExecution(
  input: RunBookingExecutionInput,
): Promise<BookingExecutionResult> {
  return getDefaultBookingExecutionEngine().run(input)
}
