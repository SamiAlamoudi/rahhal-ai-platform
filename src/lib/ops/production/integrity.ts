/**
 * Sprint 65 — Data integrity validators (bookings / trips / documents / relationships).
 * Pure functions — no architecture rewrite.
 */

import type { IntegrityIssue, IntegrityReport } from './types'

export interface BookingIntegritySubject {
  id: string
  sessionId?: string | null
  provider?: string | null
  confirmation?: string | null
  pnr?: string | null
  status?: string | null
  travelerCount?: number
}

export interface TripIntegritySubject {
  tripId: string
  userId?: string | null
  bookingIds?: string[]
  bookingReferences?: string[]
  pnrs?: string[]
  timelineLength?: number
  travelers?: number
  bookingStatus?: string | null
}

export interface DocumentIntegritySubject {
  documentId: string
  tripId?: string | null
  bookingId?: string | null
  checksum?: string | null
  status?: string | null
  version?: number
}

export interface IntegrityValidationInput {
  bookings?: BookingIntegritySubject[]
  trips?: TripIntegritySubject[]
  documents?: DocumentIntegritySubject[]
  now?: () => number
}

export function validateDataIntegrity(input: IntegrityValidationInput): IntegrityReport {
  const issues: IntegrityIssue[] = []
  const bookingIds = new Set((input.bookings ?? []).map((b) => b.id))
  const tripIds = new Set((input.trips ?? []).map((t) => t.tripId))

  for (const b of input.bookings ?? []) {
    if (!b.id) {
      issues.push({ code: 'booking_missing_id', severity: 'error', message: 'Booking missing id' })
    }
    if (!b.provider) {
      issues.push({
        code: 'booking_missing_provider',
        severity: 'error',
        message: 'Booking missing provider',
        subjectId: b.id,
      })
    }
    if ((b.travelerCount ?? 0) < 1 && b.status !== 'cancelled' && b.status !== 'failed') {
      issues.push({
        code: 'booking_missing_travelers',
        severity: 'warn',
        message: 'Booking has no travelers',
        subjectId: b.id,
      })
    }
    if (
      (b.status === 'confirmed' || b.status === 'ticketed')
      && !b.confirmation
      && !b.pnr
    ) {
      issues.push({
        code: 'booking_missing_provider_ref',
        severity: 'error',
        message: 'Confirmed booking missing confirmation/PNR',
        subjectId: b.id,
      })
    }
  }

  for (const t of input.trips ?? []) {
    if (!t.userId) {
      issues.push({
        code: 'trip_missing_user',
        severity: 'error',
        message: 'Trip missing userId',
        subjectId: t.tripId,
      })
    }
    if ((t.travelers ?? 0) < 1) {
      issues.push({
        code: 'trip_missing_travelers',
        severity: 'warn',
        message: 'Trip has no travelers',
        subjectId: t.tripId,
      })
    }
    if ((t.timelineLength ?? 0) < 1) {
      issues.push({
        code: 'trip_missing_timeline',
        severity: 'warn',
        message: 'Trip has empty timeline',
        subjectId: t.tripId,
      })
    }
    for (const bid of t.bookingIds ?? []) {
      if (input.bookings && input.bookings.length > 0 && !bookingIds.has(bid)) {
        issues.push({
          code: 'orphan_trip_booking_ref',
          severity: 'error',
          message: `Trip references missing booking ${bid}`,
          subjectId: t.tripId,
        })
      }
    }
  }

  for (const d of input.documents ?? []) {
    if (!d.checksum) {
      issues.push({
        code: 'document_missing_checksum',
        severity: 'error',
        message: 'Document missing checksum',
        subjectId: d.documentId,
      })
    }
    if ((d.version ?? 0) < 1) {
      issues.push({
        code: 'document_invalid_version',
        severity: 'error',
        message: 'Document version must be >= 1',
        subjectId: d.documentId,
      })
    }
    if (d.tripId && input.trips && input.trips.length > 0 && !tripIds.has(d.tripId)) {
      issues.push({
        code: 'orphan_document_trip',
        severity: 'error',
        message: `Document references missing trip ${d.tripId}`,
        subjectId: d.documentId,
      })
    }
    if (d.bookingId && input.bookings && input.bookings.length > 0 && !bookingIds.has(d.bookingId)) {
      issues.push({
        code: 'orphan_document_booking',
        severity: 'error',
        message: `Document references missing booking ${d.bookingId}`,
        subjectId: d.documentId,
      })
    }
  }

  const ok = !issues.some((i) => i.severity === 'error' || i.severity === 'critical')
  return {
    ok,
    issues,
    checkedAt: new Date((input.now ?? Date.now)()).toISOString(),
  }
}
