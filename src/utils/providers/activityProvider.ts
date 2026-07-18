import type { SearchProvider, ProviderAdapter } from '../searchOrchestrator'
import { buildDestinationAwareActivitySearchResults } from '../mocks/destinationAwareMocks'

export const activityProvider: SearchProvider = {
  id: 'mock-activity-001',
  name: 'Mock Activity Provider',
  type: 'activity',
  priority: 2,
  enabled: true,
}

export const activityAdapter: ProviderAdapter = (_provider, req) =>
  buildDestinationAwareActivitySearchResults(req, 'Mock Activity Provider')
