import type { FlightOffer } from '../../utils/contracts/models/flight'
import type { ProviderRequest } from '../../utils/contracts/providers/base'
import type { ProviderResult } from '../../utils/contracts/result'
import type { FlightProvider } from '../../utils/contracts/providers/FlightProvider'
import { getProviderRegistry } from '../registry'
import { MockFlightAdapter } from '../adapters/MockFlightAdapter'

export interface FlightModel {
  source: 'mock' | 'real' | 'fallback'
  offers: FlightOffer[]
  latency: number
  error: string | null
}

export interface FlightService {
  searchFlights(req: ProviderRequest): Promise<FlightModel>
}

function buildModel(
  source: FlightModel['source'],
  result: ProviderResult<FlightOffer[]>,
  fallbackError: string | null,
): FlightModel {
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

export function createFlightService(): FlightService {
  async function searchWithFallback(req: ProviderRequest): Promise<FlightModel> {
    const registry = getProviderRegistry()
    const provider = registry.getFlight()

    if (provider) {
      try {
        const result = await provider.searchFlights(req)
        if (result.success && result.data) {
          const source: FlightModel['source'] = provider.metadata.id.startsWith('mock') ? 'mock' : 'real'
          return buildModel(source, result, null)
        }
        const mock = new MockFlightAdapter()
        const fallbackResult = await mock.searchFlights(req)
        return buildModel('fallback', fallbackResult, result.errors[0]?.message ?? 'Provider returned no data')
      } catch {
        const mock = new MockFlightAdapter()
        const fallbackResult = await mock.searchFlights(req)
        return buildModel('fallback', fallbackResult, 'Provider threw an exception')
      }
    }

    const mock = new MockFlightAdapter()
    const fallbackResult = await mock.searchFlights(req)
    return buildModel('fallback', fallbackResult, 'No flight provider registered')
  }

  return {
    async searchFlights(req: ProviderRequest): Promise<FlightModel> {
      return searchWithFallback(req)
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
}

export type { FlightProvider }
