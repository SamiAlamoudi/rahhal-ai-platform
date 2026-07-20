import type { DestinationProvider, ProviderRequest } from '../providers'
import type { DestinationInsight } from '../models'
import type { ProviderResult } from '../result'
import type { ProviderCapabilities } from '../capabilities'
import { okResult } from '../result'
import { defaultCapabilities } from '../capabilities'
import type { ProviderMetadata } from '../metadata'
import { buildDestinationAwareInsight } from '../../mocks/destinationAwareMocks'

const METADATA: ProviderMetadata = {
  id: 'mock-destination-001',
  name: 'Mock Destination Provider',
  priority: 5,
  enabled: true,
  type: 'destination',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
}

export class MockDestinationProvider implements DestinationProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async getDestinationInsight(req: ProviderRequest): Promise<ProviderResult<DestinationInsight>> {
    const start = Date.now()
    const data = buildDestinationAwareInsight(req.search, METADATA.id)
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}