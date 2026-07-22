/**
 * Sprint 90 — mock / sandbox provider implementations for readiness tests.
 */

import { DEFAULT_PROVIDER_LIMITS } from './ProviderCapabilities'
import type {
  FlightSearchRequest,
  HotelSearchRequest,
  PackageSearchRequest,
  ProviderCapabilityMap,
  ProviderHealthResult,
  ProviderLimits,
  ProviderMode,
  ProviderSearchResult,
  TravelProvider,
} from './types'
import { ProviderError } from './ProviderErrors'

export interface MockTravelProviderOptions {
  id?: string
  displayName?: string
  mode?: ProviderMode
  failHealth?: boolean
  failFlights?: boolean
  failHotels?: boolean
  emptyFlights?: boolean
  partialHotels?: boolean
  latencyMs?: number
  throwOnFlights?: ProviderError | Error | null
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('timeout'))
    })
  })
}

export function createMockTravelProvider(
  options: MockTravelProviderOptions = {},
): TravelProvider {
  const id = options.id ?? 'mock'
  const mode = options.mode ?? 'mock'
  const latencyMs = options.latencyMs ?? 1

  const capabilities = (): ProviderCapabilityMap => ({
    flights: true,
    hotels: true,
    packages: true,
    booking: false,
    cancellation: false,
    sandbox: mode === 'sandbox' || mode === 'mock',
    live: mode === 'live',
  })

  const limits = (): ProviderLimits => ({ ...DEFAULT_PROVIDER_LIMITS, timeoutMs: 3_000 })

  const wrap = async <T extends Record<string, unknown>>(
    results: T[],
    signal?: AbortSignal,
    partial = false,
  ): Promise<ProviderSearchResult<T>> => {
    const started = performance.now()
    await delay(latencyMs, signal)
    return {
      ok: true,
      providerId: id,
      mode,
      results,
      partial,
      empty: results.length === 0,
      latencyMs: Math.round(performance.now() - started),
    }
  }

  return {
    id,
    displayName: options.displayName ?? `Mock Provider (${mode})`,
    mode,
    async health(signal?: AbortSignal): Promise<ProviderHealthResult> {
      const started = performance.now()
      await delay(latencyMs, signal)
      if (options.failHealth) {
        return {
          providerId: id,
          ok: false,
          mode,
          latencyMs: Math.round(performance.now() - started),
          detail: 'health_failed',
          checkedAt: new Date().toISOString(),
        }
      }
      return {
        providerId: id,
        ok: true,
        mode,
        latencyMs: Math.round(performance.now() - started),
        detail: `${mode} healthy`,
        checkedAt: new Date().toISOString(),
      }
    },
    async searchFlights(request: FlightSearchRequest) {
      if (options.throwOnFlights) throw options.throwOnFlights
      if (options.failFlights) {
        return {
          ok: false,
          providerId: id,
          mode,
          results: [],
          partial: false,
          empty: true,
          latencyMs: latencyMs,
          error: 'PROVIDER_UNAVAILABLE',
          retryable: true,
        }
      }
      if (options.emptyFlights) {
        return wrap([], request.signal, false)
      }
      return wrap([
        {
          id: `${id}-flight-1`,
          origin: request.origin,
          destination: request.destination,
          departureDate: request.departureDate,
          price: 900,
          currency: request.currency ?? 'SAR',
        },
      ], request.signal)
    },
    async searchHotels(request: HotelSearchRequest) {
      if (options.failHotels) {
        return {
          ok: false,
          providerId: id,
          mode,
          results: [],
          partial: false,
          empty: true,
          latencyMs,
          error: 'PROVIDER_UNAVAILABLE',
          retryable: true,
        }
      }
      const stays = [
        {
          id: `${id}-hotel-1`,
          name: `${request.destination} Stay`,
          checkIn: request.checkIn,
          price: 400,
          currency: request.currency ?? 'SAR',
        },
      ]
      if (options.partialHotels) {
        return wrap(stays, request.signal, true)
      }
      return wrap(stays, request.signal)
    },
    async searchPackages(request: PackageSearchRequest) {
      return wrap([
        {
          id: `${id}-pkg-1`,
          destination: request.destination,
          title: `${request.destination} package`,
          price: 1400,
          currency: request.currency ?? 'SAR',
        },
      ], request.signal)
    },
    capabilities,
    limits,
  }
}

export function createSandboxTravelProvider(
  options: Omit<MockTravelProviderOptions, 'mode'> = {},
): TravelProvider {
  return createMockTravelProvider({
    ...options,
    id: options.id ?? 'sandbox',
    displayName: options.displayName ?? 'Sandbox Provider',
    mode: 'sandbox',
  })
}

export function createLiveStubTravelProvider(
  options: Omit<MockTravelProviderOptions, 'mode'> = {},
): TravelProvider {
  return createMockTravelProvider({
    ...options,
    id: options.id ?? 'live-stub',
    displayName: options.displayName ?? 'Live Stub Provider',
    mode: 'live',
  })
}
