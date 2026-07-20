import type { FlightProvider, ProviderRequest } from '../providers'
import type { FlightOffer } from '../models'
import type { ProviderResult } from '../result'
import type { ProviderCapabilities } from '../capabilities'
import { okResult } from '../result'
import { defaultCapabilities } from '../capabilities'
import type { ProviderMetadata } from '../metadata'
import { buildDestinationAwareFlightOffers } from '../../mocks/destinationAwareMocks'

const METADATA: ProviderMetadata = {
  id: 'mock-flight-001',
  name: 'Mock Flight Provider',
  priority: 1,
  enabled: true,
  type: 'flight',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsCancellation: true,
  supportsPriceTracking: true,
}

export class MockFlightProvider implements FlightProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchFlights(req: ProviderRequest): Promise<ProviderResult<FlightOffer[]>> {
    const start = Date.now()
    const data = buildDestinationAwareFlightOffers(req.search, METADATA.id)
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
