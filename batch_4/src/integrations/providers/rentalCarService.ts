import type { Vehicle } from '../../utils/contracts/models/rentalCar'
import type { ProviderRequest } from '../../utils/contracts/providers/base'
import type { ProviderResult } from '../../utils/contracts/result'
import type { RentalCarProvider } from '../../utils/contracts/providers/RentalCarProvider'
import { getProviderRegistry } from '../registry'
import { MockRentalCarAdapter } from '../adapters/MockRentalCarAdapter'

export interface RentalCarModel {
  source: 'mock' | 'real' | 'fallback'
  vehicles: Vehicle[]
  latency: number
  error: string | null
}

export interface RentalCarService {
  searchRentalCars(req: ProviderRequest): Promise<RentalCarModel>
}

function buildModel(
  source: RentalCarModel['source'],
  result: ProviderResult<Vehicle[]>,
  fallbackError: string | null,
): RentalCarModel {
  if (!result.success || !result.data) {
    return {
      source,
      vehicles: result.data ?? [],
      latency: result.latency,
      error: fallbackError ?? result.errors[0]?.message ?? 'Unknown error',
    }
  }
  return {
    source,
    vehicles: result.data,
    latency: result.latency,
    error: fallbackError,
  }
}

export function createRentalCarService(): RentalCarService {
  async function searchWithFallback(req: ProviderRequest): Promise<RentalCarModel> {
    const registry = getProviderRegistry()
    const provider = registry.getRentalCar()

    if (provider) {
      try {
        const result = await provider.searchRentalCars(req)
        if (result.success && result.data) {
          const source: RentalCarModel['source'] = provider.metadata.id.startsWith('mock') ? 'mock' : 'real'
          return buildModel(source, result, null)
        }
        const mock = new MockRentalCarAdapter()
        const fallbackResult = await mock.searchRentalCars(req)
        return buildModel('fallback', fallbackResult, result.errors[0]?.message ?? 'Provider returned no data')
      } catch {
        const mock = new MockRentalCarAdapter()
        const fallbackResult = await mock.searchRentalCars(req)
        return buildModel('fallback', fallbackResult, 'Provider threw an exception')
      }
    }

    const mock = new MockRentalCarAdapter()
    const fallbackResult = await mock.searchRentalCars(req)
    return buildModel('fallback', fallbackResult, 'No rental car provider registered')
  }

  return {
    async searchRentalCars(req: ProviderRequest): Promise<RentalCarModel> {
      return searchWithFallback(req)
    },
  }
}

let cachedService: RentalCarService | null = null

export function getRentalCarService(): RentalCarService {
  if (cachedService) return cachedService
  cachedService = createRentalCarService()
  return cachedService
}

export function resetRentalCarService(): void {
  cachedService = null
}

export type { RentalCarProvider }
