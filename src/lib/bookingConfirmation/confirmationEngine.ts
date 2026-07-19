/**
 * Booking Confirmation Engine — provider-independent lifecycle.
 * Mutates BookingSession via orchestrator; never imports Amadeus HTTP clients.
 */

import {
  getBookingOrchestrator,
  resolveBookingReference,
  syncBookingSession,
  upsertLocalBookingSession,
  type BookingSession,
  type BookingStatus,
} from '../booking'
import { getSupplierAdapter, type SupplierId } from '../supplierAdapters'
import type {
  ConfirmBookingInput,
  ConfirmBookingResult,
  ConfirmationState,
  ConfirmationStatus,
} from './types'
import { resolveConfirmationReference } from './confirmationReference'
import { buildConfirmationTimeline } from './confirmationTimeline'

const META_KEY = 'bookingConfirmation'

function nowIso(): string {
  return new Date().toISOString()
}

function mapSessionToConfirmationStatus(status: BookingStatus): ConfirmationStatus {
  switch (status) {
    case 'confirmed':
      return 'confirmed'
    case 'failed':
      return 'failed'
    case 'cancelled':
    case 'expired':
      return 'cancelled'
    default:
      return 'pending'
  }
}

function readStoredState(session: BookingSession): ConfirmationState | null {
  const item = session.items[0]
  const raw = item?.metadata?.[META_KEY]
  if (!raw || typeof raw !== 'object') return null
  return raw as ConfirmationState
}

export function confirmationStateFromSession(session: BookingSession): ConfirmationState {
  const stored = readStoredState(session)
  if (stored) {
    return {
      ...stored,
      events: buildConfirmationTimeline({
        createdAt: session.createdAt,
        status: stored.status,
        pendingAt: stored.pendingAt,
        confirmingAt: stored.confirmingAt,
        confirmedAt: stored.confirmedAt,
        failedAt: stored.failedAt,
        cancelledAt: stored.cancelledAt,
        ticketPending: stored.ticketPending,
      }),
    }
  }

  const status = mapSessionToConfirmationStatus(session.status)
  const pendingAt = session.redirectedAt ?? session.updatedAt
  const state: ConfirmationState = {
    status,
    confirmationReference: resolveConfirmationReference({
      sessionId: session.id,
      supplierReference: session.providerReferences[0]?.providerBookingReference,
      existing: typeof session.items[0]?.metadata?.bookingReference === 'string'
        ? String(session.items[0].metadata.bookingReference)
        : null,
    }),
    sessionId: session.id,
    supplierId: session.providerReferences[0]?.providerId ?? null,
    supplierReference: session.providerReferences[0]?.providerBookingReference ?? null,
    events: [],
    pendingAt: status === 'pending' ? pendingAt : null,
    confirmingAt: null,
    confirmedAt: session.confirmedAt,
    failedAt: null,
    cancelledAt: status === 'cancelled' ? session.updatedAt : null,
    lastError: null,
    ticketPending: false,
  }
  state.events = buildConfirmationTimeline(state)
  return state
}

function writeStateToSession(sessionId: string, state: ConfirmationState): BookingSession | null {
  const orch = getBookingOrchestrator()
  const session = orch.getBookingSession(sessionId)
  if (!session) return null
  const item = session.items[0]
  if (!item) return session
  return orch.updateBookingItem(sessionId, item.id, {
    metadata: {
      ...item.metadata,
      [META_KEY]: state,
      bookingReference: state.confirmationReference,
      confirmationReference: state.confirmationReference,
      confirmationStatus: state.status,
      sprint: Math.max(Number(item.metadata.sprint ?? 0), 14),
    },
  })
}

function emptyFailedState(sessionId: string, error: string): ConfirmationState {
  const failedAt = nowIso()
  const state: ConfirmationState = {
    status: 'failed',
    confirmationReference: resolveConfirmationReference({ sessionId }),
    sessionId,
    supplierId: null,
    supplierReference: null,
    events: [],
    pendingAt: null,
    confirmingAt: null,
    confirmedAt: null,
    failedAt,
    cancelledAt: null,
    lastError: error,
    ticketPending: false,
  }
  state.events = buildConfirmationTimeline(state)
  return state
}

export async function startConfirmation(input: ConfirmBookingInput): Promise<ConfirmBookingResult> {
  const orch = getBookingOrchestrator()
  let session = orch.getBookingSession(input.sessionId)
  if (!session || session.userId !== input.userId) {
    return {
      ok: false,
      sessionId: input.sessionId,
      error: 'Booking session not found',
      state: emptyFailedState(input.sessionId, 'Booking session not found'),
    }
  }

  if (session.status === 'cancelled' || session.status === 'expired') {
    const state = confirmationStateFromSession(session)
    return { ok: false, sessionId: session.id, error: 'Booking is cancelled', state }
  }

  if (session.status === 'confirmed') {
    return { ok: true, sessionId: session.id, error: null, state: confirmationStateFromSession(session) }
  }

  const fromStatus = session.status
  const confirmingAt = nowIso()
  let state: ConfirmationState = {
    ...confirmationStateFromSession(session),
    status: 'confirming',
    confirmingAt,
    pendingAt: session.redirectedAt ?? session.updatedAt,
    lastError: null,
  }
  state.events = buildConfirmationTimeline(state)
  session = writeStateToSession(session.id, state) ?? session
  await syncBookingSession(session, fromStatus)
  upsertLocalBookingSession(session)

  const flight = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  const payload =
    flight?.metadata.bookingPayload && typeof flight.metadata.bookingPayload === 'object'
      ? (flight.metadata.bookingPayload as Record<string, unknown>)
      : null
  const passengers = Array.isArray(flight?.metadata.passengers)
    ? (flight!.metadata.passengers as Array<Record<string, unknown>>)
    : []

  const supplierId = (input.supplierId ?? 'amadeus') as SupplierId
  const adapter = getSupplierAdapter(supplierId)
  const adapterResult = await adapter.confirmBooking({
    sessionId: session.id,
    offerId: flight?.providerOfferId ?? session.id,
    bookingPayload: payload,
    passengers,
    currency: session.currency,
    amount: session.total,
    temporaryReference: resolveBookingReference(session),
    forceFail: input.forceFail,
  })

  if (!adapterResult.success) {
    const failedAt = nowIso()
    state = {
      ...state,
      status: 'failed',
      failedAt,
      supplierId: adapter.supplierId,
      supplierReference: null,
      lastError: adapterResult.message,
      ticketPending: false,
    }
    state.events = buildConfirmationTimeline(state)
    orch.markBookingConfirmationFailed(session.id)
    session = writeStateToSession(session.id, state) ?? session
    await syncBookingSession(session, fromStatus)
    upsertLocalBookingSession(session)
    return { ok: false, sessionId: session.id, error: adapterResult.message, state }
  }

  const confirmedAt = nowIso()
  const confirmationReference = resolveConfirmationReference({
    sessionId: session.id,
    supplierReference: adapterResult.supplierReference,
    existing: state.confirmationReference,
  })
  state = {
    ...state,
    status: 'confirmed',
    confirmedAt,
    failedAt: null,
    confirmationReference,
    supplierId: adapter.supplierId,
    supplierReference: adapterResult.supplierReference,
    lastError: null,
    ticketPending: true,
  }
  state.events = buildConfirmationTimeline(state)

  orch.markBookingConfirmed(session.id, {
    providerId: adapter.supplierId,
    providerReference: adapterResult.supplierReference,
    confirmedAt,
  })
  session = writeStateToSession(session.id, state) ?? session
  await syncBookingSession(session, fromStatus)
  upsertLocalBookingSession(session)

  return {
    ok: true,
    sessionId: session.id,
    error: null,
    state: confirmationStateFromSession(session),
  }
}

export async function retryConfirmation(input: ConfirmBookingInput): Promise<ConfirmBookingResult> {
  const orch = getBookingOrchestrator()
  const session = orch.getBookingSession(input.sessionId)
  if (session && session.status === 'failed') {
    orch.resetBookingConfirmationPending(session.id)
  }
  return startConfirmation({ ...input, forceFail: input.forceFail })
}
