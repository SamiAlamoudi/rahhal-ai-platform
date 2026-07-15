/**
 * Real OpenWeather ProviderAdapter for the agent aggregation layer.
 * TravelAgentService never imports this — only the Provider Registry does.
 *
 * Capabilities (canonical models only — no OpenWeather response objects leak):
 * current, hourly, daily, temp/feels-like, humidity, wind, visibility, UV,
 * rain probability, sunrise/sunset, alerts when available.
 */

import { OpenWeatherApiClient } from '../../../../../integrations/providers/openWeather/openWeatherApiClient'
import type {
  CanonicalCurrentWeather,
  CanonicalDailyForecast,
  CanonicalHourlyForecast,
  CanonicalWeatherAlert,
  CanonicalWeatherSnapshot,
} from '../../../../../integrations/providers/openWeather/types'
import { createProviderAdapter } from '../../baseAdapter'
import { normalizeProviderError, statusFromErrorCode } from '../../errors'
import type {
  AggregationQuery,
  ProviderAdapter,
  ProviderFetchResult,
} from '../../types'
import {
  isOpenWeatherConfigured,
  resolveOpenWeatherProviderConfig,
  type OpenWeatherProviderConfig,
} from './config'
import { weatherSnapshotToNormalizedOffer } from './normalizeToOffer'

export interface CreateOpenWeatherProviderAdapterOptions {
  config?: Partial<OpenWeatherProviderConfig>
  deps?: {
    search?: (query: AggregationQuery, config: OpenWeatherProviderConfig) => Promise<ProviderFetchResult>
    client?: OpenWeatherApiClient
  }
}

/** WeatherProviderAdapter — Phase Q public surface name. */
export interface WeatherProviderAdapter extends ProviderAdapter {
  getCurrentWeather(destination: string): Promise<CanonicalCurrentWeather | null>
  getHourlyForecast(destination: string): Promise<CanonicalHourlyForecast[]>
  getDailyForecast(destination: string): Promise<CanonicalDailyForecast[]>
  getWeatherAlerts(destination: string): Promise<CanonicalWeatherAlert[]>
  getWeatherSnapshot(destination: string): Promise<CanonicalWeatherSnapshot>
}

export function createOpenWeatherProviderAdapter(
  options: CreateOpenWeatherProviderAdapterOptions = {},
): WeatherProviderAdapter {
  const config = resolveOpenWeatherProviderConfig(options.config)
  let client: OpenWeatherApiClient | null = options.deps?.client ?? null
  let snapshotCache: { key: string; value: CanonicalWeatherSnapshot } | null = null

  const ensureClient = (): OpenWeatherApiClient => {
    if (!isOpenWeatherConfigured(config) && !options.deps?.client) {
      throw new Error('OpenWeather provider is not configured')
    }
    if (!client) {
      client = new OpenWeatherApiClient({
        apiKey: config.apiKey,
        proxyUrl: config.proxyUrl,
        invokeApiKey: config.invokeApiKey,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
      })
    }
    return client
  }

  const loadSnapshot = async (destination: string): Promise<CanonicalWeatherSnapshot> => {
    const key = destination.trim().toLowerCase()
    if (snapshotCache?.key === key) return snapshotCache.value
    const value = await ensureClient().getWeatherSnapshot(destination)
    snapshotCache = { key, value }
    return value
  }

  const base = createProviderAdapter({
    metadata: {
      id: 'openweather',
      displayName: 'OpenWeather',
      domains: ['weather'],
      priority: 95,
      reliability: 0.93,
      mocked: false,
      futureSlot: false,
    },
    isAvailable: () => isOpenWeatherConfigured(config) || Boolean(options.deps?.search || options.deps?.client),
    capabilities: {
      features: [
        'current_weather',
        'hourly_forecast',
        'daily_forecast',
        'temperature',
        'feels_like',
        'humidity',
        'wind',
        'visibility',
        'uv_index',
        'rain_probability',
        'sunrise_sunset',
        'weather_alerts',
        'forecast_summary',
        'packing_hints',
        'trip_enrichment',
      ],
      supportsSearch: true,
      supportsRealtime: true,
      rateLimitPerMinute: 60,
      mocked: false,
      futureSlot: false,
    },
    async fetch(query) {
      if (options.deps?.search) {
        return options.deps.search(query, config)
      }
      return searchOpenWeather(query, loadSnapshot)
    },
  })

  return {
    ...base,
    async getCurrentWeather(destination) {
      return (await loadSnapshot(destination)).current
    },
    async getHourlyForecast(destination) {
      return (await loadSnapshot(destination)).hourly
    },
    async getDailyForecast(destination) {
      return (await loadSnapshot(destination)).daily
    },
    async getWeatherAlerts(destination) {
      return (await loadSnapshot(destination)).alerts
    },
    async getWeatherSnapshot(destination) {
      return loadSnapshot(destination)
    },
  }
}

/** Alias matching the Phase Q name. */
export const createWeatherProviderAdapter = createOpenWeatherProviderAdapter

async function searchOpenWeather(
  query: AggregationQuery,
  loadSnapshot: (destination: string) => Promise<CanonicalWeatherSnapshot>,
): Promise<ProviderFetchResult> {
  const started = Date.now()
  const providerId = 'openweather'
  const destination = String(query.input.destination ?? '').trim()

  if (!destination) {
    return {
      providerId,
      status: 'error',
      items: [],
      error: 'destination required for weather search',
      errorCode: 'invalid_input',
      durationMs: Date.now() - started,
    }
  }

  try {
    const snapshot = await loadSnapshot(destination)
    return {
      providerId,
      status: 'ok',
      items: [weatherSnapshotToNormalizedOffer(snapshot, providerId)],
      error: null,
      errorCode: null,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    const normalized = normalizeProviderError(error)
    const code = mapOpenWeatherErrorCode(error, normalized.code)
    return {
      providerId,
      status: statusFromErrorCode(code),
      items: [],
      error: normalized.message,
      errorCode: code,
      durationMs: Date.now() - started,
      retryAfterMs: code === 'rate_limited' ? (normalized.retryAfterMs ?? 2_000) : normalized.retryAfterMs,
    }
  }
}

function mapOpenWeatherErrorCode(
  error: unknown,
  fallback: import('../../types').ProviderErrorCode,
): import('../../types').ProviderErrorCode {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: string }).code)
    if (code === 'rate_limited') return 'rate_limited'
    if (code === 'unavailable') return 'unavailable'
    if (code === 'timeout') return 'timeout'
    if (code === 'invalid_input') return 'invalid_input'
    if (code === 'upstream_error') return 'upstream_error'
  }
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('rate')) return 'rate_limited'
  if (message.includes('abort') || message.includes('timeout')) return 'timeout'
  return fallback
}
