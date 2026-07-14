import type { RentalCarProvider, Vehicle, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../utils/contracts'
import { okResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'

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

function buildVehicles(): Vehicle[] {
  return [
    {
      provider: 'mock',
      providerId: 'mock-rental-001',
      company: 'Toyota Rent a Car',
      vehicleName: 'Toyota Corolla',
      category: 'compact',
      transmission: 'automatic',
      fuelType: 'petrol',
      seats: 5,
      doors: 4,
      airConditioning: true,
      luggageLarge: 2,
      luggageSmall: 2,
      price: 180,
      currency: 'SAR',
      pickupLocation: 'NRT Airport',
      dropoffLocation: 'NRT Airport',
      pickupDate: '2026-10-15',
      dropoffDate: '2026-10-25',
      unlimitedMileage: true,
      insuranceIncluded: true,
      rating: 4.5,
      image: '',
      bookingUrl: '',
    },
    {
      provider: 'mock',
      providerId: 'mock-rental-001',
      company: 'Nissan Rent a Car',
      vehicleName: 'Nissan X-Trail',
      category: 'suv',
      transmission: 'automatic',
      fuelType: 'hybrid',
      seats: 7,
      doors: 5,
      airConditioning: true,
      luggageLarge: 3,
      luggageSmall: 3,
      price: 320,
      currency: 'SAR',
      pickupLocation: 'HND Airport',
      dropoffLocation: 'HND Airport',
      pickupDate: '2026-10-15',
      dropoffDate: '2026-10-25',
      unlimitedMileage: false,
      insuranceIncluded: false,
      rating: 4.3,
      image: '',
      bookingUrl: '',
    },
    {
      provider: 'mock',
      providerId: 'mock-rental-001',
      company: 'Hertz',
      vehicleName: 'Mercedes C-Class',
      category: 'luxury',
      transmission: 'automatic',
      fuelType: 'diesel',
      seats: 5,
      doors: 4,
      airConditioning: true,
      luggageLarge: 2,
      luggageSmall: 2,
      price: 550,
      currency: 'SAR',
      pickupLocation: 'Tokyo Station',
      dropoffLocation: 'NRT Airport',
      pickupDate: '2026-10-15',
      dropoffDate: '2026-10-25',
      unlimitedMileage: true,
      insuranceIncluded: true,
      rating: 4.8,
      image: '',
      bookingUrl: '',
    },
  ]
}

export class MockRentalCarAdapter implements RentalCarProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchRentalCars(_req: ProviderRequest): Promise<ProviderResult<Vehicle[]>> {
    const start = Date.now()
    const data = buildVehicles()
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
