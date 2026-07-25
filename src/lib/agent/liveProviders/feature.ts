import { getFeatureRegistry } from '../../ai/featureFlags'
import { isSecretManagerEnabled } from '../../security/secrets/feature'
import { getSecretManager } from '../../security/secrets/SecretManager'
import { readManagedConfig, readManagedEnv } from '../../security/secrets/managedAccess'
import type { LiveProviderId } from './types'

export const LIVE_PROVIDERS_FEATURE_ID = 'ai.live_providers' as const
export const PROVIDER_AMADEUS_FEATURE_ID = 'provider.amadeus' as const
export const PROVIDER_DUFFEL_FEATURE_ID = 'provider.duffel' as const
export const PROVIDER_BOOKING_FEATURE_ID = 'provider.booking' as const

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
  return parseBool(readManagedConfig('VITE_LIVE_PROVIDERS_ENABLED'), false)
    || parseBool(readManagedConfig('PROVIDER_LIVE_LAYER'), false)
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
    return parseBool(readManagedConfig('PROVIDER_AMADEUS_LIVE'), false)
      || parseBool(readManagedConfig('VITE_AMADEUS_ENABLED'), false)
      || readManagedConfig('VITE_FLIGHT_PROVIDER') === 'amadeus'
  }
  if (providerId === 'duffel') {
    return parseBool(readManagedConfig('PROVIDER_DUFFEL_LIVE'), false)
      || readManagedConfig('VITE_FLIGHT_PROVIDER') === 'duffel'
  }
  if (providerId === 'booking') {
    return parseBool(readManagedConfig('PROVIDER_BOOKING_LIVE'), false)
      || readManagedConfig('VITE_HOTEL_ADAPTER') === 'booking'
      || readManagedConfig('VITE_BOOKING_PROVIDER') === 'booking'
  }
  return false
}

/**
 * Sprint 14 — credentials via SecretManager (EnvironmentSecretProvider).
 * Provider-scoped reads enforce secret isolation.
 */
export function readLiveProviderSecret(
  key: string,
  providerId?: 'amadeus' | 'duffel' | 'booking',
): string | null {
  if (isSecretManagerEnabled()) {
    return getSecretManager().get(key, {
      caller: 'readLiveProviderSecret',
      providerId: providerId ?? 'generic',
    })
  }
  return readManagedEnv(key, {
    caller: 'readLiveProviderSecret',
    providerId: providerId ?? 'generic',
  })
}

/**
 * Sprint 59 prefers AMADEUS_API_KEY / AMADEUS_API_SECRET.
 * AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET remain supported aliases.
 */
export function readAmadeusApiKey(): string | null {
  return (
    readLiveProviderSecret('AMADEUS_API_KEY', 'amadeus')
    ?? readLiveProviderSecret('AMADEUS_CLIENT_ID', 'amadeus')
  )
}

export function readAmadeusApiSecret(): string | null {
  return (
    readLiveProviderSecret('AMADEUS_API_SECRET', 'amadeus')
    ?? readLiveProviderSecret('AMADEUS_CLIENT_SECRET', 'amadeus')
  )
}

export function hasAmadeusCredentials(): boolean {
  return Boolean(readAmadeusApiKey() && readAmadeusApiSecret())
}

export function hasDuffelCredentials(): boolean {
  return Boolean(readLiveProviderSecret('DUFFEL_API_TOKEN', 'duffel'))
}

/**
 * Sprint 60 — Booking.com / RapidAPI hotel credentials (server preferred).
 */
export function readBookingApiKey(): string | null {
  return (
    readLiveProviderSecret('BOOKING_API_KEY', 'booking')
    ?? readLiveProviderSecret('RAPIDAPI_KEY', 'booking')
    ?? readLiveProviderSecret('BOOKING_RAPIDAPI_KEY', 'booking')
    ?? readLiveProviderSecret('VITE_RAPIDAPI_KEY', 'booking')
    ?? readLiveProviderSecret('VITE_BOOKING_API_KEY', 'booking')
  )
}

export function hasBookingCredentials(): boolean {
  return Boolean(readBookingApiKey())
}
