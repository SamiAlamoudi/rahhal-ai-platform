import type { TransferProvider, TransferOffer, ProviderRequest, ProviderResult, ProviderCapabilities } from '../index'
import { okResult } from '../result'
import { defaultCapabilities } from '../capabilities'
import type { ProviderMetadata } from '../metadata'

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

function buildOffers(): TransferOffer[] {
  return [
    {
      id: 'NARITA-EXPRESS',
      providerId: 'mock-transportation-001',
      title: 'Narita Express — المطار إلى وسط طوكيو',
      currency: 'SAR',
      price: 120,
      rating: 4.5,
      location: 'Narita → Tokyo Station',
      durationMinutes: 60,
      transferType: 'train',
      origin: 'NRT',
      destination: 'Tokyo Station',
      familyFriendly: true,
      cancellationPolicy: 'free cancellation 24h',
    },
    {
      id: 'PRIVATE-TRANSFER-TOKYO',
      providerId: 'mock-transportation-001',
      title: 'نقل خاص — المطار إلى الفندق',
      currency: 'SAR',
      price: 280,
      rating: 4.7,
      location: 'Narita → Hotel',
      durationMinutes: 90,
      transferType: 'private-transfer',
      origin: 'NRT',
      destination: 'Hotel',
      familyFriendly: true,
      cancellationPolicy: 'free cancellation 12h',
    },
  ]
}

export class MockTransferProvider implements TransferProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchTransfers(_req: ProviderRequest): Promise<ProviderResult<TransferOffer[]>> {
    const start = Date.now()
    const data = buildOffers()
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
