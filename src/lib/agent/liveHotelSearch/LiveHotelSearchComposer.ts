/**
 * Sprint 109 — compose LiveHotelSearchCriteria → Provider Gateway hotel request.
 */

import type { GatewayRequest } from '../../../core/providerGateway'
import type { AmadeusHotelProviderOptions } from '../../../core/amadeusSandbox'
import type { LiveHotelSearchCriteria } from './types'

export interface LiveHotelSearchComposeResult {
  gatewayRequest: GatewayRequest
  amadeusOptions: AmadeusHotelProviderOptions
}

export function composeLiveHotelSearchRequest(
  criteria: LiveHotelSearchCriteria,
): LiveHotelSearchComposeResult {
  return {
    gatewayRequest: {
      operation: 'search_hotels',
      providerId: 'amadeus',
      hotel: {
        destination: criteria.destination,
        checkIn: criteria.checkInDate,
        checkOut: criteria.checkOutDate,
        adults: criteria.adults ?? 1,
        children: criteria.children ?? 0,
        rooms: criteria.rooms ?? 1,
        currency: criteria.currency ?? 'SAR',
        maxResults: criteria.maxResults ?? 20,
      },
      timeoutMs: criteria.timeoutMs,
      signal: criteria.signal,
    },
    amadeusOptions: {},
  }
}

export class LiveHotelSearchComposer {
  compose(criteria: LiveHotelSearchCriteria): LiveHotelSearchComposeResult {
    return composeLiveHotelSearchRequest(criteria)
  }
}

export function createLiveHotelSearchComposer(): LiveHotelSearchComposer {
  return new LiveHotelSearchComposer()
}
