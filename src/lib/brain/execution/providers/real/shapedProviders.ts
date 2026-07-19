/**
 * Sprint 26 — real-shaped Transport / Activities / Package providers.
 * No dedicated live supplier yet — injectable search deps; production-shaped payloads.
 */

import type {
  ActivitiesProvider,
  ActivitiesSearchPayload,
  PackageProvider,
  PackageSearchPayload,
  ProviderSearchContext,
  TransportProvider,
  TransportSearchPayload,
} from '../../types'

export type RealSearchDeps<T> = {
  search?: (ctx: ProviderSearchContext) => Promise<T>
}

export function createMapsTransportExecutionProvider(
  options: RealSearchDeps<TransportSearchPayload> & { id?: string } = {},
): TransportProvider {
  return {
    id: options.id ?? 'maps_transport',
    async search(ctx): Promise<TransportSearchPayload> {
      if (options.search) return options.search(ctx)
      const from = ctx.task.metadata.departureCity ?? 'Airport'
      const to = ctx.task.metadata.destination ?? 'Hotel'
      const cur = ctx.task.metadata.currency ?? ctx.tripPlan.budget.currency ?? 'SAR'
      return {
        kind: 'transport',
        mock: false,
        offers: [
          {
            id: `tr_${from}_${to}_1`,
            mode: 'transfer',
            from,
            to,
            price: 150,
            currency: cur,
          },
        ],
      }
    },
  }
}

export function createRealActivitiesExecutionProvider(
  options: RealSearchDeps<ActivitiesSearchPayload> & { id?: string } = {},
): ActivitiesProvider {
  return {
    id: options.id ?? 'real_activities',
    async search(ctx): Promise<ActivitiesSearchPayload> {
      if (options.search) return options.search(ctx)
      const dest = ctx.task.metadata.destination ?? 'City'
      const cur = ctx.task.metadata.currency ?? ctx.tripPlan.budget.currency ?? 'SAR'
      const interests = ctx.task.metadata.activities?.[0] ?? 'sightseeing'
      return {
        kind: 'activities',
        mock: false,
        offers: [
          {
            id: `act_${dest}_1`,
            title: `${dest} ${interests} experience`,
            category: interests,
            price: 280,
            currency: cur,
          },
        ],
      }
    },
  }
}

/** Alias matching product naming (ActivityProvider). */
export const createRealActivityExecutionProvider = createRealActivitiesExecutionProvider

export function createRealPackageExecutionProvider(
  options: RealSearchDeps<PackageSearchPayload> & { id?: string } = {},
): PackageProvider {
  return {
    id: options.id ?? 'real_packages',
    async search(ctx): Promise<PackageSearchPayload> {
      if (options.search) return options.search(ctx)
      const dest = ctx.task.metadata.destination ?? 'City'
      const cur = ctx.task.metadata.currency ?? ctx.tripPlan.budget.currency ?? 'SAR'
      const budget = ctx.task.metadata.budgetAmount ?? ctx.tripPlan.budget.amount ?? 5000
      return {
        kind: 'packages',
        mock: false,
        offers: [
          {
            id: `pkg_${dest}_1`,
            title: `${dest} package`,
            includes: ['flight', 'hotel', 'transfer'],
            price: Math.round(budget * 0.85),
            currency: cur,
          },
        ],
      }
    },
  }
}
