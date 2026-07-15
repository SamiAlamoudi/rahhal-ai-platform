/**
 * Phase W — live provider registry + aggregation engine factory.
 * Wraps Amadeus / Booking.com / Google Maps / OpenWeather with flags,
 * health, rate limiting, retry (engine), circuit breaker, metrics, and logs.
 */

import { createAggregationEngine, type CreateAggregationEngineOptions } from '../engine'
import {
  createDefaultMockProviderAdapters,
} from '../mockProviders'
import { createAmadeusProviderAdapter } from '../providers/amadeus'
import { createBookingComProviderAdapter } from '../providers/booking'
import { createGoogleMapsProviderAdapter } from '../providers/googleMaps'
import { createOpenWeatherProviderAdapter } from '../providers/openWeather'
import { createProviderRegistry } from '../providerRegistry'
import type { AggregationEngine, ProviderAdapter, ProviderRegistry } from '../types'
import { createCircuitBreaker, type CircuitBreaker } from './circuitBreaker'
import { resolveLiveProviderEnvironment } from './environment'
import {
  isLiveProviderFlagEnabled,
  resolveProviderFeatureFlags,
  type ProviderFeatureFlags,
} from './featureFlags'
import { createProviderMetrics, type ProviderMetrics } from './metrics'
import { createProviderRateLimiter, type ProviderRateLimiter } from './rateLimiter'
import { createProviderSelectionLog, type ProviderSelectionLog } from './selectionLog'
import { wrapAdapterForLiveIntegration } from './wrapAdapter'

export interface LiveIntegrationContext {
  flags: ProviderFeatureFlags
  registry: ProviderRegistry
  engine: AggregationEngine
  circuitBreaker: CircuitBreaker
  metrics: ProviderMetrics
  selectionLog: ProviderSelectionLog
  rateLimiter: ProviderRateLimiter
}

export interface CreateLiveIntegrationOptions {
  flags?: Partial<ProviderFeatureFlags> & {
    providers?: Partial<ProviderFeatureFlags['providers']>
  }
  engine?: Partial<CreateAggregationEngineOptions>
  /** Extra adapters (tests). */
  extraAdapters?: ProviderAdapter[]
}

function buildLiveAdapters(flags: ProviderFeatureFlags): ProviderAdapter[] {
  const env = resolveLiveProviderEnvironment(flags)
  const adapters: ProviderAdapter[] = []

  // Live Amadeus — sandbox/production host from flags; credentials from env/proxy only.
  adapters.push(createAmadeusProviderAdapter({
    config: {
      enabled: isLiveProviderFlagEnabled(flags, 'amadeus'),
      baseUrl: env.amadeusBaseUrl,
    },
  }))

  adapters.push(createBookingComProviderAdapter({
    config: {
      enabled: isLiveProviderFlagEnabled(flags, 'booking_com'),
    },
  }))

  adapters.push(createGoogleMapsProviderAdapter({
    config: {
      enabled: isLiveProviderFlagEnabled(flags, 'google_maps'),
    },
  }))

  adapters.push(createOpenWeatherProviderAdapter({
    config: {
      enabled: isLiveProviderFlagEnabled(flags, 'openweather'),
    },
  }))

  // Mock fallbacks + other domain mocks
  if (flags.mockFallbackEnabled) {
    adapters.push(...createDefaultMockProviderAdapters())
  } else {
    // Still include non-live domain mocks (currency/visa/…) so agent tools work.
    adapters.push(
      ...createDefaultMockProviderAdapters().filter((a) => {
        const id = String(a.metadata.id)
        return !['amadeus_mock', 'booking_com_mock', 'google_maps_mock', 'openweather_mock'].includes(id)
      }),
    )
  }

  return adapters
}

export function createLiveProviderAdapters(
  flags: ProviderFeatureFlags = resolveProviderFeatureFlags(),
): ProviderAdapter[] {
  return buildLiveAdapters(flags)
}

export function createLiveIntegration(
  options: CreateLiveIntegrationOptions = {},
): LiveIntegrationContext {
  const flags = resolveProviderFeatureFlags(options.flags)
  const circuitBreaker = createCircuitBreaker()
  const metrics = createProviderMetrics()
  const selectionLog = createProviderSelectionLog()
  const rateLimiter = createProviderRateLimiter()

  const rawAdapters = [
    ...buildLiveAdapters(flags),
    ...(options.extraAdapters ?? []),
  ]

  const wrapped = rawAdapters.map((adapter) => wrapAdapterForLiveIntegration(adapter, {
    flags,
    circuitBreaker,
    rateLimiter,
    metrics,
    selectionLog,
  }))

  const registry = createProviderRegistry(wrapped)

  selectionLog.append({
    level: 'info',
    domain: '*',
    event: 'live_integration.boot',
    message: 'Phase W live integration registry ready',
    providerId: null,
    strategy: 'priority_fallback',
    metadata: {
      liveIntegrationEnabled: flags.liveIntegrationEnabled,
      mockFallbackEnabled: flags.mockFallbackEnabled,
      providers: flags.providers,
      amadeusEnvironment: flags.amadeusEnvironment,
      adapterCount: wrapped.length,
    },
  })

  const engine = createAggregationEngine({
    registry,
    selectionStrategy: 'priority_fallback',
    providerTimeoutMs: options.engine?.providerTimeoutMs,
    retryPolicy: options.engine?.retryPolicy,
    rateLimitPolicy: options.engine?.rateLimitPolicy,
    liveIntegration: {
      circuitBreaker,
      metrics,
      selectionLog,
      rateLimiter,
    },
  })

  return {
    flags,
    registry,
    engine,
    circuitBreaker,
    metrics,
    selectionLog,
    rateLimiter,
  }
}

export function createLiveIntegrationEngine(
  options: CreateLiveIntegrationOptions = {},
): AggregationEngine {
  return createLiveIntegration(options).engine
}

export function createLiveProviderRegistry(
  options: CreateLiveIntegrationOptions = {},
): ProviderRegistry {
  return createLiveIntegration(options).registry
}
