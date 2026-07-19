/**
 * Concierge summary for Booking Details screen (Sprint 13).
 */

import type { AgentLocale } from '../agent/types'
import { buildItinerarySummaryReply } from './bookingHistoryConcierge'
import type { BookingRecord } from './bookingRecord'

export function buildBookingDetailsConciergeSummary(
  record: BookingRecord,
  locale: AgentLocale = 'en',
): string {
  return buildItinerarySummaryReply(record, locale)
}
