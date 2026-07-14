import type { ProviderResult } from '../result'
import type { ProviderContract, ProviderRequest } from './base'
import type { FlightOffer } from '../models/flight'

export interface FlightProvider extends ProviderContract {
  searchFlights(req: ProviderRequest): Promise<ProviderResult<FlightOffer[]>>
}
