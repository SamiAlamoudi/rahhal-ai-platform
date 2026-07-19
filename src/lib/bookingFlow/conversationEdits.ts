/**
 * Sprint 25 — natural-language booking edits (no planning restart).
 */

import type { BookingFlowConversationEdit } from './types'

/**
 * Detect booking-side conversation edits that should update the booking flow
 * without restarting TripPlanning / Execution.
 */
export function detectBookingFlowConversationEdit(
  text: string,
): BookingFlowConversationEdit {
  const t = text.trim().toLowerCase()
  if (!t) return { kind: 'unknown', signal: text }

  if (
    /cheaper hotel|hotel (cheaper|less expensive)|فندق أرخص|أرخص فندق|choose a cheaper hotel/.test(
      t,
    )
  ) {
    return { kind: 'cheaper_hotel', signal: text }
  }
  if (
    /business class|cabin.?business|درجة رجال|رجال الأعمال|use business/.test(t)
  ) {
    return { kind: 'business_class', signal: text }
  }
  if (
    /extra nights?|two more nights|stay (two|2) extra|ليلتين إضاف|مدد الإقامة|stay two extra/.test(
      t,
    )
  ) {
    return { kind: 'extend_nights', signal: text }
  }
  if (
    /cheaper flight|flight (cheaper|less expensive)|طيران أرخص|أرخص طيران/.test(
      t,
    )
  ) {
    return { kind: 'cheaper_flight', signal: text }
  }
  return { kind: 'unknown', signal: text }
}

export function bookingEditTouchesSection(
  edit: BookingFlowConversationEdit,
): 'hotels' | 'flights' | 'dates' | null {
  switch (edit.kind) {
    case 'cheaper_hotel':
      return 'hotels'
    case 'business_class':
    case 'cheaper_flight':
      return 'flights'
    case 'extend_nights':
      return 'dates'
    default:
      return null
  }
}
