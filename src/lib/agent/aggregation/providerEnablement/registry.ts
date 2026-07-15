/**
 * Phase AJ — canonical provider configuration registry.
 * Timeouts / retries / rate limits pull defaults from AppConfig where applicable.
 */

import { getAppConfig } from '../../../ops/production/appConfig'
import type { ProviderRegistryEntry } from './types'

function withAppDefaults(partial: Omit<ProviderRegistryEntry, 'timeoutMs' | 'retryPolicy' | 'rateLimitPolicy' | 'circuitBreakerPolicy'> & {
  timeoutMs?: number
  retryPolicy?: ProviderRegistryEntry['retryPolicy']
  rateLimitPolicy?: ProviderRegistryEntry['rateLimitPolicy']
  circuitBreakerPolicy?: ProviderRegistryEntry['circuitBreakerPolicy']
}): ProviderRegistryEntry {
  const app = getAppConfig()
  return {
    ...partial,
    timeoutMs: partial.timeoutMs ?? app.timeouts.providerMs,
    retryPolicy: partial.retryPolicy ?? {
      maxAttempts: app.retries.provider.maxAttempts,
      baseDelayMs: app.retries.provider.baseDelayMs,
      maxDelayMs: app.retries.provider.maxDelayMs,
    },
    rateLimitPolicy: partial.rateLimitPolicy ?? {
      maxRequests: 60,
      windowMs: 60_000,
    },
    circuitBreakerPolicy: partial.circuitBreakerPolicy ?? {
      failureThreshold: 3,
      openMs: 10_000,
      halfOpenSuccesses: 1,
    },
  }
}

/** Canonical registry — all live entries default to sandbox; enablement is flag-driven elsewhere. */
export function getProviderConfigurationRegistry(): ProviderRegistryEntry[] {
  return [
    withAppDefaults({
      providerId: 'amadeus',
      capability: 'flights',
      capabilityFlag: 'providers.flights.live',
      environment: 'sandbox',
      priority: 10,
      fallbackProviderId: 'amadeus_mock',
      healthCheckStrategy: 'config_only',
      requiredSecretNames: ['AMADEUS_CLIENT_ID', 'AMADEUS_CLIENT_SECRET'],
      optionalConfigFields: ['AMADEUS_BASE_URL', 'AMADEUS_ENV'],
      supportedRegions: 'global',
      liveAdapterAvailable: true,
      selectionEnvKeys: ['VITE_FLIGHTS_PROVIDER', 'VITE_FLIGHT_PROVIDER'],
    }),
    withAppDefaults({
      providerId: 'amadeus_mock',
      capability: 'flights',
      capabilityFlag: 'providers.flights.live',
      environment: 'mock',
      priority: 100,
      fallbackProviderId: null,
      healthCheckStrategy: 'none',
      requiredSecretNames: [],
      optionalConfigFields: [],
      supportedRegions: 'global',
      liveAdapterAvailable: false,
      selectionEnvKeys: [],
    }),
    withAppDefaults({
      providerId: 'booking_com',
      capability: 'hotels',
      capabilityFlag: 'providers.hotels.live',
      environment: 'sandbox',
      priority: 10,
      fallbackProviderId: 'booking_com_mock',
      healthCheckStrategy: 'config_only',
      requiredSecretNames: ['BOOKING_RAPIDAPI_KEY'],
      optionalConfigFields: ['BOOKING_RAPIDAPI_HOST', 'RAPIDAPI_KEY', 'BOOKING_API_KEY'],
      supportedRegions: 'global',
      liveAdapterAvailable: true,
      selectionEnvKeys: ['VITE_HOTELS_PROVIDER', 'VITE_HOTEL_ADAPTER', 'VITE_BOOKING_PROVIDER'],
    }),
    withAppDefaults({
      providerId: 'booking_com_mock',
      capability: 'hotels',
      capabilityFlag: 'providers.hotels.live',
      environment: 'mock',
      priority: 100,
      fallbackProviderId: null,
      healthCheckStrategy: 'none',
      requiredSecretNames: [],
      optionalConfigFields: [],
      supportedRegions: 'global',
      liveAdapterAvailable: false,
      selectionEnvKeys: [],
    }),
    withAppDefaults({
      providerId: 'google_maps',
      capability: 'maps',
      capabilityFlag: 'providers.maps.live',
      environment: 'sandbox',
      priority: 10,
      fallbackProviderId: 'google_maps_mock',
      healthCheckStrategy: 'config_only',
      requiredSecretNames: ['GOOGLE_MAPS_API_KEY'],
      optionalConfigFields: ['VITE_GOOGLE_MAPS_PROXY_URL'],
      supportedRegions: 'global',
      liveAdapterAvailable: true,
      selectionEnvKeys: ['VITE_MAPS_PROVIDER'],
    }),
    withAppDefaults({
      providerId: 'google_maps_mock',
      capability: 'maps',
      capabilityFlag: 'providers.maps.live',
      environment: 'mock',
      priority: 100,
      fallbackProviderId: null,
      healthCheckStrategy: 'none',
      requiredSecretNames: [],
      optionalConfigFields: [],
      supportedRegions: 'global',
      liveAdapterAvailable: false,
      selectionEnvKeys: [],
    }),
    withAppDefaults({
      providerId: 'openweather',
      capability: 'weather',
      capabilityFlag: 'providers.weather.live',
      environment: 'sandbox',
      priority: 10,
      fallbackProviderId: 'openweather_mock',
      healthCheckStrategy: 'config_only',
      requiredSecretNames: ['OPENWEATHER_API_KEY'],
      optionalConfigFields: ['VITE_OPENWEATHER_PROXY_URL'],
      supportedRegions: 'global',
      liveAdapterAvailable: true,
      selectionEnvKeys: ['VITE_WEATHER_PROVIDER', 'VITE_WEATHER_ADAPTER'],
    }),
    withAppDefaults({
      providerId: 'openweather_mock',
      capability: 'weather',
      capabilityFlag: 'providers.weather.live',
      environment: 'mock',
      priority: 100,
      fallbackProviderId: null,
      healthCheckStrategy: 'none',
      requiredSecretNames: [],
      optionalConfigFields: [],
      supportedRegions: 'global',
      liveAdapterAvailable: false,
      selectionEnvKeys: [],
    }),
    withAppDefaults({
      providerId: 'transport_mock',
      capability: 'transport',
      capabilityFlag: 'providers.transport.live',
      environment: 'mock',
      priority: 100,
      fallbackProviderId: null,
      healthCheckStrategy: 'none',
      requiredSecretNames: [],
      optionalConfigFields: [],
      supportedRegions: 'global',
      liveAdapterAvailable: false,
      selectionEnvKeys: ['VITE_TRANSPORT_PROVIDER'],
    }),
    withAppDefaults({
      providerId: 'activities_mock',
      capability: 'activities',
      capabilityFlag: 'providers.activities.live',
      environment: 'mock',
      priority: 100,
      fallbackProviderId: null,
      healthCheckStrategy: 'none',
      requiredSecretNames: [],
      optionalConfigFields: [],
      supportedRegions: 'global',
      liveAdapterAvailable: false,
      selectionEnvKeys: ['VITE_ACTIVITIES_PROVIDER'],
    }),
  ]
}

export function getRegistryEntry(providerId: string): ProviderRegistryEntry | null {
  return getProviderConfigurationRegistry().find((e) => e.providerId === providerId) ?? null
}

export function getLiveEntriesForCapability(capability: string): ProviderRegistryEntry[] {
  return getProviderConfigurationRegistry().filter(
    (e) => e.capability === capability && e.liveAdapterAvailable,
  )
}

export function getMockFallbackEntry(liveProviderId: string): ProviderRegistryEntry | null {
  const live = getRegistryEntry(liveProviderId)
  if (!live?.fallbackProviderId) return null
  return getRegistryEntry(live.fallbackProviderId)
}
