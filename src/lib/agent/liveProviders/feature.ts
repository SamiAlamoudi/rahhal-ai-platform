import { getFeatureRegistry } from '../../ai/featureFlags'
import type { LiveProviderId } from './types'

export const LIVE_PROVIDERS_FEATURE_ID = 'ai.live_providers' as const
export const PROVIDER_AMADEUS_FEATURE_ID = 'provider.amadeus' as const
export const PROVIDER_DUFFEL_FEATURE_ID = 'provider.duffel' as const
export const PROVIDER_BOOKING_FEATURE_ID = 'provider.booking' as const

function readEnv(key: string): string | null {
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (vite !== undefined && vite !== null && String(vite) !== '') return String(vite)
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  } catch {
    /* ignore */
  }
  return null
}

function parseBool(value: string | null, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return defaultValue
}

export function isLiveProvidersEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  if (!getFeatureRegistry().isEnabled('ai.live_providers')) return false
  return parseBool(readEnv('VITE_LIVE_PROVIDERS_ENABLED'), false)
    || parseBool(readEnv('PROVIDER_LIVE_LAYER'), false)
}

export function isLiveProviderEnabled(
  providerId: LiveProviderId,
  options?: { enabled?: boolean },
): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  if (!isLiveProvidersEnabled()) return false
  const featureId =
    providerId === 'amadeus'
      ? 'provider.amadeus'
      : providerId === 'duffel'
        ? 'provider.duffel'
        : providerId === 'booking'
          ? 'provider.booking'
          : null
  if (featureId && !getFeatureRegistry().isEnabled(featureId)) return false

  if (providerId === 'amadeus') {
    return parseBool(readEnv('PROVIDER_AMADEUS_LIVE'), false)
      || parseBool(readEnv('VITE_AMADEUS_ENABLED'), false)
      || readEnv('VITE_FLIGHT_PROVIDER') === 'amadeus'
  }
  if (providerId === 'duffel') {
    return parseBool(readEnv('PROVIDER_DUFFEL_LIVE'), false)
      || readEnv('VITE_FLIGHT_PROVIDER') === 'duffel'
  }
  if (providerId === 'booking') {
    return parseBool(readEnv('PROVIDER_BOOKING_LIVE'), false)
      || readEnv('VITE_HOTEL_ADAPTER') === 'booking'
      || readEnv('VITE_BOOKING_PROVIDER') === 'booking'
  }
  return false
}

export function readLiveProviderSecret(key: string): string | null {
  // Server-only secrets — never VITE_* OAuth secrets.
  return readEnv(key)
}

/**
 * Sprint 59 prefers AMADEUS_API_KEY / AMADEUS_API_SECRET.
 * AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET remain supported aliases.
 */
export function readAmadeusApiKey(): string | null {
  return (
    readLiveProviderSecret('AMADEUS_API_KEY')
    ?? readLiveProviderSecret('AMADEUS_CLIENT_ID')
  )
}

export function readAmadeusApiSecret(): string | null {
  return (
    readLiveProviderSecret('AMADEUS_API_SECRET')
    ?? readLiveProviderSecret('AMADEUS_CLIENT_SECRET')
  )
}

export function hasAmadeusCredentials(): boolean {
  return Boolean(readAmadeusApiKey() && readAmadeusApiSecret())
}

export function hasDuffelCredentials(): boolean {
  return Boolean(readLiveProviderSecret('DUFFEL_API_TOKEN'))
}

/**
 * Sprint 60 — Booking.com / RapidAPI hotel credentials (server preferred).
 * Order: BOOKING_API_KEY → RAPIDAPI_KEY → BOOKING_RAPIDAPI_KEY → VITE_RAPIDAPI_KEY
 */
export function readBookingApiKey(): string | null {
  return (
    readLiveProviderSecret('BOOKING_API_KEY')
    ?? readLiveProviderSecret('RAPIDAPI_KEY')
    ?? readLiveProviderSecret('BOOKING_RAPIDAPI_KEY')
    ?? readEnv('VITE_RAPIDAPI_KEY')
    ?? readEnv('VITE_BOOKING_API_KEY')
  )
}

export function hasBookingCredentials(): boolean {
  return Boolean(readBookingApiKey())
}
