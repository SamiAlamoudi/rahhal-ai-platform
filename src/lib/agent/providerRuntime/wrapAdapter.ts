/**
 * Sprint 71 — Wrap existing LiveProviderSdk into unified ProviderRuntimeAdapter.
 */

import type { LiveProviderSdk } from '../liveProviders/types'
import { ProviderRuntimeHealthMonitor } from './healthMonitor'
import { createProviderRetryPolicy, type ProviderRetryPolicy } from './retryPolicy'
import {
  GRACEFUL_PROVIDER_MESSAGE,
  type ProviderRuntimeAdapter,
  type ProviderRuntimeAuthResult,
  type ProviderRuntimeBookRequest,
  type ProviderRuntimeBookResult,
  type ProviderRuntimeCancelRequest,
  type ProviderRuntimeCancelResult,
  type ProviderRuntimeCapabilities,
  type ProviderRuntimeHealth,
  type ProviderRuntimeId,
  type ProviderRuntimeMode,
  type ProviderRuntimeRefreshRequest,
  type ProviderRuntimeRefreshResult,
  type ProviderRuntimeSearchRequest,
  type ProviderRuntimeSearchResult,
} from './types'

export function wrapLiveSdkAsRuntimeAdapter(input: {
  providerId: ProviderRuntimeId
  displayName: string
  mode: ProviderRuntimeMode
  sdk: LiveProviderSdk | null
  healthMonitor: ProviderRuntimeHealthMonitor
  retry?: ProviderRetryPolicy
  authOk: boolean
  authDetail: string
}): ProviderRuntimeAdapter {
  const retry = input.retry ?? createProviderRetryPolicy()
  let initialized = false
  input.healthMonitor.setMode(input.providerId, input.mode)

  const adapter: ProviderRuntimeAdapter = {
    providerId: input.providerId,
    displayName: input.displayName,

    async initialize() {
      initialized = true
    },

    async authenticate(): Promise<ProviderRuntimeAuthResult> {
      return {
        ok: input.authOk || input.mode === 'mock',
        mode: input.mode,
        detail: input.authDetail,
      }
    },

    health(): ProviderRuntimeHealth {
      const available =
        input.mode === 'mock'
        || (input.sdk?.isAvailable() ?? false)
      return input.healthMonitor.snapshot(input.providerId, available && initialized)
    },

    capabilities(): ProviderRuntimeCapabilities {
      const caps = input.sdk?.capabilities
      return {
        flights: Boolean(caps?.flights) || input.mode === 'mock',
        hotels: Boolean(caps?.hotels) || input.mode === 'mock',
        book: Boolean(input.sdk?.createOrder) || input.mode === 'mock',
        cancel: Boolean(input.sdk?.cancelOrder) || input.mode === 'mock',
        refresh: Boolean(input.sdk?.retrieveOrder) || input.mode === 'mock',
      }
    },

    async search(request: ProviderRuntimeSearchRequest): Promise<ProviderRuntimeSearchResult> {
      const started = Date.now()
      if (!initialized) await adapter.initialize()

      if (input.mode === 'mock' || !input.sdk) {
        const offers = buildMockOffers(input.providerId, request)
        input.healthMonitor.recordSuccess(input.providerId, Date.now() - started)
        return {
          ok: true,
          providerId: input.providerId,
          mode: 'mock',
          offers,
          latencyMs: Date.now() - started,
        }
      }

      const outcome = await retry.execute(input.providerId, async (signal) => {
        const req = { ...request, signal: request.signal ?? signal }
        if (req.domain === 'flights' && input.sdk!.searchFlights) {
          return input.sdk!.searchFlights!({
            origin: req.origin ?? 'RUH',
            destination: req.destination ?? 'DXB',
            departureDate: req.departureDate ?? '2026-08-01',
            returnDate: req.returnDate,
            adults: req.adults ?? 1,
            children: req.children ?? 0,
            cabin: req.cabin ?? null,
            currency: req.currency ?? 'SAR',
            signal: req.signal,
          })
        }
        if (req.domain === 'hotels' && input.sdk!.searchHotels) {
          return input.sdk!.searchHotels!({
            destination: req.destination ?? 'Dubai',
            checkIn: req.checkIn ?? req.departureDate ?? '2026-08-01',
            checkOut: req.checkOut ?? req.returnDate,
            adults: req.adults ?? 1,
            currency: req.currency ?? 'SAR',
            signal: req.signal,
          })
        }
        return [] as unknown[]
      })

      const latencyMs = Date.now() - started
      if (!outcome.ok) {
        input.healthMonitor.recordFailure(input.providerId, latencyMs, outcome.attempts > 1)
        return {
          ok: false,
          providerId: input.providerId,
          mode: input.mode,
          offers: [],
          latencyMs,
          error: outcome.error,
          gracefulMessage: GRACEFUL_PROVIDER_MESSAGE,
        }
      }
      input.healthMonitor.recordSuccess(input.providerId, latencyMs)
      return {
        ok: true,
        providerId: input.providerId,
        mode: input.mode,
        offers: (outcome.value as unknown[]) ?? [],
        latencyMs,
      }
    },

    async book(request: ProviderRuntimeBookRequest): Promise<ProviderRuntimeBookResult> {
      if (!initialized) await adapter.initialize()
      if (input.mode === 'mock' || !input.sdk?.createOrder) {
        return {
          ok: true,
          providerId: input.providerId,
          orderId: `mock_order_${request.offerId}`,
        }
      }
      try {
        const result = await input.sdk.createOrder(request.offerId, request.signal)
        if (!result.ok) {
          input.healthMonitor.recordFailure(input.providerId, 0, Boolean(result.retryable))
          return {
            ok: false,
            providerId: input.providerId,
            error: result.error,
            retryable: result.retryable,
            gracefulMessage: GRACEFUL_PROVIDER_MESSAGE,
          }
        }
        input.healthMonitor.recordSuccess(input.providerId, 0)
        return {
          ok: true,
          providerId: input.providerId,
          orderId: result.orderId,
        }
      } catch (err) {
        input.healthMonitor.recordFailure(input.providerId, 0, true)
        return {
          ok: false,
          providerId: input.providerId,
          error: err instanceof Error ? err.message : String(err),
          retryable: true,
          gracefulMessage: GRACEFUL_PROVIDER_MESSAGE,
        }
      }
    },

    async cancel(request: ProviderRuntimeCancelRequest): Promise<ProviderRuntimeCancelResult> {
      if (!initialized) await adapter.initialize()
      if (input.mode === 'mock' || !input.sdk?.cancelOrder) {
        return { ok: true, providerId: input.providerId }
      }
      try {
        const result = await input.sdk.cancelOrder(request.orderId, request.signal)
        return {
          ok: result.ok,
          providerId: input.providerId,
          error: result.error,
          gracefulMessage: result.ok ? undefined : GRACEFUL_PROVIDER_MESSAGE,
        }
      } catch (err) {
        return {
          ok: false,
          providerId: input.providerId,
          error: err instanceof Error ? err.message : String(err),
          gracefulMessage: GRACEFUL_PROVIDER_MESSAGE,
        }
      }
    },

    async refresh(request: ProviderRuntimeRefreshRequest): Promise<ProviderRuntimeRefreshResult> {
      if (!initialized) await adapter.initialize()
      if (input.mode === 'mock' || !input.sdk?.retrieveOrder) {
        return {
          ok: true,
          providerId: input.providerId,
          order: { orderId: request.orderId, status: 'confirmed', mode: 'mock' },
        }
      }
      try {
        const order = await input.sdk.retrieveOrder(request.orderId, request.signal)
        return {
          ok: Boolean(order),
          providerId: input.providerId,
          order,
          error: order ? undefined : 'not_found',
          gracefulMessage: order ? undefined : GRACEFUL_PROVIDER_MESSAGE,
        }
      } catch (err) {
        return {
          ok: false,
          providerId: input.providerId,
          error: err instanceof Error ? err.message : String(err),
          gracefulMessage: GRACEFUL_PROVIDER_MESSAGE,
        }
      }
    },
  }

  return adapter
}

function buildMockOffers(
  providerId: ProviderRuntimeId,
  request: ProviderRuntimeSearchRequest,
): unknown[] {
  if (request.domain === 'hotels') {
    return [
      {
        id: `mock_hotel_${providerId}_1`,
        providerId,
        name: 'Mock Hotel',
        destination: request.destination ?? 'Dubai',
        mode: 'mock',
      },
    ]
  }
  return [
    {
      id: `mock_flight_${providerId}_1`,
      providerId,
      from: request.origin ?? 'RUH',
      to: request.destination ?? 'DXB',
      mode: 'mock',
    },
  ]
}
