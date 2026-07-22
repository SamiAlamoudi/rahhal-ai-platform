/**
 * Sprint 105 — compose LiveFlightSearchCriteria → Provider Gateway request.
 */

import type { GatewayRequest } from '../../../core/providerGateway'
import type { AmadeusSandboxProviderOptions } from '../../../core/amadeusSandbox'
import type { LiveFlightSearchCriteria } from './types'

export interface LiveFlightSearchComposeResult {
  gatewayRequest: GatewayRequest
  amadeusOptions: AmadeusSandboxProviderOptions
}

export function composeLiveFlightSearchRequest(
  criteria: LiveFlightSearchCriteria,
): LiveFlightSearchComposeResult {
  const gatewayRequest: GatewayRequest = {
    operation: 'search_flights',
    providerId: 'amadeus',
    flight: {
      origin: criteria.origin,
      destination: criteria.destination,
      departureDate: criteria.departureDate,
      returnDate: criteria.returnDate ?? null,
      adults: criteria.adults ?? 1,
      children: criteria.children ?? 0,
      cabin: criteria.cabin ?? null,
      currency: criteria.currency ?? 'SAR',
      maxResults: criteria.maxResults ?? 20,
      nonStop: criteria.nonStop === true,
    },
    timeoutMs: criteria.timeoutMs,
    signal: criteria.signal,
  }

  return {
    gatewayRequest,
    amadeusOptions: {
      children: criteria.children ?? 0,
      cabin: criteria.cabin ?? null,
    },
  }
}

export class LiveFlightSearchComposer {
  compose(criteria: LiveFlightSearchCriteria): LiveFlightSearchComposeResult {
    return composeLiveFlightSearchRequest(criteria)
  }
}

export function createLiveFlightSearchComposer(): LiveFlightSearchComposer {
  return new LiveFlightSearchComposer()
}
