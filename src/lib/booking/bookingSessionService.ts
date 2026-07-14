/**
 * Bridges BookingOrchestrator (in-memory) with Supabase booking_* tables.
 * No payment / checkout — selection persistence and confirmation only.
 */

import type { FlightOffer } from '../../utils/contracts/models/flight'
import type { HotelOffer } from '../../utils/contracts/models/hotel'
import type { TripTravelSummary } from '../../utils/tripPlanner'
import type { BookingItem, BookingSession, BookingStatus } from './bookingTypes'
import {
  getBookingOrchestrator,
  type BookingOrchestrator,
} from './bookingOrchestrator'
import {
  flightOfferToBookingItemInput,
  hotelOfferToBookingItemInput,
} from './bookingOfferMappers'
import { bookingSessionRepository } from '../repositories/bookingSessionRepository'
import { bookingItemRepository } from '../repositories/bookingItemRepository'
import { bookingEventRepository } from '../repositories/bookingEventRepository'
import type { BookingSessionRow, BookingItemRow } from '../types'

export interface CreateTripBookingInput {
  userId: string
  travelSessionId: string | null
  flight: FlightOffer
  hotel: HotelOffer
  summary: TripTravelSummary
  /** Injected for tests; defaults to singleton orchestrator. */
  orchestrator?: BookingOrchestrator
  persist?: boolean
}

export interface CreateTripBookingResult {
  session: BookingSession | null
  error: string | null
  persisted: boolean
}

function sessionItemsJson(session: BookingSession): unknown {
  return session.items
}

function providerReferencesJson(session: BookingSession): unknown {
  return session.providerReferences
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function bookingItemFromRow(row: BookingItemRow): BookingItem {
  return {
    id: row.id,
    type: row.type as BookingItem['type'],
    providerId: row.provider_id,
    providerName: row.provider_name,
    providerOfferId: row.provider_offer_id,
    title: row.title,
    price: Number(row.price),
    currency: row.currency,
    bookingUrl: row.booking_url,
    bookingMode: row.booking_mode as BookingItem['bookingMode'],
    expiresAt: row.expires_at,
    travelerSummary: row.traveler_summary,
    selectedAt: row.selected_at,
    metadata: row.metadata ?? {},
  }
}

export function bookingSessionFromRow(
  row: BookingSessionRow,
  itemRows: BookingItemRow[] = [],
): BookingSession {
  const itemsFromRows = itemRows.map(bookingItemFromRow)
  const itemsFromJson = Array.isArray(row.items)
    ? (row.items as BookingItem[])
    : []
  const items = itemsFromRows.length > 0 ? itemsFromRows : itemsFromJson
  const providerReferences = Array.isArray(row.provider_references)
    ? (row.provider_references as BookingSession['providerReferences'])
    : []

  return {
    id: row.id,
    userId: row.user_id,
    travelSessionId: row.travel_session_id,
    status: row.status as BookingStatus,
    items,
    subtotal: Number(row.subtotal),
    fees: Number(row.fees),
    total: Number(row.total),
    currency: row.currency,
    selectedBookingMode: row.selected_booking_mode as BookingSession['selectedBookingMode'],
    providerReferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    redirectedAt: row.redirected_at,
    confirmedAt: row.confirmed_at,
  }
}

async function persistSession(
  session: BookingSession,
): Promise<void> {
  await bookingSessionRepository.create({
    id: session.id,
    travel_session_id: isUuid(session.travelSessionId) ? session.travelSessionId : null,
    status: session.status,
    items: sessionItemsJson(session),
    subtotal: session.subtotal,
    fees: session.fees,
    total: session.total,
    currency: session.currency,
    selected_booking_mode: session.selectedBookingMode,
    provider_references: providerReferencesJson(session),
    expires_at: session.expiresAt,
    confirmed_at: session.confirmedAt,
  })

  for (const item of session.items) {
    await bookingItemRepository.create({
      id: item.id,
      booking_session_id: session.id,
      type: item.type,
      provider_id: item.providerId,
      provider_name: item.providerName,
      provider_offer_id: item.providerOfferId,
      title: item.title,
      price: item.price,
      currency: item.currency,
      booking_url: item.bookingUrl,
      booking_mode: item.bookingMode,
      expires_at: item.expiresAt,
      traveler_summary: item.travelerSummary,
      selected_at: item.selectedAt,
      metadata: item.metadata,
    })
  }

  await bookingEventRepository.create({
    booking_session_id: session.id,
    event_type: 'items_selected',
    from_status: 'draft',
    to_status: session.status,
    details: {
      flightOfferId: session.items.find((i) => i.type === 'flight')?.providerOfferId ?? null,
      hotelOfferId: session.items.find((i) => i.type === 'hotel')?.providerOfferId ?? null,
      total: session.total,
      currency: session.currency,
    },
  })
}

/**
 * Create an in-memory booking session with one flight + one hotel,
 * then persist to Supabase (unless persist=false).
 */
export async function createTripBookingSession(
  input: CreateTripBookingInput,
): Promise<CreateTripBookingResult> {
  const orchestrator = input.orchestrator ?? getBookingOrchestrator()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const draft = orchestrator.createBookingSession({
    userId: input.userId,
    travelSessionId: input.travelSessionId,
    currency: input.summary.currency || 'SAR',
    expiresAt,
  })

  const flightResult = orchestrator.addBookingItem(
    draft.id,
    flightOfferToBookingItemInput(input.flight, input.summary),
  )
  if (flightResult.error || !flightResult.session) {
    return { session: null, error: flightResult.error ?? 'Failed to add flight', persisted: false }
  }

  const hotelResult = orchestrator.addBookingItem(
    draft.id,
    hotelOfferToBookingItemInput(input.hotel, input.summary),
  )
  if (hotelResult.error || !hotelResult.session) {
    return { session: null, error: hotelResult.error ?? 'Failed to add hotel', persisted: false }
  }

  const session = hotelResult.session
  const shouldPersist = input.persist !== false

  if (!shouldPersist) {
    return { session, error: null, persisted: false }
  }

  try {
    await persistSession(session)
    return { session, error: null, persisted: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to persist booking session'
    return { session, error: message, persisted: false }
  }
}

export async function loadTripBookingSession(
  bookingSessionId: string,
  orchestrator: BookingOrchestrator = getBookingOrchestrator(),
): Promise<{ session: BookingSession | null; error: string | null }> {
  const cached = orchestrator.getBookingSession(bookingSessionId)
  if (cached) {
    return { session: cached, error: null }
  }

  try {
    const row = await bookingSessionRepository.getById(bookingSessionId)
    if (!row) {
      return { session: null, error: 'Booking session not found' }
    }
    const itemRows = await bookingItemRepository.listBySession(bookingSessionId)
    const session = bookingSessionFromRow(row, itemRows)
    return { session: orchestrator.importSession(session), error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load booking session'
    return { session: null, error: message }
  }
}

export async function confirmTripBookingSelection(
  bookingSessionId: string,
  orchestrator: BookingOrchestrator = getBookingOrchestrator(),
): Promise<{ session: BookingSession | null; error: string | null }> {
  const loaded = await loadTripBookingSession(bookingSessionId, orchestrator)
  if (!loaded.session) {
    return loaded
  }

  const confirmed = orchestrator.confirmSelection(bookingSessionId)
  if (!confirmed) {
    return { session: null, error: orchestrator.getLastError() ?? 'Confirm failed' }
  }

  try {
    await bookingSessionRepository.update(bookingSessionId, {
      status: confirmed.status,
      confirmed_at: confirmed.confirmedAt,
      items: sessionItemsJson(confirmed),
      subtotal: confirmed.subtotal,
      fees: confirmed.fees,
      total: confirmed.total,
    })
    await bookingEventRepository.create({
      booking_session_id: bookingSessionId,
      event_type: 'selection_confirmed',
      from_status: 'selected',
      to_status: confirmed.status,
      details: {
        confirmedAt: confirmed.confirmedAt,
        total: confirmed.total,
        currency: confirmed.currency,
      },
    })
    return { session: confirmed, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to persist confirmation'
    return { session: confirmed, error: message }
  }
}
