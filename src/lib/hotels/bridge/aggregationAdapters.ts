/**
 * Sprint 30 — Aggregation ProviderAdapter wrappers for hotel foundation providers.
 */

import { createProviderAdapter } from '../../agent/aggregation/baseAdapter'
import type {
  AggregationQuery,
  ProviderAdapter,
  ProviderFetchResult,
} from '../../agent/aggregation/types'
import type { HotelProvider } from '../HotelProvider'
import { createBookingConnectivityAdapter } from '../adapters/bookingConnectivityAdapter'
import { createExpediaRapidAdapter } from '../adapters/expediaRapidAdapter'
import { createHotelbedsAdapter } from '../adapters/hotelbedsAdapter'
import { createMockHotelsAdapter } from '../adapters/mockHotelAdapter'
import { toAggregationHotelOffers } from './toAggregationOffer'
import { defaultStayDates } from '../sandbox'
import type { HotelSearchRequest } from '../types'

export function createHotelbedsAggregationAdapter(
  provider: HotelProvider = createHotelbedsAdapter(),
): ProviderAdapter {
  return wrapHotelProviderAsAggregationAdapter(provider, {
    id: 'hotelbeds',
    displayName: 'Hotelbeds',
    priority: 90,
    reliability: 0.9,
    futureSlot: false,
  })
}

export function createExpediaRapidAggregationAdapter(
  provider: HotelProvider = createExpediaRapidAdapter(),
): ProviderAdapter {
  return wrapHotelProviderAsAggregationAdapter(provider, {
    id: 'expedia',
    displayName: 'Expedia Rapid',
    priority: 85,
    reliability: 0.88,
    futureSlot: false,
  })
}

export function createBookingConnectivityAggregationAdapter(
  provider: HotelProvider = createBookingConnectivityAdapter(),
): ProviderAdapter {
  return wrapHotelProviderAsAggregationAdapter(provider, {
    id: 'booking_com',
    displayName: 'Booking.com Connectivity',
    priority: 95,
    reliability: 0.92,
    futureSlot: false,
    mocked: true,
  })
}

export function createMockHotelsAggregationAdapter(
  provider: HotelProvider = createMockHotelsAdapter(),
): ProviderAdapter {
  return wrapHotelProviderAsAggregationAdapter(provider, {
    id: 'booking_com_mock',
    displayName: 'Mock Hotels',
    priority: 45,
    reliability: 1,
    futureSlot: false,
    mocked: true,
  })
}

export function createHotelFoundationAggregationAdapters(): ProviderAdapter[] {
  return [
    createBookingConnectivityAggregationAdapter(),
    createHotelbedsAggregationAdapter(),
    createExpediaRapidAggregationAdapter(),
    createMockHotelsAggregationAdapter(),
  ]
}

function wrapHotelProviderAsAggregationAdapter(
  provider: HotelProvider,
  meta: {
    id: string
    displayName: string
    priority: number
    reliability: number
    futureSlot: boolean
    mocked?: boolean
  },
): ProviderAdapter {
  return createProviderAdapter({
    metadata: {
      id: meta.id as ProviderAdapter['metadata']['id'],
      displayName: meta.displayName,
      domains: ['hotels'],
      priority: meta.priority,
      reliability: meta.reliability,
      mocked: meta.mocked ?? true,
      futureSlot: meta.futureSlot,
    },
    isAvailable: () => provider.isAvailable(),
    capabilities: {
      features: [
        'search',
        'stay_normalize',
        'room_availability',
        'pricing',
        'cancellation_policy',
        'taxes_fees',
        'images',
        'amenities',
        'star_rating',
        'guest_reviews',
        'sandbox',
      ],
      supportsSearch: true,
      supportsRealtime: false,
      rateLimitPerMinute: provider.getCapabilities().rateLimitPerMinute,
      mocked: meta.mocked ?? true,
      futureSlot: meta.futureSlot,
    },
    async fetch(query: AggregationQuery): Promise<ProviderFetchResult> {
      const started = Date.now()
      const providerId = String(meta.id)
      try {
        const req = aggregationQueryToHotelSearch(query)
        const result = await provider.searchHotels(req)
        if (!result.success || !result.data?.length) {
          return {
            providerId,
            status: 'error',
            items: [],
            error: result.errors[0]?.message ?? 'Hotel search returned no data',
            errorCode: result.errors[0]?.code === 'rate_limited' ? 'rate_limited' : 'upstream_error',
            durationMs: Date.now() - started,
            retryAfterMs: result.errors[0]?.retryAfterMs,
          }
        }
        return {
          providerId,
          status: 'ok',
          items: toAggregationHotelOffers(result.data, req.checkIn && req.checkOut ? undefined : 3),
          error: null,
          errorCode: null,
          durationMs: Date.now() - started,
        }
      } catch (error) {
        return {
          providerId,
          status: 'error',
          items: [],
          error: error instanceof Error ? error.message : 'Hotel foundation adapter failed',
          errorCode: 'upstream_error',
          durationMs: Date.now() - started,
        }
      }
    },
  })
}

function aggregationQueryToHotelSearch(query: AggregationQuery): HotelSearchRequest {
  const nights = Math.max(1, Number(query.input.nights ?? 3))
  const startDate = String(query.input.startDate ?? '')
  const { checkIn, checkOut } = startDate
    ? {
      checkIn: startDate,
      checkOut: addDays(startDate, nights),
    }
    : defaultStayDates()

  const preferred = query.input.preferredHotels
  const preferredList = Array.isArray(preferred)
    ? preferred.map(String)
    : preferred
      ? [String(preferred)]
      : []

  return {
    destination: String(query.input.destination ?? 'City'),
    checkIn,
    checkOut,
    adults: Math.max(1, Number(query.input.travelers ?? query.input.adults ?? 2)),
    children: Number(query.input.children ?? 0) || undefined,
    currency: String(query.input.currency ?? 'SAR'),
    locale: query.locale,
    preferredHotels: preferredList,
    maxResults: 8,
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  if (!Number.isFinite(d.getTime())) return defaultStayDates().checkOut
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
