import type { SearchProvider, ProviderAdapter } from '../searchOrchestrator'
import { buildDestinationAwareFlightSearchResults } from '../mocks/destinationAwareMocks'

export const flightProvider: SearchProvider = {
  id: 'mock-flight-001',
  name: 'Mock Flight Provider',
  type: 'flight',
  priority: 1,
  enabled: true,
}

export const flightAdapter: ProviderAdapter = (_provider, req) =>
  buildDestinationAwareFlightSearchResults(req, 'Mock Flight Provider')
