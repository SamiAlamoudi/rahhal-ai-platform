import type { FlightOffer } from '../../utils/contracts/models/flight'
import type { ProviderRequest } from '../../utils/contracts/providers/base'
import type { FlightProvider } from '../../utils/contracts/providers/FlightProvider'
import { MockFlightAdapter } from '../adapters/MockFlightAdapter'
import { getProviderRegistry } from '../registry'
import {
  clearMultiProviderConfigCache,
  executeProviderChain,
  getMultiProviderConfig,
  resetMultiProviderRegistry,
} from '../multiProvider'

export interface FlightModel {
  source: 'mock' | 'real' | 'fallback'
  offers: FlightOffer[]
  latency: number
  error: string | null
  /** Multi-provider diagnostics (optional). */
  providerId?: string
  fallbackCount?: number
}

export interface FlightService {
  searchFlights(req: ProviderRequest): Promise<FlightModel>
}

export function createFlightService(): FlightService {
  return {
    async searchFlights(req: ProviderRequest): Promise<FlightModel> {
      const config = getMultiProviderConfig()
      if (config.enabled) {
        const chain = await executeProviderChain<FlightOffer[]>({
          domain: 'flight',
          req,
        })
        if (chain.success && chain.data) {
          return {
            source: chain.source,
            offers: chain.data,
            latency: chain.latencyMs,
            error: null,
            providerId: chain.providerId,
            fallbackCount: chain.fallbackCount,
          }
        }
        // Ultimate safety: mock if chain somehow failed without mock success.
        const mock = new MockFlightAdapter()
        const fallbackResult = await mock.searchFlights(req)
        return {
          source: 'fallback',
          offers: fallbackResult.data ?? [],
          latency: chain.latencyMs,
          error: chain.error ?? 'All flight providers failed',
          providerId: 'mock',
          fallbackCount: chain.fallbackCount,
        }
      }

      // Legacy single-adapter path (VITE_MULTI_PROVIDER_ENABLED=false)
      const provider = getProviderRegistry().getFlight()
      if (provider) {
        try {
          const result = await provider.searchFlights(req)
          if (result.success && result.data) {
            const source: FlightModel['source'] = provider.metadata.id.startsWith('mock') ? 'mock' : 'real'
            return { source, offers: result.data, latency: result.latency, error: null }
          }
          const mock = new MockFlightAdapter()
          const fallbackResult = await mock.searchFlights(req)
          return {
            source: 'fallback',
            offers: fallbackResult.data ?? [],
            latency: result.latency,
            error: result.errors[0]?.message ?? 'Provider returned no data',
          }
        } catch {
          const mock = new MockFlightAdapter()
          const fallbackResult = await mock.searchFlights(req)
          return {
            source: 'fallback',
            offers: fallbackResult.data ?? [],
            latency: 0,
            error: 'Provider threw an exception',
          }
        }
      }
      const mock = new MockFlightAdapter()
      const fallbackResult = await mock.searchFlights(req)
      return {
        source: 'fallback',
        offers: fallbackResult.data ?? [],
        latency: fallbackResult.latency,
        error: 'No flight provider registered',
      }
    },
  }
}

let cachedService: FlightService | null = null

export function getFlightService(): FlightService {
  if (cachedService) return cachedService
  cachedService = createFlightService()
  return cachedService
}

export function resetFlightService(): void {
  cachedService = null
  clearMultiProviderConfigCache()
  resetMultiProviderRegistry()
}

export type { FlightProvider }
