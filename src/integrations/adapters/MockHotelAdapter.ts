import type { HotelProvider, HotelOffer, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../utils/contracts'
import { okResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'
import { buildDestinationAwareHotelOffers } from '../../utils/mocks/destinationAwareMocks'

const METADATA: ProviderMetadata = {
  id: 'mock-hotel-001',
  name: 'Mock Hotel Provider',
  priority: 1,
  enabled: true,
  type: 'hotel',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsCancellation: true,
  supportsBooking: true,
}

export class MockHotelAdapter implements HotelProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchHotels(req: ProviderRequest): Promise<ProviderResult<HotelOffer[]>> {
    const start = Date.now()
    const data = buildDestinationAwareHotelOffers(req.search, METADATA.id)
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
