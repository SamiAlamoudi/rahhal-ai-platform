/**
 * Maps ranked search options into BookingReview selection payloads.
 * Keeps the results → review hop free of page-specific duplication.
 */

import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'
import type { BookingItemType } from './bookingTypes'
import { isSafeBookingUrl } from './bookingAction'

export interface BookingSelectedItem {
  option: NormalizedTravelOption
  bookingType: BookingItemType
  bookingUrl: string
  providerName: string
  expiresAt: string | null
  cancellationInfo: string | null
}

const TYPE_MAP: Record<NormalizedTravelOption['type'], BookingItemType> = {
  flight: 'flight',
  hotel: 'hotel',
  activity: 'activity',
  transportation: 'rental_car',
}

const PROVIDER_LABELS: Record<string, string> = {
  'amadeus-flight': 'Amadeus',
  'amadeus-hotel': 'Amadeus Hotels',
  'booking-com': 'Booking.com',
  'rentalcars': 'Rentalcars',
  'mock-flight': 'Mock Flights',
  'mock-hotel': 'Mock Hotels',
  'mock-activity': 'Mock Activities',
  'mock-transportation': 'Mock Cars',
}

function attrString(
  attributes: NormalizedTravelOption['attributes'],
  key: string,
): string | null {
  const value = attributes[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Prefer provider deep-link; otherwise a safe HTTPS placeholder for redirect mode. */
export function resolveBookingUrl(option: NormalizedTravelOption): string {
  const candidates = [
    attrString(option.attributes, 'bookingUrl'),
    attrString(option.attributes, 'booking_url'),
    attrString(option.attributes, 'url'),
  ]
  for (const candidate of candidates) {
    if (candidate && isSafeBookingUrl(candidate)) return candidate
  }
  const provider = option.providerIds[0] || 'provider'
  const fallback = `https://www.example.com/book/${encodeURIComponent(provider)}/${encodeURIComponent(option.id)}`
  return isSafeBookingUrl(fallback) ? fallback : 'https://www.example.com/book'
}

export function resolveProviderName(option: NormalizedTravelOption): string {
  const fromAttr =
    attrString(option.attributes, 'providerName')
    ?? attrString(option.attributes, 'company')
  if (fromAttr) return fromAttr
  const providerId = option.providerIds[0]
  if (providerId && PROVIDER_LABELS[providerId]) return PROVIDER_LABELS[providerId]
  return providerId || 'Provider'
}

export function mapOptionToBookingType(option: NormalizedTravelOption): BookingItemType {
  return TYPE_MAP[option.type] ?? 'activity'
}

export function toBookingSelectedItem(
  option: NormalizedTravelOption,
  expiresAt: string | null = null,
): BookingSelectedItem {
  return {
    option,
    bookingType: mapOptionToBookingType(option),
    bookingUrl: resolveBookingUrl(option),
    providerName: resolveProviderName(option),
    expiresAt,
    cancellationInfo: option.refundable
      ? 'إلغاء مجاني متاح'
      : option.refundable === false
        ? 'غير قابل للاسترداد'
        : null,
  }
}

export function toBookingSelectedItems(
  options: NormalizedTravelOption[],
  expiresAt: string | null = null,
): BookingSelectedItem[] {
  return options.map((option) => toBookingSelectedItem(option, expiresAt))
}
