/**
 * Sprint 26 — Amadeus FlightProvider wrapping Phase W aggregation adapter.
 * Live HTTP only when configured + Phase W live flag; tests inject deps.search.
 */

import { createAmadeusProviderAdapter } from '../../../../agent/aggregation/providers/amadeus/amadeusProviderAdapter'
import type {
  AggregationQuery,
  NormalizedOffer,
  ProviderFetchResult,
} from '../../../../agent/aggregation/types'
import type { FlightProvider, FlightSearchPayload, ProviderSearchContext } from '../../types'
import { contextToAggregationQuery } from './contextMapping'

export type CreateAmadeusFlightExecutionProviderOptions = {
  /** Injectable search — no live network when provided. */
  search?: (query: AggregationQuery) => Promise<ProviderFetchResult>
  id?: string
}

function toFlightPayload(result: ProviderFetchResult): FlightSearchPayload {
  if (result.status !== 'ok') {
    throw new Error(result.error || `Amadeus flight search failed (${result.status})`)
  }
  return {
    kind: 'flights',
    mock: false,
    offers: result.items.map((item: NormalizedOffer, index: number) => {
      const p = item.payload
      return {
        id: String(p.id ?? item.fingerprint ?? `amadeus_${index}`),
        from: String(p.from ?? 'XXX'),
        to: String(p.to ?? 'XXX'),
        airline: String(p.airline ?? 'Airline'),
        cabin: String(p.cabin ?? 'economy'),
        price: Number(item.price ?? p.price ?? 0),
        currency: String(item.currency ?? p.currency ?? 'SAR'),
        stops: Number(p.stops ?? 0),
      }
    }),
  }
}

export function createAmadeusFlightExecutionProvider(
  options: CreateAmadeusFlightExecutionProviderOptions = {},
): FlightProvider {
  // Injectable path bypasses Phase W isAvailable/not_configured gate.
  if (options.search) {
    const searchFn = options.search
    return {
      id: options.id ?? 'amadeus_flights',
      async search(ctx: ProviderSearchContext): Promise<FlightSearchPayload> {
        const query = contextToAggregationQuery('flights', ctx)
        return toFlightPayload(await searchFn(query))
      },
    }
  }

  const adapter = createAmadeusProviderAdapter()

  return {
    id: options.id ?? 'amadeus_flights',
    async search(ctx: ProviderSearchContext): Promise<FlightSearchPayload> {
      const query = contextToAggregationQuery('flights', ctx)
      return toFlightPayload(await adapter.fetch(query))
    },
  }
}
