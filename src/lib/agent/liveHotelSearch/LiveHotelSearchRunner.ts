/**
 * Sprint 109 — LiveHotelSearchRunner
 * Validate → compose → Provider Gateway → Amadeus Hotel Search → HotelOffer[].
 */

import { createAmadeusHotelSearchProvider } from '../../../core/amadeusSandbox'
import {
  createGatewayProviderRegistry,
  createProviderGateway,
  type GatewayProviderRegistry,
  type ProviderGateway,
  type ProviderHealthMonitor,
} from '../../../core/providerGateway'
import { isLiveHotelSearchEnabled } from './feature'
import {
  createLiveHotelSearchComposer,
  type LiveHotelSearchComposer,
} from './LiveHotelSearchComposer'
import {
  createLiveHotelSearchMapper,
  type LiveHotelSearchMapper,
} from './LiveHotelSearchMapper'
import {
  createLiveHotelSearchMetrics,
  type LiveHotelSearchMetrics,
} from './LiveHotelSearchMetrics'
import { validateLiveHotelSearchCriteria } from './LiveHotelSearchValidator'
import type {
  LiveHotelSearchCriteria,
  LiveHotelSearchLogEntry,
  LiveHotelSearchResult,
  LiveHotelSearchStructuredLogger,
} from './types'
import {
  SPRINT109_LIVE_HOTEL_SEARCH_VERSION,
  createSilentLiveHotelSearchLogger,
} from './types'

export interface LiveHotelSearchRunnerOptions {
  readonly enabled?: boolean
  readonly gateway?: ProviderGateway
  readonly registry?: GatewayProviderRegistry
  readonly healthMonitor?: ProviderHealthMonitor
  readonly composer?: LiveHotelSearchComposer
  readonly mapper?: LiveHotelSearchMapper
  readonly metrics?: LiveHotelSearchMetrics
  readonly logger?: LiveHotelSearchStructuredLogger
  readonly nowMs?: () => number
  readonly sleep?: (ms: number) => Promise<void>
  readonly timeoutMs?: number
  readonly maxAttempts?: number
}

function disabledResult(
  criteria: LiveHotelSearchCriteria,
): LiveHotelSearchResult {
  return {
    version: SPRINT109_LIVE_HOTEL_SEARCH_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    hotels: [],
    hotelOffers: [],
    rankings: [],
    latencyMs: 0,
    attempts: 0,
    error: null,
    validationErrors: [],
    logs: ['live_hotel_search_disabled'],
    meta: {
      destination: criteria.destination ?? null,
      checkInDate: criteria.checkInDate ?? null,
      checkOutDate: criteria.checkOutDate ?? null,
      adults: criteria.adults ?? null,
      children: criteria.children ?? null,
      rooms: criteria.rooms ?? null,
      currency: criteria.currency ?? null,
      providerId: null,
      maxResults: criteria.maxResults ?? null,
    },
  }
}

export class LiveHotelSearchRunner {
  private readonly composer: LiveHotelSearchComposer
  private readonly mapper: LiveHotelSearchMapper
  private readonly metrics: LiveHotelSearchMetrics
  private readonly logger: LiveHotelSearchStructuredLogger
  private readonly options: LiveHotelSearchRunnerOptions
  private readonly logs: LiveHotelSearchLogEntry[] = []

  constructor(options: LiveHotelSearchRunnerOptions = {}) {
    this.options = options
    this.composer = options.composer ?? createLiveHotelSearchComposer()
    this.mapper = options.mapper ?? createLiveHotelSearchMapper()
    this.metrics = options.metrics ?? createLiveHotelSearchMetrics()
    this.logger = options.logger ?? createSilentLiveHotelSearchLogger()
  }

  getMetrics(): LiveHotelSearchMetrics {
    return this.metrics
  }

  getStructuredLogs(): readonly LiveHotelSearchLogEntry[] {
    return this.logs.slice()
  }

  clearStructuredLogs(): void {
    this.logs.length = 0
  }

  private emit(
    level: LiveHotelSearchLogEntry['level'],
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const safeMeta = meta ? redactSecrets(meta) : undefined
    const entry: LiveHotelSearchLogEntry = {
      at: new Date().toISOString(),
      level,
      message,
      meta: safeMeta,
    }
    this.logs.push(entry)
    this.logger(entry)
  }

  async search(criteria: LiveHotelSearchCriteria): Promise<LiveHotelSearchResult> {
    if (!isLiveHotelSearchEnabled({ enabled: this.options.enabled })) {
      this.emit('info', 'live_hotel_search.disabled')
      return disabledResult(criteria)
    }

    const started = Date.now()
    this.emit('info', 'live_hotel_search.start', {
      destination: criteria.destination,
      checkInDate: criteria.checkInDate,
      checkOutDate: criteria.checkOutDate,
    })

    const validation = validateLiveHotelSearchCriteria(criteria)
    if (!validation.ok || !validation.normalized) {
      const latencyMs = Math.max(0, Date.now() - started)
      this.metrics.recordSearch({
        ok: false,
        latencyMs,
        validationFailed: true,
      })
      this.emit('warn', 'live_hotel_search.validation_failed', {
        errors: validation.errors,
      })
      return {
        version: SPRINT109_LIVE_HOTEL_SEARCH_VERSION,
        enabled: true,
        ok: false,
        empty: true,
        hotels: [],
        hotelOffers: [],
        rankings: [],
        latencyMs,
        attempts: 0,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors.join('; '),
          retryable: false,
          rateLimited: false,
          timedOut: false,
          httpStatus: null,
        },
        validationErrors: validation.errors,
        logs: this.logs.map((l) => l.message),
        meta: {
          destination: criteria.destination ?? null,
          checkInDate: criteria.checkInDate ?? null,
          checkOutDate: criteria.checkOutDate ?? null,
          adults: criteria.adults ?? null,
          children: criteria.children ?? null,
          rooms: criteria.rooms ?? null,
          currency: criteria.currency ?? null,
          providerId: null,
          maxResults: criteria.maxResults ?? null,
        },
      }
    }

    const normalized = validation.normalized
    const composed = this.composer.compose(normalized)

    const gateway =
      this.options.gateway
      ?? createProviderGateway({
        registry:
          this.options.registry
          ?? (() => {
            const registry = createGatewayProviderRegistry({ enableAmadeus: false })
            registry.register(
              'amadeus',
              createAmadeusHotelSearchProvider(composed.amadeusOptions),
              { enabled: true },
            )
            return registry
          })(),
        healthMonitor: this.options.healthMonitor,
        nowMs: this.options.nowMs,
        sleep: this.options.sleep,
        timeoutMs: this.options.timeoutMs ?? normalized.timeoutMs,
        maxAttempts: this.options.maxAttempts,
      })

    const gatewayResponse = await gateway.execute(composed.gatewayRequest)
    const result = this.mapper.mapResponse(gatewayResponse, {
      enabled: true,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      meta: {
        destination: normalized.destination,
        checkInDate: normalized.checkInDate,
        checkOutDate: normalized.checkOutDate,
        adults: normalized.adults ?? 1,
        children: normalized.children ?? 0,
        rooms: normalized.rooms ?? 1,
        currency: normalized.currency ?? 'SAR',
        providerId: gatewayResponse.providerId,
        maxResults: normalized.maxResults ?? 20,
      },
    })

    result.logs = [
      ...this.logs.map((l) => l.message),
      ...gatewayResponse.logs,
    ]

    const authFailure =
      result.error?.code === 'UNAUTHORIZED'
      || result.error?.code === 'SECRETS_MISSING'
      || result.error?.code === 'FORBIDDEN'

    this.metrics.recordSearch({
      ok: result.ok,
      latencyMs: result.latencyMs,
      empty: result.empty,
      timedOut: result.error?.timedOut,
      rateLimited: result.error?.rateLimited,
      authFailure,
    })

    this.emit(result.ok ? 'info' : 'error', 'live_hotel_search.done', {
      ok: result.ok,
      empty: result.empty,
      offerCount: result.hotels.length,
      code: result.error?.code ?? null,
      attempts: result.attempts,
      latencyMs: result.latencyMs,
    })

    return result
  }
}

export function createLiveHotelSearchRunner(
  options?: LiveHotelSearchRunnerOptions,
): LiveHotelSearchRunner {
  return new LiveHotelSearchRunner(options)
}

export async function runLiveHotelSearch(
  criteria: LiveHotelSearchCriteria,
  options?: LiveHotelSearchRunnerOptions,
): Promise<LiveHotelSearchResult> {
  return createLiveHotelSearchRunner(options).search(criteria)
}

function redactSecrets(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase()
    if (
      lower.includes('secret')
      || lower.includes('password')
      || lower.includes('token')
      || lower.includes('apikey')
      || lower.includes('api_key')
      || lower.includes('authorization')
    ) {
      out[key] = '[redacted]'
      continue
    }
    out[key] = value
  }
  return out
}
