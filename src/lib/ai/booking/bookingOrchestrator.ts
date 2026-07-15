/**
 * Phase AE — Booking Orchestrator v1.
 *
 * Coordinates flight / hotel / activity / transportation reservations with:
 * validate → reserve → simulate payment → confirm, plus rollback on failure.
 *
 * Additive AI-layer orchestrator. Does not modify ProviderAdapter contracts
 * or replace src/lib/booking session APIs.
 */

import type { Itinerary } from '../itinerary/models'
import { BookingIdempotencyStore } from './idempotency'
import {
  canTransitionBookingState,
  type Booking,
  type BookingItem,
  type BookingItemKind,
  type BookingItineraryInput,
  type BookingPipelineOptions,
  type BookingState,
  type BookingSummary,
  type BookingTimeline,
  type BookingTimelineEvent,
  type CreateBookingInput,
} from './models'
import { simulatePayment } from './paymentSimulator'
import { DEFAULT_BOOKING_RETRY_POLICY, withBookingRetry, type RetryPolicy } from './retry'

let bookingSeq = 0
let itemSeq = 0
let eventSeq = 0

function nextBookingId(): string {
  bookingSeq += 1
  return `bk_${String(bookingSeq).padStart(4, '0')}`
}

function nextItemId(kind: BookingItemKind): string {
  itemSeq += 1
  return `bi_${kind}_${String(itemSeq).padStart(4, '0')}`
}

function nextEventId(): string {
  eventSeq += 1
  return `bte_${String(eventSeq).padStart(4, '0')}`
}

function nowIso(clockMs: number): string {
  return new Date(clockMs).toISOString()
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export function resetBookingOrchestratorCounters(): void {
  bookingSeq = 0
  itemSeq = 0
  eventSeq = 0
}

export interface BookingOrchestratorOptions {
  store?: BookingIdempotencyStore
  retryPolicy?: RetryPolicy
  /** Deterministic clock start (ms since epoch). Advances by 1ms per event. */
  clockStartMs?: number
}

export class BookingOrchestrator {
  private readonly store: BookingIdempotencyStore
  private readonly retryPolicy: RetryPolicy
  private clockMs: number

  constructor(options: BookingOrchestratorOptions = {}) {
    this.store = options.store ?? new BookingIdempotencyStore()
    this.retryPolicy = options.retryPolicy ?? { ...DEFAULT_BOOKING_RETRY_POLICY }
    this.clockMs = options.clockStartMs ?? Date.UTC(2026, 6, 15, 12, 0, 0)
  }

  /** Reset in-memory bookings (tests). */
  clear(): void {
    this.store.clear()
  }

  getBooking(id: string): Booking | null {
    return this.store.getById(id)
  }

  getByIdempotencyKey(key: string): Booking | null {
    return this.store.getByKey(key)
  }

  /**
   * Create a draft booking from itinerary input.
   * Idempotent: repeating the same key returns the existing booking.
   */
  createDraft(input: CreateBookingInput): Booking {
    const existing = this.store.getByKey(input.idempotencyKey)
    if (existing) {
      return existing
    }

    const currency = input.currency ?? input.itinerary.currency ?? 'USD'
    const items = this.buildItemsFromItinerary(input.itinerary, currency)
    const subtotal = roundMoney(items.reduce((sum, i) => sum + i.amount, 0))
    const fees = roundMoney(input.fees ?? 0)
    const createdAt = this.tick()

    const booking: Booking = {
      id: nextBookingId(),
      userId: input.userId,
      itineraryId: input.itinerary.id ?? null,
      state: 'draft',
      items,
      currency,
      subtotal,
      fees,
      total: roundMoney(subtotal + fees),
      idempotencyKey: input.idempotencyKey,
      paymentSimulated: false,
      paymentReference: null,
      failureReason: null,
      timeline: [],
      retryCount: 0,
      createdAt,
      updatedAt: createdAt,
      confirmedAt: null,
      cancelledAt: null,
      version: 1,
    }

    this.pushEvent(booking, 'draft', 'booking.created', 'Draft booking created')
    this.store.remember(input.idempotencyKey, booking)
    return structuredClone(booking)
  }

  /** Create a draft booking from a Phase AD Itinerary model. */
  createDraftFromItinerary(
    userId: string,
    itinerary: Itinerary,
    idempotencyKey: string,
  ): Booking {
    const currency = itinerary.costs.currency
    const activities = itinerary.days.flatMap((day) =>
      day.activities
        .filter((a) => a.kind === 'activity' || a.kind === 'meal')
        .map((a) => ({
          id: a.id,
          title: a.title,
          estimatedCost: a.estimatedCost,
          currency,
          day: day.day,
        })),
    )
    const transportation = itinerary.transportation.map((t) => ({
      id: t.id,
      title: `${t.mode}: ${t.from} → ${t.to}`,
      mode: t.mode,
      estimatedCost: t.estimatedCost,
      currency,
      day: t.day,
    }))

    return this.createDraft({
      userId,
      idempotencyKey,
      currency,
      itinerary: {
        id: itinerary.id,
        destination: itinerary.destination,
        destinations: itinerary.destinations,
        durationDays: itinerary.durationDays,
        currency,
        flights: itinerary.flights.map((f) => ({
          id: f.id,
          title: `${f.from} → ${f.to}`,
          from: f.from,
          to: f.to,
          estimatedCost: f.estimatedCost,
          currency,
          direct: f.direct,
        })),
        hotels: itinerary.hotels.map((h) => ({
          id: h.id,
          name: h.name,
          estimatedTotal: h.estimatedTotal,
          currency,
          nights: h.nights,
        })),
        activities,
        transportation,
      },
    })
  }

  /**
   * Full pipeline: validate → reserve → simulate payment → confirm.
   * On failure: rollback reserved resources and mark booking failed.
   */
  async runPipeline(
    bookingId: string,
    options: BookingPipelineOptions = {},
  ): Promise<Booking> {
    const booking = this.requireBooking(bookingId)

    if (booking.state === 'confirmed') {
      return booking
    }
    if (booking.state === 'cancelled') {
      return this.fail(booking, 'Cannot run pipeline on cancelled booking')
    }

    // Idempotent success: already reserved+paid but not confirmed? continue confirm
    this.transition(booking, 'pending', 'booking.pipeline_started', 'Booking pipeline started')

    const validation = this.validateItinerary(booking)
    if (!validation.ok) {
      return this.fail(booking, validation.error ?? 'Validation failed')
    }

    const reserved = await this.reserveResources(booking, options)
    if (!reserved) {
      await this.rollback(booking, 'Reservation failed')
      return this.fail(booking, booking.failureReason ?? 'Reservation failed')
    }

    this.transition(booking, 'reserved', 'booking.reserved', 'All resources reserved')

    const payment = simulatePayment({
      bookingId: booking.id,
      amount: booking.total,
      currency: booking.currency,
      forceFail: options.forcePaymentFail === true,
    })

    booking.paymentSimulated = true
    if (!payment.ok) {
      await this.rollback(booking, payment.error ?? 'Payment failed')
      return this.fail(booking, payment.error ?? 'Payment failed')
    }

    booking.paymentReference = payment.reference
    this.pushEvent(
      booking,
      booking.state,
      'payment.simulated',
      `Mock payment succeeded (${payment.reference})`,
    )
    this.persist(booking)

    return this.confirmBooking(booking.id)
  }

  validateItinerary(booking: Booking): { ok: boolean; error?: string } {
    if (!booking.items.length) {
      return { ok: false, error: 'Itinerary has no bookable items' }
    }
    if (!Number.isFinite(booking.total) || booking.total < 0) {
      return { ok: false, error: 'Invalid booking total' }
    }
    const kinds = new Set(booking.items.map((i) => i.kind))
    // Soft check: at least one travel component
    if (kinds.size === 0) {
      return { ok: false, error: 'No booking item kinds present' }
    }
    for (const item of booking.items) {
      if (!Number.isFinite(item.amount) || item.amount < 0) {
        return { ok: false, error: `Invalid amount for item ${item.id}` }
      }
    }
    this.pushEvent(booking, booking.state, 'itinerary.validated', 'Itinerary validated')
    this.persist(booking)
    return { ok: true }
  }

  async reserveResources(
    booking: Booking,
    options: BookingPipelineOptions = {},
  ): Promise<boolean> {
    const maxRetries = options.maxRetries ?? this.retryPolicy.maxAttempts
    let allOk = true

    for (const item of booking.items) {
      const result = await withBookingRetry(
        { ...this.retryPolicy, maxAttempts: maxRetries },
        (attempt) => {
          item.attempts = attempt
          if (options.forceFailItemId && options.forceFailItemId === item.id) {
            const until = options.failReserveUntilAttempt ?? null
            if (until == null || attempt < until) {
              throw new Error(`Forced reserve failure for ${item.id}`)
            }
          }
          // Deterministic mock reservation reference
          item.reference = `rsv_${item.kind}_${item.id}_a${attempt}`
          item.status = 'reserved'
          item.lastError = null
          return item.reference
        },
      )

      booking.retryCount += Math.max(0, result.attempts - 1)

      if (!result.ok) {
        item.status = 'failed'
        item.lastError = result.error ?? 'Reserve failed'
        item.reference = null
        allOk = false
        this.pushEvent(
          booking,
          booking.state,
          'item.reserve_failed',
          `Failed to reserve ${item.kind} ${item.id}: ${item.lastError}`,
          item.id,
        )
        break
      }

      this.pushEvent(
        booking,
        booking.state,
        'item.reserved',
        `Reserved ${item.kind} ${item.id}`,
        item.id,
      )
    }

    this.persist(booking)
    return allOk
  }

  confirmBooking(bookingId: string): Booking {
    const booking = this.requireBooking(bookingId)
    if (booking.state === 'confirmed') {
      return booking
    }
    if (booking.state !== 'reserved') {
      return this.fail(booking, `Cannot confirm from state ${booking.state}`)
    }
    if (!booking.paymentSimulated || !booking.paymentReference) {
      return this.fail(booking, 'Cannot confirm without simulated payment')
    }

    for (const item of booking.items) {
      if (item.status === 'reserved') {
        item.status = 'confirmed'
      }
    }

    booking.confirmedAt = this.tick()
    this.transition(booking, 'confirmed', 'booking.confirmed', 'Booking confirmed')
    return structuredClone(booking)
  }

  async rollback(booking: Booking, reason: string): Promise<Booking> {
    for (const item of booking.items) {
      if (item.status === 'reserved' || item.status === 'confirmed') {
        item.status = 'rolled_back'
        this.pushEvent(
          booking,
          booking.state,
          'item.rolled_back',
          `Rolled back ${item.kind} ${item.id}`,
          item.id,
        )
      }
    }
    booking.failureReason = reason
    booking.paymentReference = null
    this.pushEvent(booking, booking.state, 'booking.rollback', `Rollback: ${reason}`)
    this.persist(booking)
    return structuredClone(booking)
  }

  cancel(bookingId: string, reason = 'Cancelled by user'): Booking {
    const booking = this.requireBooking(bookingId)
    if (booking.state === 'cancelled') {
      return booking
    }
    if (booking.state === 'confirmed') {
      // Soft cancel after confirm still allowed per AE state graph
      for (const item of booking.items) {
        if (item.status === 'confirmed') item.status = 'cancelled'
      }
    } else {
      for (const item of booking.items) {
        if (item.status === 'reserved') item.status = 'rolled_back'
        else if (item.status !== 'failed') item.status = 'cancelled'
      }
    }
    booking.cancelledAt = this.tick()
    booking.failureReason = reason
    this.transition(booking, 'cancelled', 'booking.cancelled', reason)
    return structuredClone(booking)
  }

  getSummary(bookingId: string): BookingSummary {
    const booking = this.requireBooking(bookingId)
    return {
      bookingId: booking.id,
      state: booking.state,
      itemCount: booking.items.length,
      reservedCount: booking.items.filter((i) => i.status === 'reserved').length,
      confirmedCount: booking.items.filter((i) => i.status === 'confirmed').length,
      failedCount: booking.items.filter((i) => i.status === 'failed').length,
      currency: booking.currency,
      subtotal: booking.subtotal,
      fees: booking.fees,
      total: booking.total,
      paymentSimulated: booking.paymentSimulated,
      idempotencyKey: booking.idempotencyKey,
      itineraryId: booking.itineraryId,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      confirmedAt: booking.confirmedAt,
      failureReason: booking.failureReason,
    }
  }

  getTimeline(bookingId: string): BookingTimeline {
    const booking = this.requireBooking(bookingId)
    return {
      bookingId: booking.id,
      events: structuredClone(booking.timeline),
    }
  }

  private buildItemsFromItinerary(
    itinerary: BookingItineraryInput,
    currency: string,
  ): BookingItem[] {
    const items: BookingItem[] = []

    for (const flight of itinerary.flights ?? []) {
      items.push({
        id: nextItemId('flight'),
        kind: 'flight',
        title: flight.title ?? `${flight.from} → ${flight.to}`,
        provider: 'mock-flight',
        amount: roundMoney(flight.estimatedCost),
        currency: flight.currency ?? currency,
        status: 'pending',
        reference: null,
        metadata: {
          sourceId: flight.id,
          from: flight.from,
          to: flight.to,
          direct: flight.direct ?? null,
        },
        attempts: 0,
        lastError: null,
      })
    }

    for (const hotel of itinerary.hotels ?? []) {
      items.push({
        id: nextItemId('hotel'),
        kind: 'hotel',
        title: hotel.name,
        provider: 'mock-hotel',
        amount: roundMoney(hotel.estimatedTotal),
        currency: hotel.currency ?? currency,
        status: 'pending',
        reference: null,
        metadata: {
          sourceId: hotel.id,
          nights: hotel.nights ?? null,
        },
        attempts: 0,
        lastError: null,
      })
    }

    for (const activity of itinerary.activities ?? []) {
      items.push({
        id: nextItemId('activity'),
        kind: 'activity',
        title: activity.title,
        provider: 'mock-activity',
        amount: roundMoney(activity.estimatedCost),
        currency: activity.currency ?? currency,
        status: 'pending',
        reference: null,
        metadata: {
          sourceId: activity.id,
          day: activity.day ?? null,
        },
        attempts: 0,
        lastError: null,
      })
    }

    for (const transport of itinerary.transportation ?? []) {
      items.push({
        id: nextItemId('transportation'),
        kind: 'transportation',
        title: transport.title ?? transport.mode ?? 'Transport',
        provider: 'mock-transport',
        amount: roundMoney(transport.estimatedCost),
        currency: transport.currency ?? currency,
        status: 'pending',
        reference: null,
        metadata: {
          sourceId: transport.id,
          mode: transport.mode ?? null,
          day: transport.day ?? null,
        },
        attempts: 0,
        lastError: null,
      })
    }

    // Stable ordering by kind then id
    const order: BookingItemKind[] = ['flight', 'hotel', 'activity', 'transportation']
    return items.sort((a, b) => {
      const ko = order.indexOf(a.kind) - order.indexOf(b.kind)
      if (ko !== 0) return ko
      return a.id.localeCompare(b.id)
    })
  }

  private fail(booking: Booking, reason: string): Booking {
    booking.failureReason = reason
    if (booking.state !== 'failed' && canTransitionBookingState(booking.state, 'failed')) {
      this.transition(booking, 'failed', 'booking.failed', reason)
    } else {
      this.pushEvent(booking, booking.state, 'booking.failed', reason)
      this.persist(booking)
    }
    return structuredClone(booking)
  }

  private transition(
    booking: Booking,
    to: BookingState,
    type: string,
    message: string,
  ): void {
    if (booking.state !== to && !canTransitionBookingState(booking.state, to)) {
      throw new Error(`Invalid booking transition ${booking.state} → ${to}`)
    }
    booking.state = to
    this.pushEvent(booking, to, type, message)
    this.persist(booking)
  }

  private pushEvent(
    booking: Booking,
    state: BookingState,
    type: string,
    message: string,
    itemId?: string | null,
  ): void {
    const event: BookingTimelineEvent = {
      id: nextEventId(),
      at: this.tick(),
      state,
      type,
      message,
      itemId: itemId ?? null,
    }
    booking.timeline.push(event)
    booking.updatedAt = event.at
  }

  private persist(booking: Booking): void {
    this.store.save(booking)
  }

  private requireBooking(id: string): Booking {
    const booking = this.store.getById(id)
    if (!booking) {
      throw new Error(`Booking not found: ${id}`)
    }
    return booking
  }

  private tick(): string {
    const iso = nowIso(this.clockMs)
    this.clockMs += 1
    return iso
  }
}

export function createBookingOrchestrator(
  options?: BookingOrchestratorOptions,
): BookingOrchestrator {
  return new BookingOrchestrator(options)
}
