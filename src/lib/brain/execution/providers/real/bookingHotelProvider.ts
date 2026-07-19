/**
 * Sprint 26 — Booking.com HotelProvider wrapping Phase W aggregation adapter.
 * Live HTTP only when configured + Phase W live flag; tests inject deps.search.
 */

import { createBookingComProviderAdapter } from '../../../../agent/aggregation/providers/booking/bookingComProviderAdapter'
import type {
  AggregationQuery,
  NormalizedOffer,
  ProviderFetchResult,
} from '../../../../agent/aggregation/types'
import type { HotelProvider, HotelSearchPayload, ProviderSearchContext } from '../../types'
import { contextToAggregationQuery } from './contextMapping'

export type CreateBookingHotelExecutionProviderOptions = {
  search?: (query: AggregationQuery) => Promise<ProviderFetchResult>
  id?: string
}

function toHotelPayload(result: ProviderFetchResult): HotelSearchPayload {
  if (result.status !== 'ok') {
    throw new Error(result.error || `Booking.com hotel search failed (${result.status})`)
  }
  return {
    kind: 'hotels',
    mock: false,
    offers: result.items.map((item: NormalizedOffer, index: number) => {
      const p = item.payload
      const starsRaw = p.score ?? p.stars ?? 4
      const stars = Math.max(
        1,
        Math.min(
          5,
          Math.round(Number(starsRaw) > 5 ? Number(starsRaw) / 2 : Number(starsRaw)),
        ),
      )
      return {
        id: String(p.id ?? item.fingerprint ?? `booking_${index}`),
        name: String(p.name ?? item.title ?? 'Hotel'),
        area: String(p.area ?? 'City center'),
        stars,
        nightly: Number(p.nightly ?? item.price ?? 0),
        currency: String(item.currency ?? p.currency ?? 'SAR'),
      }
    }),
  }
}

export function createBookingHotelExecutionProvider(
  options: CreateBookingHotelExecutionProviderOptions = {},
): HotelProvider {
  if (options.search) {
    const searchFn = options.search
    return {
      id: options.id ?? 'booking_hotels',
      async search(ctx: ProviderSearchContext): Promise<HotelSearchPayload> {
        const query = contextToAggregationQuery('hotels', ctx)
        return toHotelPayload(await searchFn(query))
      },
    }
  }

  const adapter = createBookingComProviderAdapter()

  return {
    id: options.id ?? 'booking_hotels',
    async search(ctx: ProviderSearchContext): Promise<HotelSearchPayload> {
      const query = contextToAggregationQuery('hotels', ctx)
      return toHotelPayload(await adapter.fetch(query))
    },
  }
}
