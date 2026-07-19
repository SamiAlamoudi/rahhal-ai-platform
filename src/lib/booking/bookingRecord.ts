/**
 * Sprint 13 — Booking Record projection over BookingSession (single source of truth).
 * Temporary Rahhal references until supplier confirmation is available.
 */

import type { BookingSession, BookingStatus } from './bookingTypes'
import type { Passenger } from '../passengers/types'
import { TAX_RATE, RAHHAL_SERVICE_FEE } from '../payment/checkoutTypes'

/** Local fare shape — avoid importing passengers package (circular). */
export interface FareBreakdown {
  fare: number
  taxes: number
  fees: number
  grandTotal: number
  currency: string
  taxRate: number
}

function buildFareBreakdown(
  fareAmount: number,
  currency: string,
  options?: { fees?: number },
): FareBreakdown {
  const taxRate = TAX_RATE
  const fees = options?.fees ?? RAHHAL_SERVICE_FEE
  const safeFare = Math.max(0, Number(fareAmount) || 0)
  const taxes = Math.round(safeFare * taxRate * 100) / 100
  const grandTotal = Math.round((safeFare + taxes + fees) * 100) / 100
  return { fare: safeFare, taxes, fees, grandTotal, currency: currency || 'SAR', taxRate }
}

function readPassengers(session: BookingSession): Passenger[] {
  const item = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  const raw = item?.metadata?.passengers
  return Array.isArray(raw) ? (raw as Passenger[]) : []
}

export type TripBucket = 'upcoming' | 'completed' | 'cancelled'

export interface BookingTimelineEvent {
  id: string
  at: string
  labelEn: string
  labelAr: string
  status: BookingStatus | 'record'
}

export interface BookingRecordFlight {
  title: string
  airline: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  cabin: string
  stops: number | null
}

export interface BookingRecord {
  sessionId: string
  userId: string
  /** Temporary Rahhal ref until supplier confirmation; may match provider ref when present. */
  bookingReference: string
  status: BookingStatus
  bucket: TripBucket
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  redirectedAt: string | null
  expiresAt: string
  flight: BookingRecordFlight | null
  passengers: Passenger[]
  fare: FareBreakdown
  itemTitles: string[]
  currency: string
  total: number
  providerBookingReference: string | null
  passengersComplete: boolean
  timeline: BookingTimelineEvent[]
}

/** Deterministic temporary booking reference from session id. */
export function temporaryBookingReference(sessionId: string): string {
  const compact = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'PENDING'
  return `RHL-${compact}`
}

export function resolveBookingReference(session: BookingSession): string {
  const providerRef = session.providerReferences.find((r) => r.providerBookingReference)?.providerBookingReference
  if (providerRef) return providerRef
  const item = session.items[0]
  const metaRef = item?.metadata?.bookingReference
  if (typeof metaRef === 'string' && metaRef.trim()) return metaRef.trim()
  return temporaryBookingReference(session.id)
}

function departureIso(session: BookingSession): string | null {
  const item = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  const itinerary = (item?.metadata?.selectedItinerary ?? {}) as { departureTime?: string }
  const raw = itinerary.departureTime
  if (!raw || typeof raw !== 'string') return null
  return raw
}

export function classifyTripBucket(session: BookingSession, now = Date.now()): TripBucket {
  if (session.status === 'cancelled' || session.status === 'expired' || session.status === 'failed') {
    return 'cancelled'
  }
  if (session.status === 'confirmed') {
    const dep = departureIso(session)
    if (dep) {
      const t = Date.parse(dep)
      if (Number.isFinite(t) && t < now) return 'completed'
    }
    return 'upcoming'
  }
  // In-progress funnel + redirected = upcoming until completed
  return 'upcoming'
}

function flightFromSession(session: BookingSession): BookingRecordFlight | null {
  const item = session.items.find((i) => i.type === 'flight') ?? null
  if (!item) return null
  const itinerary = (item.metadata.selectedItinerary ?? {}) as Record<string, unknown>
  return {
    title: item.title,
    airline: String(itinerary.airline ?? item.providerName ?? ''),
    origin: String(itinerary.origin ?? ''),
    destination: String(itinerary.destination ?? ''),
    departureTime: String(itinerary.departureTime ?? ''),
    arrivalTime: String(itinerary.arrivalTime ?? ''),
    cabin: String(itinerary.cabin ?? ''),
    stops: typeof itinerary.stops === 'number' ? itinerary.stops : null,
  }
}

function fareFromSession(session: BookingSession): FareBreakdown {
  const item = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  const pricing = (item?.metadata.pricing ?? {}) as Record<string, unknown>
  if (typeof pricing.grandTotal === 'number' && typeof pricing.fare === 'number') {
    return {
      fare: Number(pricing.fare),
      taxes: Number(pricing.taxes ?? 0),
      fees: Number(pricing.fees ?? session.fees),
      grandTotal: Number(pricing.grandTotal),
      currency: String(pricing.currency ?? session.currency),
      taxRate: Number(pricing.taxRate ?? 0.15),
    }
  }
  return buildFareBreakdown(item?.price ?? session.subtotal, session.currency, { fees: session.fees })
}

export function buildBookingTimeline(session: BookingSession): BookingTimelineEvent[] {
  const events: BookingTimelineEvent[] = [
    {
      id: 'created',
      at: session.createdAt,
      labelEn: 'Booking session created',
      labelAr: 'تم إنشاء جلسة الحجز',
      status: 'draft',
    },
  ]
  const item = session.items[0]
  if (item?.metadata.passengersComplete) {
    events.push({
      id: 'passengers',
      at: session.updatedAt,
      labelEn: 'Passenger details saved',
      labelAr: 'تم حفظ بيانات المسافرين',
      status: 'selected',
    })
  }
  if (session.redirectedAt) {
    events.push({
      id: 'redirected',
      at: session.redirectedAt,
      labelEn: 'Redirected to provider',
      labelAr: 'تم التحويل للمزوّد',
      status: 'redirected',
    })
  }
  if (session.confirmedAt) {
    events.push({
      id: 'confirmed',
      at: session.confirmedAt,
      labelEn: 'Booking confirmed',
      labelAr: 'تم تأكيد الحجز',
      status: 'confirmed',
    })
  }
  if (session.status === 'cancelled') {
    events.push({
      id: 'cancelled',
      at: session.updatedAt,
      labelEn: 'Booking cancelled',
      labelAr: 'تم إلغاء الحجز',
      status: 'cancelled',
    })
  }
  events.push({
    id: 'record',
    at: session.updatedAt,
    labelEn: `Status: ${session.status}`,
    labelAr: `الحالة: ${session.status}`,
    status: 'record',
  })
  return events.sort((a, b) => a.at.localeCompare(b.at))
}

/** Project a BookingSession into a durable BookingRecord view. */
export function toBookingRecord(session: BookingSession): BookingRecord {
  const item = session.items.find((i) => i.type === 'flight') ?? session.items[0]
  return {
    sessionId: session.id,
    userId: session.userId,
    bookingReference: resolveBookingReference(session),
    status: session.status,
    bucket: classifyTripBucket(session),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    confirmedAt: session.confirmedAt,
    redirectedAt: session.redirectedAt,
    expiresAt: session.expiresAt,
    flight: flightFromSession(session),
    passengers: readPassengers(session),
    fare: fareFromSession(session),
    itemTitles: session.items.map((i) => i.title),
    currency: session.currency,
    total: session.total,
    providerBookingReference:
      session.providerReferences.find((r) => r.providerBookingReference)?.providerBookingReference
      ?? null,
    passengersComplete: Boolean(item?.metadata.passengersComplete),
    timeline: buildBookingTimeline(session),
  }
}

/**
 * Persist temporary booking reference + booking-record snapshot onto session item metadata.
 * Keeps BookingSession as the only source of truth.
 */
export function attachBookingRecordMetadata(session: BookingSession): BookingSession {
  const reference = resolveBookingReference(session)
  const record = toBookingRecord(session)
  const items = session.items.map((item, index) => {
    if (index !== 0 && item.type !== 'flight') return item
    return {
      ...item,
      metadata: {
        ...item.metadata,
        bookingReference: reference,
        bookingRecord: {
          bookingReference: reference,
          status: record.status,
          bucket: record.bucket,
          fare: record.fare,
          passengerCount: record.passengers.length,
          selectedItinerary: item.metadata.selectedItinerary ?? null,
          timestamps: {
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            confirmedAt: session.confirmedAt,
            redirectedAt: session.redirectedAt,
          },
        },
        sprint: Math.max(Number(item.metadata.sprint ?? 0), 13),
      },
    }
  })
  return { ...session, items }
}
