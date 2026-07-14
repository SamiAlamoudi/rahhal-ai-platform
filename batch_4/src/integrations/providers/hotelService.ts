import type { HotelOffer } from '../../utils/contracts/models/hotel'
import type { ProviderRequest } from '../../utils/contracts/providers/base'
import type { ProviderResult } from '../../utils/contracts/result'
import type { HotelProvider } from '../../utils/contracts/providers/HotelProvider'
import { getProviderRegistry } from '../registry'
import { MockHotelAdapter } from '../adapters/MockHotelAdapter'

export interface HotelModel {
  source: 'mock' | 'real' | 'fallback'
  offers: HotelOffer[]
  latency: number
  error: string | null
}

export interface HotelService {
  searchHotels(req: ProviderRequest): Promise<HotelModel>
}

function buildModel(
  source: HotelModel['source'],
  result: ProviderResult<HotelOffer[]>,
  fallbackError: string | null,
): HotelModel {
  if (!result.success || !result.data) {
    return {
      source,
      offers: result.data ?? [],
      latency: result.latency,
      error: fallbackError ?? result.errors[0]?.message ?? 'Unknown error',
    }
  }
  return {
    source,
    offers: result.data,
    latency: result.latency,
    error: fallbackError,
  }
}

export function createHotelService(): HotelService {
  async function searchWithFallback(req: ProviderRequest): Promise<HotelModel> {
    const registry = getProviderRegistry()
    const provider = registry.getHotel()

    if (provider) {
      try {
        const result = await provider.searchHotels(req)
        if (result.success && result.data) {
          const source: HotelModel['source'] = provider.metadata.id.startsWith('mock') ? 'mock' : 'real'
          return buildModel(source, result, null)
        }
        const mock = new MockHotelAdapter()
        const fallbackResult = await mock.searchHotels(req)
        return buildModel('fallback', fallbackResult, result.errors[0]?.message ?? 'Provider returned no data')
      } catch {
        const mock = new MockHotelAdapter()
        const fallbackResult = await mock.searchHotels(req)
        return buildModel('fallback', fallbackResult, 'Provider threw an exception')
      }
    }

    const mock = new MockHotelAdapter()
    const fallbackResult = await mock.searchHotels(req)
    return buildModel('fallback', fallbackResult, 'No hotel provider registered')
  }

  return {
    async searchHotels(req: ProviderRequest): Promise<HotelModel> {
      return searchWithFallback(req)
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
