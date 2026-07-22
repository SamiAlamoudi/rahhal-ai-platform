/**
 * Sprint 104 — Single Provider Gateway (Production Phase 1).
 *
 * Orchestrates: registry → availability → request build → retry/timeout →
 * live provider → response map → metrics → structured logs.
 *
 * Feature flag `ai.live_provider_gateway` is enforced by the agent bridge.
 * Core gateway always executes when called (engines remain unchanged).
 */

import {
  createProviderRetryPolicy,
  type ProviderSearchResult,
  type TravelProvider,
} from '../providers'
import type { GatewayProviderRegistry } from './ProviderRegistry'
import { createGatewayProviderRegistry } from './ProviderRegistry'
import {
  createProviderHealthMonitor,
  type ProviderHealthMonitor,
} from './ProviderHealthMonitor'
import { checkRegistryAvailability } from './ProviderAvailability'
import { buildProviderRequest } from './ProviderRequestBuilder'
import { mapProviderSearchResult } from './ProviderResponseMapper'
import {
  translateOutcomeError,
  translateProviderError,
} from './ProviderErrorTranslator'
import {
  createGatewayMetrics,
  type GatewayMetrics,
} from './ProviderMetrics'
import type {
  GatewayLogEntry,
  GatewayOffer,
  GatewayOperation,
  GatewayProviderId,
  GatewayRequest,
  GatewayResponse,
  GatewayStructuredLogger,
} from './types'
import {
  SPRINT104_PROVIDER_GATEWAY_VERSION,
  createSilentGatewayLogger,
} from './types'

export interface ProviderGatewayOptions {
  readonly registry?: GatewayProviderRegistry
  readonly healthMonitor?: ProviderHealthMonitor
  readonly metrics?: GatewayMetrics
  readonly logger?: GatewayStructuredLogger
  readonly nowMs?: () => number
  readonly sleep?: (ms: number) => Promise<void>
  /** Override default retry timeout (ms). */
  readonly timeoutMs?: number
  /** Override max retry attempts. */
  readonly maxAttempts?: number
}

export interface ProviderGateway {
  readonly version: typeof SPRINT104_PROVIDER_GATEWAY_VERSION
  readonly registry: GatewayProviderRegistry
  readonly healthMonitor: ProviderHealthMonitor
  readonly metrics: GatewayMetrics
  execute(request: GatewayRequest): Promise<GatewayResponse>
  getStructuredLogs(): readonly GatewayLogEntry[]
  clearStructuredLogs(): void
}

export function createProviderGateway(
  options: ProviderGatewayOptions = {},
): ProviderGateway {
  const registry = options.registry ?? createGatewayProviderRegistry()
  const healthMonitor =
    options.healthMonitor ?? createProviderHealthMonitor(registry)
  const metrics = options.metrics ?? createGatewayMetrics()
  const logger = options.logger ?? createSilentGatewayLogger()
  const nowMs = options.nowMs ?? (() => Date.now())
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const logs: GatewayLogEntry[] = []

  function emit(
    level: GatewayLogEntry['level'],
    message: string,
    fields?: {
      providerId?: string
      operation?: GatewayOperation
      meta?: Record<string, unknown>
    },
  ): void {
    const entry: GatewayLogEntry = {
      at: new Date(nowMs()).toISOString(),
      level,
      message,
      providerId: fields?.providerId,
      operation: fields?.operation,
      meta: fields?.meta,
    }
    logs.push(entry)
    logger(entry)
  }

  function baseResponse(
    request: GatewayRequest,
    partial: Partial<GatewayResponse> & {
      ok: boolean
      latencyMs: number
      attempts: number
    },
  ): GatewayResponse {
    const offers = partial.offers ?? []
    return {
      version: SPRINT104_PROVIDER_GATEWAY_VERSION,
      enabled: true,
      operation: request.operation,
      providerId: request.providerId ?? partial.providerId ?? null,
      ok: partial.ok,
      offers,
      empty: offers.length === 0,
      partial: partial.partial ?? false,
      latencyMs: partial.latencyMs,
      attempts: partial.attempts,
      error: partial.error ?? null,
      logs: logs.map((l) => l.message),
    }
  }

  async function execute(request: GatewayRequest): Promise<GatewayResponse> {
    const started = nowMs()
    const preferredId = request.providerId ?? 'amadeus'
    emit('info', 'gateway.execute.start', {
      providerId: preferredId,
      operation: request.operation,
    })

    const availability = checkRegistryAvailability(registry, preferredId)
    if (!availability.available) {
      const error = translateProviderError(
        preferredId,
        new Error(availability.reason ?? 'Provider unavailable'),
      )
      metrics.record({
        providerId: preferredId,
        operation: request.operation,
        ok: false,
        latencyMs: Math.max(0, nowMs() - started),
        error: error.message,
      })
      emit('warn', 'gateway.execute.unavailable', {
        providerId: preferredId,
        operation: request.operation,
        meta: { reason: availability.reason },
      })
      return baseResponse(request, {
        ok: false,
        providerId: preferredId,
        latencyMs: Math.max(0, nowMs() - started),
        attempts: 0,
        error,
      })
    }

    const registered = registry.resolve(preferredId)
    if (!registered) {
      const error = translateProviderError(
        preferredId,
        new Error('Provider resolve failed'),
      )
      return baseResponse(request, {
        ok: false,
        providerId: preferredId,
        latencyMs: Math.max(0, nowMs() - started),
        attempts: 0,
        error,
      })
    }

    const providerId = registered.descriptor.id
    const provider = registered.provider

    try {
      if (request.operation === 'health') {
        const snapshot = await healthMonitor.check(providerId, request.signal)
        const latencyMs = Math.max(0, nowMs() - started)
        const ok =
          snapshot.status === 'available' || snapshot.status === 'degraded'
        metrics.record({
          providerId,
          operation: 'health',
          ok,
          latencyMs,
          error: ok ? null : snapshot.status,
        })
        emit(ok ? 'info' : 'warn', 'gateway.execute.health', {
          providerId,
          operation: 'health',
          meta: { status: snapshot.status, latencyMs },
        })
        return baseResponse(request, {
          ok,
          providerId,
          latencyMs,
          attempts: 1,
          error: ok
            ? null
            : translateOutcomeError({
                providerId,
                error: `Health status: ${snapshot.status}`,
                code: 'UNAVAILABLE',
              }),
        })
      }

      const built = buildProviderRequest(request)
      if (!built) {
        const error = translateOutcomeError({
          providerId,
          error: 'Invalid or incomplete gateway search criteria',
          code: 'INVALID_REQUEST',
        })
        emit('warn', 'gateway.execute.invalid_request', {
          providerId,
          operation: request.operation,
        })
        return baseResponse(request, {
          ok: false,
          providerId,
          latencyMs: Math.max(0, nowMs() - started),
          attempts: 0,
          error,
        })
      }

      const timeoutMs = request.timeoutMs ?? options.timeoutMs ?? 5_000
      const retry = createProviderRetryPolicy({
        maxAttempts: options.maxAttempts ?? 3,
        baseDelayMs: 40,
        maxDelayMs: 400,
        timeoutMs,
        sleep,
      })

      const outcome = await retry.execute(providerId, async (signal) => {
        emit('info', 'gateway.provider.attempt', {
          providerId,
          operation: request.operation,
        })
        return invokeSearch(provider, built, signal)
      })

      const latencyMs = Math.max(0, nowMs() - started)

      if (!outcome.ok || !outcome.value) {
        const error = translateOutcomeError({
          providerId,
          error: outcome.error,
          code: outcome.code,
          timedOut: outcome.timedOut,
          circuitOpen: outcome.circuitOpen,
        })
        metrics.record({
          providerId,
          operation: request.operation,
          ok: false,
          latencyMs,
          timedOut: outcome.timedOut,
          error: error.message,
        })
        emit('error', 'gateway.execute.failed', {
          providerId,
          operation: request.operation,
          meta: {
            code: error.code,
            attempts: outcome.attempts,
            rateLimited: error.rateLimited,
            timedOut: error.timedOut,
          },
        })
        return baseResponse(request, {
          ok: false,
          providerId,
          latencyMs,
          attempts: outcome.attempts,
          error,
        })
      }

      const searchResult = outcome.value
      if (!searchResult.ok) {
        const error = translateOutcomeError({
          providerId,
          error: searchResult.error ?? 'Provider returned unsuccessful result',
          code: searchResult.retryable ? 'RETRYABLE_FAILURE' : 'PROVIDER_ERROR',
        })
        metrics.record({
          providerId,
          operation: request.operation,
          ok: false,
          latencyMs,
          error: error.message,
        })
        emit('warn', 'gateway.execute.provider_error', {
          providerId,
          operation: request.operation,
          meta: { error: searchResult.error },
        })
        return baseResponse(request, {
          ok: false,
          providerId,
          latencyMs,
          attempts: outcome.attempts,
          offers: [],
          partial: searchResult.partial,
          error,
        })
      }

      const kind =
        built.kind === 'flights'
          ? 'flight'
          : built.kind === 'hotels'
            ? 'hotel'
            : 'package'
      const offers: GatewayOffer[] = mapProviderSearchResult(
        providerId,
        kind,
        searchResult,
      )

      metrics.record({
        providerId,
        operation: request.operation,
        ok: true,
        latencyMs,
      })
      emit('info', 'gateway.execute.ok', {
        providerId,
        operation: request.operation,
        meta: {
          offerCount: offers.length,
          attempts: outcome.attempts,
          latencyMs,
        },
      })

      return baseResponse(request, {
        ok: true,
        providerId,
        offers,
        partial: searchResult.partial,
        latencyMs,
        attempts: outcome.attempts,
        error: null,
      })
    } catch (caught) {
      const latencyMs = Math.max(0, nowMs() - started)
      const error = translateProviderError(providerId, caught)
      metrics.record({
        providerId,
        operation: request.operation,
        ok: false,
        latencyMs,
        timedOut: error.timedOut,
        error: error.message,
      })
      emit('error', 'gateway.execute.exception', {
        providerId,
        operation: request.operation,
        meta: { code: error.code },
      })
      return baseResponse(request, {
        ok: false,
        providerId,
        latencyMs,
        attempts: 0,
        error,
      })
    }
  }

  return {
    version: SPRINT104_PROVIDER_GATEWAY_VERSION,
    registry,
    healthMonitor,
    metrics,
    execute,
    getStructuredLogs: () => logs.slice(),
    clearStructuredLogs: () => {
      logs.length = 0
    },
  }
}

async function invokeSearch(
  provider: TravelProvider,
  built: NonNullable<ReturnType<typeof buildProviderRequest>>,
  signal: AbortSignal,
): Promise<ProviderSearchResult> {
  if (built.kind === 'flights') {
    return provider.searchFlights({ ...built.request, signal })
  }
  if (built.kind === 'hotels') {
    return provider.searchHotels({ ...built.request, signal })
  }
  return provider.searchPackages({ ...built.request, signal })
}

/** Convenience: Amadeus flight search through the gateway. */
export async function executeAmadeusFlightSearch(
  gateway: ProviderGateway,
  input: {
    readonly origin: string
    readonly destination: string
    readonly departureDate: string
    readonly returnDate?: string | null
    readonly adults?: number
    readonly currency?: string
    readonly timeoutMs?: number
    readonly signal?: AbortSignal
  },
): Promise<GatewayResponse> {
  return gateway.execute({
    providerId: 'amadeus' satisfies GatewayProviderId,
    operation: 'search_flights',
    flight: {
      origin: input.origin,
      destination: input.destination,
      departureDate: input.departureDate,
      returnDate: input.returnDate,
      adults: input.adults,
      currency: input.currency,
    },
    timeoutMs: input.timeoutMs,
    signal: input.signal,
  })
}
