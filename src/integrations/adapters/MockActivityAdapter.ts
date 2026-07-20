import type { ActivityProvider, ProviderRequest } from '../../utils/contracts/providers'
import type { ActivityOffer } from '../../utils/contracts/models'
import type { ProviderResult } from '../../utils/contracts/result'
import type { ProviderCapabilities } from '../../utils/contracts/capabilities'
import { okResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'
import { buildDestinationAwareActivityOffers } from '../../utils/mocks/destinationAwareMocks'

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

export class MockActivityAdapter implements ActivityProvider {
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
