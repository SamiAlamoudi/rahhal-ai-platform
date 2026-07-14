import type { BookingMode } from './bookingTypes'

export type BookingActionMessageKey =
  | 'redirect_ready'
  | 'redirect_no_url'
  | 'redirect_invalid_url'
  | 'redirect_url_missing'
  | 'embedded_not_supported'
  | 'merchant_not_supported'
  | 'session_expired'
  | 'session_cancelled'
  | 'session_not_found'
  | 'no_items'
  | 'currency_mismatch'
  | 'item_expired'
  | 'duplicate_item'

export interface BookingAction {
  mode: BookingMode
  allowed: boolean
  providerId: string
  providerName: string
  bookingUrl: string
  messageKey: BookingActionMessageKey
  warnings: string[]
  expiresAt: string | null
  requiresExternalPayment: boolean
  requiresUserConfirmation: boolean
}

const SAFE_PROTOCOLS = ['http:', 'https:']
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

export function isSafeBookingUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  if (url.length > 2048) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (!SAFE_PROTOCOLS.includes(parsed.protocol)) return false
  if (BLOCKED_HOSTS.includes(parsed.hostname.toLowerCase())) return false
  if (!parsed.hostname || parsed.hostname.length < 3) return false
  return true
}

export function disabledBookingAction(
  mode: BookingMode,
  providerId: string,
  providerName: string,
  messageKey: BookingActionMessageKey,
  warnings: string[] = [],
): BookingAction {
  return {
    mode,
    allowed: false,
    providerId,
    providerName,
    bookingUrl: '',
    messageKey,
    warnings,
    expiresAt: null,
    requiresExternalPayment: false,
    requiresUserConfirmation: false,
  }
}

export function redirectBookingAction(
  providerId: string,
  providerName: string,
  bookingUrl: string,
  expiresAt: string | null,
  warnings: string[] = [],
): BookingAction {
  if (!bookingUrl) {
    return disabledBookingAction('redirect', providerId, providerName, 'redirect_url_missing', warnings)
  }
  if (!isSafeBookingUrl(bookingUrl)) {
    return disabledBookingAction('redirect', providerId, providerName, 'redirect_invalid_url', [
      ...warnings,
      'Booking URL failed safety validation',
    ])
  }
  return {
    mode: 'redirect',
    allowed: true,
    providerId,
    providerName,
    bookingUrl,
    messageKey: 'redirect_ready',
    warnings,
    expiresAt,
    requiresExternalPayment: true,
    requiresUserConfirmation: true,
  }
}
