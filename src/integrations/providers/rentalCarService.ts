import type { Vehicle } from '../../utils/contracts/models/rentalCar'
import type { ProviderRequest } from '../../utils/contracts/providers/base'
import type { RentalCarProvider } from '../../utils/contracts/providers/RentalCarProvider'
import { MockRentalCarAdapter } from '../adapters/MockRentalCarAdapter'
import { getProviderRegistry } from '../registry'
import {
  executeProviderChain,
  getMultiProviderConfig,
} from '../multiProvider'

export interface RentalCarModel {
  source: 'mock' | 'real' | 'fallback'
  vehicles: Vehicle[]
  latency: number
  error: string | null
  providerId?: string
  fallbackCount?: number
}

export interface RentalCarService {
  searchRentalCars(req: ProviderRequest): Promise<RentalCarModel>
}

export function createRentalCarService(): RentalCarService {
  return {
    async searchRentalCars(req: ProviderRequest): Promise<RentalCarModel> {
      if (getMultiProviderConfig().enabled) {
        const chain = await executeProviderChain<Vehicle[]>({ domain: 'cars', req })
        if (chain.success && chain.data) {
          return {
            source: chain.source,
            vehicles: chain.data,
            latency: chain.latencyMs,
            error: null,
            providerId: chain.providerId,
            fallbackCount: chain.fallbackCount,
          }
        }
        const mock = new MockRentalCarAdapter()
        const fallbackResult = await mock.searchRentalCars(req)
        return {
          source: 'fallback',
          vehicles: fallbackResult.data ?? [],
          latency: chain.latencyMs,
          error: chain.error ?? 'All rental car providers failed',
          providerId: 'mock',
          fallbackCount: chain.fallbackCount,
        }
      }

      const provider = getProviderRegistry().getRentalCar()
      if (provider) {
        try {
          const result = await provider.searchRentalCars(req)
          if (result.success && result.data) {
            const source: RentalCarModel['source'] = provider.metadata.id.startsWith('mock') ? 'mock' : 'real'
            return { source, vehicles: result.data, latency: result.latency, error: null }
          }
          const mock = new MockRentalCarAdapter()
          const fallbackResult = await mock.searchRentalCars(req)
          return {
            source: 'fallback',
            vehicles: fallbackResult.data ?? [],
            latency: result.latency,
            error: result.errors[0]?.message ?? 'Provider returned no data',
          }
        } catch {
          const mock = new MockRentalCarAdapter()
          const fallbackResult = await mock.searchRentalCars(req)
          return {
            source: 'fallback',
            vehicles: fallbackResult.data ?? [],
            latency: 0,
            error: 'Provider threw an exception',
          }
        }
      }
      const mock = new MockRentalCarAdapter()
      const fallbackResult = await mock.searchRentalCars(req)
      return {
        source: 'fallback',
        vehicles: fallbackResult.data ?? [],
        latency: fallbackResult.latency,
        error: 'No rental car provider registered',
      }
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
