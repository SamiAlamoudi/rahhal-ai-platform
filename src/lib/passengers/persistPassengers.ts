/**
 * Persist passengers onto a booking session (resume-safe).
 */

import {
  getBookingOrchestrator,
  syncBookingSession,
  upsertLocalBookingSession,
  getLocalBookingSession,
  loadBookingSession,
  type BookingSession,
} from '../booking'
import type { Passenger, TravellerCounts } from './types'
import { buildFareBreakdown } from './fareBreakdown'
import {
  countPassengers,
  normalizeTravellerCounts,
  passengerSummaryLine,
} from './createPassengerSlots'
import { normalizePassengerCountries } from './validatePassenger'

const DRAFT_PREFIX = 'rahhal_passenger_draft_v1:'
/** In-memory fallback when localStorage is unavailable (tests / SSR). */
const memoryDrafts = new Map<string, string>()

export interface PersistPassengersInput {
  sessionId: string
  passengers: Passenger[]
  counts: TravellerCounts
  /** Mark passengers as complete after successful validation. */
  passengersComplete?: boolean
}

export interface PersistPassengersResult {
  session: BookingSession
  itemId: string
}

function draftKey(sessionId: string): string {
  return `${DRAFT_PREFIX}${sessionId}`
}

function draftSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
      return
    }
  } catch {
    // fall through to memory
  }
  memoryDrafts.set(key, value)
}

function draftGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key)
    }
  } catch {
    // fall through
  }
  return memoryDrafts.get(key) ?? null
}

function draftRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
  memoryDrafts.delete(key)
}

export function savePassengerDraft(sessionId: string, passengers: Passenger[]): void {
  draftSet(draftKey(sessionId), JSON.stringify({ passengers, savedAt: Date.now() }))
}

export function loadPassengerDraft(sessionId: string): Passenger[] | null {
  try {
    const raw = draftGet(draftKey(sessionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { passengers?: Passenger[] }
    return Array.isArray(parsed.passengers) ? parsed.passengers : null
  } catch {
    return null
  }
}

export function clearPassengerDraft(sessionId: string): void {
  draftRemove(draftKey(sessionId))
}

export function readPassengersFromSession(session: BookingSession): Passenger[] | null {
  const item = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  if (!item) return null
  const raw = item.metadata.passengers
  if (!Array.isArray(raw) || raw.length === 0) return null
  return raw as Passenger[]
}

export function readCountsFromSession(session: BookingSession): TravellerCounts {
  const item = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  const placeholder = (item?.metadata.travellersPlaceholder ?? {}) as Partial<TravellerCounts>
  return normalizeTravellerCounts({
    adults: Number(placeholder.adults ?? 1),
    children: Number(placeholder.children ?? 0),
    infants: Number(placeholder.infants ?? 0),
    total: Number(placeholder.total ?? 1),
  })
}

export async function resolveBookingSession(
  sessionId: string,
  userId: string,
): Promise<BookingSession | null> {
  const orchestrator = getBookingOrchestrator()
  const cached = orchestrator.getBookingSession(sessionId)
  if (cached?.userId === userId) return cached

  const loaded = await loadBookingSession(sessionId, userId)
  if (loaded) {
    orchestrator.importSession(loaded)
    return loaded
  }

  const local = getLocalBookingSession(sessionId, userId)
  if (local) {
    orchestrator.importSession(local)
    return local
  }
  return null
}

/**
 * Write passengers + pricing + booking payload into the flight item metadata.
 * Updates travelerSummary and syncs durable storage for refresh resume.
 */
export async function persistPassengersToSession(
  input: PersistPassengersInput,
): Promise<PersistPassengersResult> {
  const orchestrator = getBookingOrchestrator()
  const session = orchestrator.getBookingSession(input.sessionId)
  if (!session) {
    throw new Error('Booking session not found')
  }

  const item = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  if (!item) {
    throw new Error('Booking session has no items')
  }

  const normalizedPassengers = input.passengers.map(normalizePassengerCountries)
  const counts = countPassengers(normalizedPassengers)
  const expected = normalizeTravellerCounts(input.counts)
  const breakdown = buildFareBreakdown(item.price, item.currency, { fees: session.fees })
  const existingPayload =
    item.metadata.bookingPayload && typeof item.metadata.bookingPayload === 'object'
      ? (item.metadata.bookingPayload as Record<string, unknown>)
      : {}

  const updated = orchestrator.updateBookingItem(input.sessionId, item.id, {
    travelerSummary: passengerSummaryLine(counts),
    metadata: {
      ...item.metadata,
      sprint: 12,
      passengers: normalizedPassengers,
      travellersPlaceholder: expected,
      passengersComplete: Boolean(input.passengersComplete),
      pricing: {
        amount: item.price,
        currency: item.currency,
        fare: breakdown.fare,
        taxes: breakdown.taxes,
        fees: breakdown.fees,
        grandTotal: breakdown.grandTotal,
        taxRate: breakdown.taxRate,
      },
      bookingPayload: {
        ...existingPayload,
        passengers: normalizedPassengers,
        travellers: expected,
        pricing: breakdown,
        sessionId: session.id,
      },
      sessionId: session.id,
    },
  })

  if (!updated) {
    throw new Error(orchestrator.getLastError() || 'Failed to persist passengers')
  }

  await syncBookingSession(updated, session.status)
  upsertLocalBookingSession(updated)
  savePassengerDraft(input.sessionId, normalizedPassengers)

  if (input.passengersComplete) {
    clearPassengerDraft(input.sessionId)
  }

  return { session: updated, itemId: item.id }
}
