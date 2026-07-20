import type { HotelProvider, ProviderRequest } from '../providers'
import type { HotelOffer } from '../models'
import type { ProviderResult } from '../result'
import type { ProviderCapabilities } from '../capabilities'
import { okResult } from '../result'
import { defaultCapabilities } from '../capabilities'
import type { ProviderMetadata } from '../metadata'
import { buildDestinationAwareHotelOffers } from '../../mocks/destinationAwareMocks'

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

export class MockHotelProvider implements HotelProvider {
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
