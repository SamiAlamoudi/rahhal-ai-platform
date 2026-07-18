import type { TransferProvider, TransferOffer, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../utils/contracts'
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
