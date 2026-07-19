/**
 * Lightweight runtime context so Concierge booking-history replies can load
 * the signed-in user's BookingSession records without coupling chat → auth.
 */

let activeUserId: string | null = null

export function setBookingHistoryUserId(userId: string | null): void {
  activeUserId = userId && userId !== 'anonymous' ? userId : null
}

export function getBookingHistoryUserId(): string | null {
  return activeUserId
}
