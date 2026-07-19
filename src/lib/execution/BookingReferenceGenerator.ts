/**
 * Sprint 33 — Booking reference generators.
 */

export class BookingReferenceGenerator {
  bookingReference(sessionId: string): string {
    return `RHL-BKG-${short(sessionId)}-${tail()}`
  }

  tripReference(tripId: string): string {
    return `RHL-TRP-${short(tripId)}-${tail()}`
  }

  executionReference(sessionId: string): string {
    return `RHL-EXE-${short(sessionId)}-${tail()}`
  }

  flightConfirmation(providerId: string): string {
    return `FLT-${slug(providerId)}-${tail()}`
  }

  hotelConfirmation(providerId: string): string {
    return `HTL-${slug(providerId)}-${tail()}`
  }
}

export function createBookingReferenceGenerator(): BookingReferenceGenerator {
  return new BookingReferenceGenerator()
}

function short(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'XXXXXX'
}

function tail(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'PROVIDER'
}
