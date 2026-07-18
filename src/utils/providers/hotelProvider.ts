import type { SearchProvider, ProviderAdapter } from '../searchOrchestrator'
import { buildDestinationAwareHotelSearchResults } from '../mocks/destinationAwareMocks'

export const hotelProvider: SearchProvider = {
  id: 'mock-hotel-001',
  name: 'Mock Hotel Provider',
  type: 'hotel',
  priority: 1,
  enabled: true,
}

export const hotelAdapter: ProviderAdapter = (_provider, req) =>
  buildDestinationAwareHotelSearchResults(req, 'Mock Hotel Provider')
