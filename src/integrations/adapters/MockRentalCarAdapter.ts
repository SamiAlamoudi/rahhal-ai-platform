import type { RentalCarProvider, Vehicle, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../utils/contracts'
import { okResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'
import { buildDestinationAwareVehicles } from '../../utils/mocks/destinationAwareMocks'

const METADATA: ProviderMetadata = {
  id: 'mock-rental-001',
  name: 'Mock Rental Car Provider',
  priority: 3,
  enabled: true,
  type: 'rental-car',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsBooking: true,
  supportsCancellation: true,
}

export class MockRentalCarAdapter implements RentalCarProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchRentalCars(req: ProviderRequest): Promise<ProviderResult<Vehicle[]>> {
    const start = Date.now()
    const data = buildDestinationAwareVehicles(req.search, METADATA.id)
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
