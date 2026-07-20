import type { TransferProvider, ProviderRequest } from '../../utils/contracts/providers'
import type { TransferOffer } from '../../utils/contracts/models'
import type { ProviderResult } from '../../utils/contracts/result'
import type { ProviderCapabilities } from '../../utils/contracts/capabilities'
import { okResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'
import { buildDestinationAwareTransferOffers } from '../../utils/mocks/destinationAwareMocks'

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

export class MockTransferAdapter implements TransferProvider {
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
