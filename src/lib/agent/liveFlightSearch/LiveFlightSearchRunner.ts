/**
 * Sprint 105 — LiveFlightSearchRunner
 * Validate → compose → Provider Gateway → Amadeus → map to Rahhal results.
 */

import {
  createGatewayProviderRegistry,
  createProviderGateway,
  type GatewayProviderRegistry,
  type ProviderGateway,
  type ProviderHealthMonitor,
} from '../../../core/providerGateway'
import { isLiveFlightSearchEnabled } from './feature'
import {
  createLiveFlightSearchComposer,
  type LiveFlightSearchComposer,
} from './LiveFlightSearchComposer'
import {
  createLiveFlightSearchMapper,
  type LiveFlightSearchMapper,
} from './LiveFlightSearchMapper'
import {
  createLiveFlightSearchMetrics,
  type LiveFlightSearchMetrics,
} from './LiveFlightSearchMetrics'
import { validateLiveFlightSearchCriteria } from './LiveFlightSearchValidator'
import type {
  LiveFlightSearchCriteria,
  LiveFlightSearchLogEntry,
  LiveFlightSearchResult,
  LiveFlightSearchStructuredLogger,
} from './types'
import {
  SPRINT105_LIVE_FLIGHT_SEARCH_VERSION,
  createSilentLiveFlightSearchLogger,
} from './types'

export interface LiveFlightSearchRunnerOptions {
  readonly enabled?: boolean
  readonly gateway?: ProviderGateway
  readonly registry?: GatewayProviderRegistry
  readonly healthMonitor?: ProviderHealthMonitor
  readonly composer?: LiveFlightSearchComposer
  readonly mapper?: LiveFlightSearchMapper
  readonly metrics?: LiveFlightSearchMetrics
  readonly logger?: LiveFlightSearchStructuredLogger
  readonly nowMs?: () => number
  readonly sleep?: (ms: number) => Promise<void>
  readonly timeoutMs?: number
  readonly maxAttempts?: number
}

function disabledResult(
  criteria: LiveFlightSearchCriteria,
): LiveFlightSearchResult {
  return {
    version: SPRINT105_LIVE_FLIGHT_SEARCH_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    flights: [],
    flightOffers: [],
    latencyMs: 0,
    attempts: 0,
    error: null,
    validationErrors: [],
    logs: ['live_flight_search_disabled'],
    meta: {
      origin: criteria.origin ?? null,
      destination: criteria.destination ?? null,
      departureDate: criteria.departureDate ?? null,
      adults: criteria.adults ?? null,
      children: criteria.children ?? null,
      currency: criteria.currency ?? null,
      providerId: null,
      maxResults: criteria.maxResults ?? null,
      nonStop: criteria.nonStop ?? null,
    },
  }
}

export class LiveFlightSearchRunner {
  private readonly composer: LiveFlightSearchComposer
  private readonly mapper: LiveFlightSearchMapper
  private readonly metrics: LiveFlightSearchMetrics
  private readonly logger: LiveFlightSearchStructuredLogger
  private readonly options: LiveFlightSearchRunnerOptions
  private readonly logs: LiveFlightSearchLogEntry[] = []

  constructor(options: LiveFlightSearchRunnerOptions = {}) {
    this.options = options
    this.composer = options.composer ?? createLiveFlightSearchComposer()
    this.mapper = options.mapper ?? createLiveFlightSearchMapper()
    this.metrics = options.metrics ?? createLiveFlightSearchMetrics()
    this.logger = options.logger ?? createSilentLiveFlightSearchLogger()
  }

  getMetrics(): LiveFlightSearchMetrics {
    return this.metrics
  }

  getStructuredLogs(): readonly LiveFlightSearchLogEntry[] {
    return this.logs.slice()
  }

  clearStructuredLogs(): void {
    this.logs.length = 0
  }

  private emit(
    level: LiveFlightSearchLogEntry['level'],
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const safeMeta = meta ? redactSecrets(meta) : undefined
    const entry: LiveFlightSearchLogEntry = {
      at: new Date().toISOString(),
      level,
      message,
      meta: safeMeta,
    }
    this.logs.push(entry)
    this.logger(entry)
  }

  async search(criteria: LiveFlightSearchCriteria): Promise<LiveFlightSearchResult> {
    if (!isLiveFlightSearchEnabled({ enabled: this.options.enabled })) {
      this.emit('info', 'live_flight_search.disabled')
      return disabledResult(criteria)
    }

    const started = Date.now()
    this.emit('info', 'live_flight_search.start', {
      origin: criteria.origin,
      destination: criteria.destination,
      departureDate: criteria.departureDate,
    })

    const validation = validateLiveFlightSearchCriteria(criteria)
    if (!validation.ok || !validation.normalized) {
      const latencyMs = Math.max(0, Date.now() - started)
      this.metrics.recordSearch({
        ok: false,
        latencyMs,
        validationFailed: true,
      })
      this.emit('warn', 'live_flight_search.validation_failed', {
        errors: validation.errors,
      })
      return {
        version: SPRINT105_LIVE_FLIGHT_SEARCH_VERSION,
        enabled: true,
        ok: false,
        empty: true,
        flights: [],
        flightOffers: [],
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
          origin: criteria.origin ?? null,
          destination: criteria.destination ?? null,
          departureDate: criteria.departureDate ?? null,
          adults: criteria.adults ?? null,
          children: criteria.children ?? null,
          currency: criteria.currency ?? null,
          providerId: null,
          maxResults: criteria.maxResults ?? null,
          nonStop: criteria.nonStop ?? null,
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
          ?? createGatewayProviderRegistry({
            amadeus: composed.amadeusOptions,
          }),
        healthMonitor: this.options.healthMonitor,
        nowMs: this.options.nowMs,
        sleep: this.options.sleep,
        timeoutMs: this.options.timeoutMs ?? normalized.timeoutMs,
        maxAttempts: this.options.maxAttempts,
      })

    const gatewayResponse = await gateway.execute(composed.gatewayRequest)
    const result = this.mapper.mapResponse(gatewayResponse, {
      enabled: true,
      meta: {
        origin: normalized.origin,
        destination: normalized.destination,
        departureDate: normalized.departureDate,
        adults: normalized.adults ?? 1,
        children: normalized.children ?? 0,
        currency: normalized.currency ?? 'SAR',
        providerId: gatewayResponse.providerId,
        maxResults: normalized.maxResults ?? 20,
        nonStop: normalized.nonStop ?? false,
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

    this.emit(result.ok ? 'info' : 'error', 'live_flight_search.done', {
      ok: result.ok,
      empty: result.empty,
      offerCount: result.flights.length,
      code: result.error?.code ?? null,
      attempts: result.attempts,
      latencyMs: result.latencyMs,
    })

    return result
  }
}

export function createLiveFlightSearchRunner(
  options?: LiveFlightSearchRunnerOptions,
): LiveFlightSearchRunner {
  return new LiveFlightSearchRunner(options)
}

export async function runLiveFlightSearch(
  criteria: LiveFlightSearchCriteria,
  options?: LiveFlightSearchRunnerOptions,
): Promise<LiveFlightSearchResult> {
  return createLiveFlightSearchRunner(options).search(criteria)
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
