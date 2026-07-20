import type { ActivityProvider, ProviderRequest } from '../providers'
import type { ActivityOffer } from '../models'
import type { ProviderResult } from '../result'
import type { ProviderCapabilities } from '../capabilities'
import { okResult } from '../result'
import { defaultCapabilities } from '../capabilities'
import type { ProviderMetadata } from '../metadata'
import { buildDestinationAwareActivityOffers } from '../../mocks/destinationAwareMocks'

const METADATA: ProviderMetadata = {
  id: 'mock-activity-001',
  name: 'Mock Activity Provider',
  priority: 2,
  enabled: true,
  type: 'activity',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsCancellation: true,
  supportsBooking: true,
}

export class MockActivityProvider implements ActivityProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchActivities(req: ProviderRequest): Promise<ProviderResult<ActivityOffer[]>> {
    const start = Date.now()
    const data = buildDestinationAwareActivityOffers(req.search, METADATA.id)
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
