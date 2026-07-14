import type { SearchProvider, ProviderAdapter, ProviderSearchResult } from '../searchOrchestrator'

export const transportationProvider: SearchProvider = {
  id: 'mock-transportation-001',
  name: 'Mock Transportation Provider',
  type: 'transportation',
  priority: 3,
  enabled: true,
}

export const transportationAdapter: ProviderAdapter = (_provider, _req) => {
  const now = new Date().toISOString()
  return [
    {
      providerId: 'mock-transportation-001',
      providerName: 'Mock Transportation Provider',
      providerType: 'transportation',
      externalId: 'NARITA-EXPRESS',
      title: 'Narita Express — المطار إلى وسط طوكيو',
      description: 'قطار سريع من مطار ناريتا إلى محطة طوكيو',
      currency: 'SAR',
      price: 120,
      originalPrice: null,
      durationMinutes: 60,
      stops: 0,
      rating: 4.5,
      location: 'Narita → Tokyo Station',
      cancellationPolicy: 'free cancellation 24h',
      baggageIncluded: null,
      familyFriendly: true,
      rawMetadata: {
        transportType: 'train',
        origin: 'NRT',
        destination: 'Tokyo Station',
      },
      retrievedAt: now,
    },
    {
      providerId: 'mock-transportation-001',
      providerName: 'Mock Transportation Provider',
      providerType: 'transportation',
      externalId: 'PRIVATE-TRANSFER-TOKYO',
      title: 'نقل خاص — المطار إلى الفندق',
      description: 'سيارة خاصة مع سائق من المطار إلى فندقك في طوكيو',
      currency: 'SAR',
      price: 280,
      originalPrice: 350,
      durationMinutes: 90,
      stops: 0,
      rating: 4.7,
      location: 'Narita → Hotel',
      cancellationPolicy: 'free cancellation 12h',
      baggageIncluded: null,
      familyFriendly: true,
      rawMetadata: {
        transportType: 'private-transfer',
        origin: 'NRT',
        destination: 'Hotel',
      },
      retrievedAt: now,
    },
  ] satisfies ProviderSearchResult[]
}
