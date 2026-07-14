import type { DestinationProvider, DestinationInsight, PointOfInterest, ProviderRequest, ProviderResult, ProviderCapabilities } from '../index'
import { okResult } from '../result'
import { defaultCapabilities } from '../capabilities'
import type { ProviderMetadata } from '../metadata'

const METADATA: ProviderMetadata = {
  id: 'mock-destination-001',
  name: 'Mock Destination Provider',
  priority: 5,
  enabled: true,
  type: 'destination',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
}

function buildPOIs(): PointOfInterest[] {
  return [
    { name: 'Senso-ji Temple', category: 'temple', lat: 35.7148, lng: 139.7967, rating: 4.7 },
    { name: 'Tokyo Skytree', category: 'landmark', lat: 35.7101, lng: 139.8107, rating: 4.6 },
    { name: 'Shibuya Crossing', category: 'landmark', lat: 35.6595, lng: 139.7005, rating: 4.5 },
    { name: 'Tsukiji Outer Market', category: 'shopping', lat: 35.6654, lng: 139.7707, rating: 4.4 },
    { name: 'Ueno Park', category: 'park', lat: 35.7156, lng: 139.7745, rating: 4.5 },
    { name: 'Tokyo National Museum', category: 'museum', lat: 35.7188, lng: 139.7765, rating: 4.6 },
  ]
}

function buildInsight(destination: string): DestinationInsight {
  return {
    id: 'MOCK-DESTINATION-001',
    providerId: METADATA.id,
    destination,
    country: 'Japan',
    timezone: 'Asia/Tokyo (UTC+9)',
    language: 'Japanese',
    currency: 'JPY',
    safetyLevel: 'low',
    pointsOfInterest: buildPOIs(),
    travelTips: [
      'احمل يناً نقداً لأن العديد من المتاجر لا تقبل البطاقات',
      'قطارات طوكيو هي أفضل وسيلة للتنقل',
      'الماء من الصنبور آمن للشرب',
      'احترم قواعد الهدوء في وسائل النقل العامة',
    ],
  }
}

export class MockDestinationProvider implements DestinationProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async getDestinationInsight(req: ProviderRequest): Promise<ProviderResult<DestinationInsight>> {
    const start = Date.now()
    const data = buildInsight(req.search.destination || 'Unknown')
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
