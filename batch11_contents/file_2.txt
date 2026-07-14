import type { ActivityProvider, ActivityOffer, ProviderRequest, ProviderResult, ProviderCapabilities } from '../index'
import { okResult } from '../result'
import { defaultCapabilities } from '../capabilities'
import type { ProviderMetadata } from '../metadata'

const METADATA: ProviderMetadata = {
  id: 'mock-activity-001',
  name: 'Mock Activity Provider',
  priority: 2,
  enabled: true,
  type: 'activity',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsCancellation: true,
  supportsBooking: true,
}

function buildOffers(): ActivityOffer[] {
  return [
    {
      id: 'DISNEYLAND-TOKYO',
      providerId: 'mock-activity-001',
      title: 'Tokyo Disneyland Family Package',
      currency: 'SAR',
      price: 600,
      originalPrice: 750,
      rating: 4.9,
      location: 'Maihama, Tokyo',
      durationMinutes: 480,
      activityType: 'entertainment',
      familyFriendly: true,
      cancellationPolicy: 'free cancellation 72h',
      destination: 'Tokyo',
    },
    {
      id: 'MT-FUJI-TOUR',
      providerId: 'mock-activity-001',
      title: 'Mount Fuji Day Tour',
      currency: 'SAR',
      price: 450,
      originalPrice: null,
      rating: 4.7,
      location: 'Mount Fuji Area',
      durationMinutes: 600,
      activityType: 'nature',
      familyFriendly: true,
      cancellationPolicy: 'free cancellation 48h',
      destination: 'Tokyo',
    },
    {
      id: 'TOKYO-CITY-TOUR',
      providerId: 'mock-activity-001',
      title: 'Tokyo Cultural City Tour',
      currency: 'SAR',
      price: 300,
      originalPrice: null,
      rating: 4.6,
      location: 'Various, Tokyo',
      durationMinutes: 360,
      activityType: 'culture',
      familyFriendly: true,
      cancellationPolicy: 'free cancellation 24h',
      destination: 'Tokyo',
    },
  ]
}

export class MockActivityProvider implements ActivityProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchActivities(_req: ProviderRequest): Promise<ProviderResult<ActivityOffer[]>> {
    const start = Date.now()
    const data = buildOffers()
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
