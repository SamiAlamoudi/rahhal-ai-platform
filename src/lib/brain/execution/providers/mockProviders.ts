/**
 * Sprint 23 — mocked production-shaped provider responses.
 * No Amadeus / Booking.com / Maps / OpenAI / Azure / ElevenLabs.
 */

import type {
  ActivitiesProvider,
  ActivitiesSearchPayload,
  FlightProvider,
  FlightSearchPayload,
  HotelProvider,
  HotelSearchPayload,
  PackageProvider,
  PackageSearchPayload,
  ProviderSearchContext,
  TransportProvider,
  TransportSearchPayload,
} from '../types'

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

function currencyOf(ctx: ProviderSearchContext): string {
  return ctx.task.metadata.currency ?? ctx.tripPlan.budget.currency ?? 'SAR'
}

export function createMockFlightProvider(): FlightProvider {
  return {
    id: 'mock_flights',
    async search(ctx): Promise<FlightSearchPayload> {
      await delay(15, ctx.signal)
      const from = ctx.task.metadata.departureCity ?? 'RUH'
      const to = ctx.task.metadata.destination ?? 'DXB'
      const airline = ctx.task.metadata.preferredAirlines[0] ?? 'Mock Air'
      const cabin = ctx.task.metadata.cabinClass ?? 'economy'
      const cur = currencyOf(ctx)
      return {
        kind: 'flights',
        mock: true,
        offers: [
          {
            id: `flt_${from}_${to}_1`,
            from,
            to,
            airline,
            cabin,
            price: 1200,
            currency: cur,
            stops: 0,
          },
          {
            id: `flt_${from}_${to}_2`,
            from,
            to,
            airline: 'Partner Air',
            cabin,
            price: 980,
            currency: cur,
            stops: 1,
          },
        ],
      }
    },
  }
}

export function createMockHotelProvider(): HotelProvider {
  return {
    id: 'mock_hotels',
    async search(ctx): Promise<HotelSearchPayload> {
      await delay(15, ctx.signal)
      const dest = ctx.task.metadata.destination ?? 'City'
      const pref = ctx.task.metadata.preferredHotels[0] ?? 'central'
      const cur = currencyOf(ctx)
      return {
        kind: 'hotels',
        mock: true,
        offers: [
          {
            id: `htl_${dest}_1`,
            name: `${dest} ${pref} Hotel`,
            area: 'Downtown',
            stars: 4,
            nightly: 450,
            currency: cur,
          },
          {
            id: `htl_${dest}_2`,
            name: `${dest} Boutique Stay`,
            area: 'Old Town',
            stars: 3,
            nightly: 320,
            currency: cur,
          },
        ],
      }
    },
  }
}

export function createMockTransportProvider(): TransportProvider {
  return {
    id: 'mock_transport',
    async search(ctx): Promise<TransportSearchPayload> {
      await delay(12, ctx.signal)
      const dest = ctx.task.metadata.destination ?? 'City'
      const cur = currencyOf(ctx)
      return {
        kind: 'transport',
        mock: true,
        offers: [
          {
            id: `trn_${dest}_airport`,
            mode: 'transfer',
            from: 'Airport',
            to: dest,
            price: 80,
            currency: cur,
          },
          {
            id: `trn_${dest}_rail`,
            mode: 'rail',
            from: dest,
            to: `${dest} Center`,
            price: 40,
            currency: cur,
          },
        ],
      }
    },
  }
}

export function createMockActivitiesProvider(): ActivitiesProvider {
  return {
    id: 'mock_activities',
    async search(ctx): Promise<ActivitiesSearchPayload> {
      await delay(12, ctx.signal)
      const dest = ctx.task.metadata.destination ?? 'City'
      const interests = ctx.task.metadata.activities.length
        ? ctx.task.metadata.activities
        : ['sightseeing']
      const cur = currencyOf(ctx)
      return {
        kind: 'activities',
        mock: true,
        offers: interests.slice(0, 3).map((category, i) => ({
          id: `act_${dest}_${i + 1}`,
          title: `${dest} ${category} experience`,
          category,
          price: 150 + i * 40,
          currency: cur,
        })),
      }
    },
  }
}

export function createMockPackageProvider(): PackageProvider {
  return {
    id: 'mock_packages',
    async search(ctx): Promise<PackageSearchPayload> {
      await delay(18, ctx.signal)
      const dest = ctx.task.metadata.destination ?? 'City'
      const cur = currencyOf(ctx)
      return {
        kind: 'packages',
        mock: true,
        offers: [
          {
            id: `pkg_${dest}_1`,
            title: `${dest} Flight + Hotel package`,
            includes: ['flight', 'hotel', 'transfer'],
            price: 3200,
            currency: cur,
          },
        ],
      }
    },
  }
}
