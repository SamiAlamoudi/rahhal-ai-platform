import type { TransferProvider, ProviderRequest } from '../providers'
import type { TransferOffer } from '../models'
import type { ProviderResult } from '../result'
import type { ProviderCapabilities } from '../capabilities'
import { okResult } from '../result'
import { defaultCapabilities } from '../capabilities'
import type { ProviderMetadata } from '../metadata'
import { buildDestinationAwareTransferOffers } from '../../mocks/destinationAwareMocks'

const METADATA: ProviderMetadata = {
  id: 'mock-transportation-001',
  name: 'Mock Transportation Provider',
  priority: 3,
  enabled: true,
  type: 'transfer',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsCancellation: true,
}

export class MockTransferProvider implements TransferProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchTransfers(req: ProviderRequest): Promise<ProviderResult<TransferOffer[]>> {
    const start = Date.now()
    const data = buildDestinationAwareTransferOffers(req.search, METADATA.id)
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
