import type { HotelProvider, HotelOffer, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../utils/contracts'
import { okResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'

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

function buildOffers(): HotelOffer[] {
  return [
    {
      id: 'HILTON-TOKYO-SHINJUKU',
      providerId: 'mock-hotel-001',
      title: 'Hilton Tokyo Odaiba',
      currency: 'SAR',
      price: 850,
      originalPrice: 1100,
      rating: 4.8,
      hotelStars: 5,
      location: 'Odaiba, Tokyo',
      area: 'Odaiba',
      checkIn: '2026-10-15',
      checkOut: '2026-10-25',
      familyFriendly: true,
      breakfastIncluded: true,
      freeCancellation: true,
      amenities: ['family-rooms', 'crib', 'pool', 'spa', 'gym', 'wifi'],
      roomTypes: [{ name: 'King Bay View', capacity: 4, bedType: 'king', count: 1 }],
    },
    {
      id: 'COURTYARD-SHINJUKU',
      providerId: 'mock-hotel-001',
      title: 'Courtyard by Marriott Shinjuku',
      currency: 'SAR',
      price: 600,
      originalPrice: null,
      rating: 4.5,
      hotelStars: 4,
      location: 'Shinjuku, Tokyo',
      area: 'Shinjuku',
      checkIn: '2026-10-15',
      checkOut: '2026-10-25',
      familyFriendly: true,
      breakfastIncluded: false,
      freeCancellation: true,
      amenities: ['family-rooms', 'wifi', 'restaurant'],
      roomTypes: [{ name: 'Double Room', capacity: 3, bedType: 'double', count: 1 }],
    },
    {
      id: 'TOYOKO-INN-ASAKUSA',
      providerId: 'mock-hotel-001',
      title: 'Toyoko Inn Asakusa',
      currency: 'SAR',
      price: 350,
      originalPrice: null,
      rating: 4.0,
      hotelStars: 3,
      location: 'Asakusa, Tokyo',
      area: 'Asakusa',
      checkIn: '2026-10-15',
      checkOut: '2026-10-25',
      familyFriendly: false,
      breakfastIncluded: true,
      freeCancellation: false,
      amenities: ['wifi'],
      roomTypes: [{ name: 'Single Room', capacity: 1, bedType: 'single', count: 1 }],
    },
  ]
}

export class MockHotelAdapter implements HotelProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchHotels(_req: ProviderRequest): Promise<ProviderResult<HotelOffer[]>> {
    const start = Date.now()
    const data = buildOffers()
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
