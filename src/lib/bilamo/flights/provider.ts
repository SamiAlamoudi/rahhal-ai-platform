/**
 * Provider-neutral flight search interface.
 */

import type {
  BilamoFlightSearchRequest,
  FlightOfferDetails,
  FlightProviderHealth,
  FlightSearchProviderResult,
} from './types'

export interface FlightSearchProvider {
  readonly providerId: string
  searchFlights(request: BilamoFlightSearchRequest): Promise<FlightSearchProviderResult>
  getOfferDetails(offerId: string): Promise<FlightOfferDetails | null>
  healthCheck(): Promise<FlightProviderHealth>
}
