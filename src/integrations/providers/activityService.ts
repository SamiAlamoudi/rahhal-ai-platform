import type { ActivityOffer } from '../../utils/contracts/models/activity'
import type { ProviderRequest } from '../../utils/contracts/providers/base'
import type { ActivityProvider } from '../../utils/contracts/providers/ActivityProvider'
import { MockActivityAdapter } from '../adapters/MockActivityAdapter'
import {
  executeProviderChain,
  getMultiProviderConfig,
} from '../multiProvider'

export interface ActivityModel {
  source: 'mock' | 'real' | 'fallback'
  offers: ActivityOffer[]
  latency: number
  error: string | null
  providerId?: string
  fallbackCount?: number
}

export interface ActivityService {
  searchActivities(req: ProviderRequest): Promise<ActivityModel>
}

export function createActivityService(): ActivityService {
  return {
    async searchActivities(req: ProviderRequest): Promise<ActivityModel> {
      if (getMultiProviderConfig().enabled) {
        const chain = await executeProviderChain<ActivityOffer[]>({ domain: 'activities', req })
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
      }

      const mock = new MockActivityAdapter()
      const result = await mock.searchActivities(req)
      return {
        source: 'mock',
        offers: result.data ?? [],
        latency: result.latency,
        error: result.success ? null : 'No activity providers available',
        providerId: 'mock',
      }
    },
  }
}

let cachedService: ActivityService | null = null

export function getActivityService(): ActivityService {
  if (cachedService) return cachedService
  cachedService = createActivityService()
  return cachedService
}

export function resetActivityService(): void {
  cachedService = null
}

export type { ActivityProvider }
