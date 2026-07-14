import type { ProviderAdapter, ProviderSearchResult } from '../../searchOrchestrator'
import type { SearchProvider } from '../../searchOrchestrator'
import type { ProviderRequest } from '../providers/base'
import type { FlightProvider } from '../providers/FlightProvider'
import type { HotelProvider } from '../providers/HotelProvider'
import type { ActivityProvider } from '../providers/ActivityProvider'
import type { TransferProvider } from '../providers/TransferProvider'
import type { ProviderResult } from '../result'
import type { FlightOffer } from '../models/flight'
import type { HotelOffer } from '../models/hotel'
import type { ActivityOffer } from '../models/activity'
import type { TransferOffer } from '../models/transfer'
import type { TravelSearchRequest } from '../../travelSearchRequest'
import { flightOfferToSearchResult, hotelOfferToSearchResult, activityOfferToSearchResult, transferOfferToSearchResult } from './toSearchResult'

type AnyContractProvider = FlightProvider | HotelProvider | ActivityProvider | TransferProvider

function makeLegacyProvider(id: string, name: string, type: string, priority: number): SearchProvider {
  return { id, name, type: type as SearchProvider['type'], priority, enabled: true }
}

function extractData<T>(result: ProviderResult<T[]>): T[] {
  return result.success && result.data ? result.data : []
}

export function flightContractToAdapter(provider: FlightProvider): { provider: SearchProvider; adapter: ProviderAdapter } {
  const meta = provider.metadata
  return {
    provider: makeLegacyProvider(meta.id, meta.name, 'flight', meta.priority),
    adapter: (_p: SearchProvider, _req: TravelSearchRequest): ProviderSearchResult[] => {
      throw new Error('Async contract provider cannot be called synchronously — use contractToAdapterAsync instead')
    },
  }
}

export function hotelContractToAdapter(provider: HotelProvider): { provider: SearchProvider; adapter: ProviderAdapter } {
  const meta = provider.metadata
  return {
    provider: makeLegacyProvider(meta.id, meta.name, 'hotel', meta.priority),
    adapter: (_p: SearchProvider, _req: TravelSearchRequest): ProviderSearchResult[] => {
      throw new Error('Async contract provider cannot be called synchronously — use contractToAdapterAsync instead')
    },
  }
}

export function activityContractToAdapter(provider: ActivityProvider): { provider: SearchProvider; adapter: ProviderAdapter } {
  const meta = provider.metadata
  return {
    provider: makeLegacyProvider(meta.id, meta.name, 'activity', meta.priority),
    adapter: (_p: SearchProvider, _req: TravelSearchRequest): ProviderSearchResult[] => {
      throw new Error('Async contract provider cannot be called synchronously — use contractToAdapterAsync instead')
    },
  }
}

export function transferContractToAdapter(provider: TransferProvider): { provider: SearchProvider; adapter: ProviderAdapter } {
  const meta = provider.metadata
  return {
    provider: makeLegacyProvider(meta.id, meta.name, 'transportation', meta.priority),
    adapter: (_p: SearchProvider, _req: TravelSearchRequest): ProviderSearchResult[] => {
      throw new Error('Async contract provider cannot be called synchronously — use contractToAdapterAsync instead')
    },
  }
}

export async function contractToAdapterAsync(
  provider: AnyContractProvider,
  req: TravelSearchRequest,
): Promise<ProviderSearchResult[]> {
  const request: ProviderRequest = { search: req }
  const meta = provider.metadata

  if (meta.type === 'flight') {
    const result = await (provider as FlightProvider).searchFlights(request)
    return extractData<FlightOffer>(result).map(o => {
      const sr = flightOfferToSearchResult(o)
      sr.providerName = meta.name
      return sr
    })
  }
  if (meta.type === 'hotel') {
    const result = await (provider as HotelProvider).searchHotels(request)
    return extractData<HotelOffer>(result).map(o => {
      const sr = hotelOfferToSearchResult(o)
      sr.providerName = meta.name
      return sr
    })
  }
  if (meta.type === 'activity') {
    const result = await (provider as ActivityProvider).searchActivities(request)
    return extractData<ActivityOffer>(result).map(o => {
      const sr = activityOfferToSearchResult(o)
      sr.providerName = meta.name
      return sr
    })
  }
  if (meta.type === 'transfer') {
    const result = await (provider as TransferProvider).searchTransfers(request)
    return extractData<TransferOffer>(result).map(o => {
      const sr = transferOfferToSearchResult(o)
      sr.providerName = meta.name
      return sr
    })
  }
  return []
}

