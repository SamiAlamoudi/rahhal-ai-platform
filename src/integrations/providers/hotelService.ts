import type { HotelOffer } from '../../utils/contracts/models/hotel'
import type { ProviderRequest } from '../../utils/contracts/providers/base'
import type { HotelProvider } from '../../utils/contracts/providers/HotelProvider'
import { MockHotelAdapter } from '../adapters/MockHotelAdapter'
import { getProviderRegistry } from '../registry'
import {
  executeProviderChain,
  getMultiProviderConfig,
} from '../multiProvider'

export interface HotelModel {
  source: 'mock' | 'real' | 'fallback'
  offers: HotelOffer[]
  latency: number
  error: string | null
  providerId?: string
  fallbackCount?: number
}

export interface HotelService {
  searchHotels(req: ProviderRequest): Promise<HotelModel>
}

export function createHotelService(): HotelService {
  return {
    async searchHotels(req: ProviderRequest): Promise<HotelModel> {
      if (getMultiProviderConfig().enabled) {
        const chain = await executeProviderChain<HotelOffer[]>({ domain: 'hotel', req })
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
        const mock = new MockHotelAdapter()
        const fallbackResult = await mock.searchHotels(req)
        return {
          source: 'fallback',
          offers: fallbackResult.data ?? [],
          latency: chain.latencyMs,
          error: chain.error ?? 'All hotel providers failed',
          providerId: 'mock',
          fallbackCount: chain.fallbackCount,
        }
      }

      const provider = getProviderRegistry().getHotel()
      if (provider) {
        try {
          const result = await provider.searchHotels(req)
          if (result.success && result.data) {
            const source: HotelModel['source'] = provider.metadata.id.startsWith('mock') ? 'mock' : 'real'
            return { source, offers: result.data, latency: result.latency, error: null }
          }
          const mock = new MockHotelAdapter()
          const fallbackResult = await mock.searchHotels(req)
          return {
            source: 'fallback',
            offers: fallbackResult.data ?? [],
            latency: result.latency,
            error: result.errors[0]?.message ?? 'Provider returned no data',
          }
        } catch {
          const mock = new MockHotelAdapter()
          const fallbackResult = await mock.searchHotels(req)
          return {
            source: 'fallback',
            offers: fallbackResult.data ?? [],
            latency: 0,
            error: 'Provider threw an exception',
          }
        }
      }
      const mock = new MockHotelAdapter()
      const fallbackResult = await mock.searchHotels(req)
      return {
        source: 'fallback',
        offers: fallbackResult.data ?? [],
        latency: fallbackResult.latency,
        error: 'No hotel provider registered',
      }
    },
  }
}

let cachedService: HotelService | null = null

export function getHotelService(): HotelService {
  if (cachedService) return cachedService
  cachedService = createHotelService()
  return cachedService
}

export function resetHotelService(): void {
  cachedService = null
}

export type { HotelProvider }
