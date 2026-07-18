import type { SearchProvider, ProviderAdapter } from '../searchOrchestrator'
import { buildDestinationAwareTransferSearchResults } from '../mocks/destinationAwareMocks'

export const transportationProvider: SearchProvider = {
  id: 'mock-transportation-001',
  name: 'Mock Transportation Provider',
  type: 'transportation',
  priority: 3,
  enabled: true,
}

export const transportationAdapter: ProviderAdapter = (_provider, req) =>
  buildDestinationAwareTransferSearchResults(req, 'Mock Transportation Provider')
