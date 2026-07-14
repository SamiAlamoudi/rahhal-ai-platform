import type { SearchProvider, ProviderAdapter, ProviderSearchResult } from '../searchOrchestrator'

export const activityProvider: SearchProvider = {
  id: 'mock-activity-001',
  name: 'Mock Activity Provider',
  type: 'activity',
  priority: 2,
  enabled: true,
}

export const activityAdapter: ProviderAdapter = (_provider, _req) => {
  const now = new Date().toISOString()
  return [
    {
      providerId: 'mock-activity-001',
      providerName: 'Mock Activity Provider',
      providerType: 'activity',
      externalId: 'DISNEYLAND-TOKYO',
      title: 'Tokyo Disneyland Family Package',
      description: 'تذكرة عائلية لدايزني لاند طوكيو ليوم كامل',
      currency: 'SAR',
      price: 600,
      originalPrice: 750,
      durationMinutes: 480,
      stops: null,
      rating: 4.9,
      location: 'Maihama, Tokyo',
      cancellationPolicy: 'free cancellation 72h',
      baggageIncluded: null,
      familyFriendly: true,
      rawMetadata: {
        activityType: 'entertainment',
        destination: 'Tokyo',
      },
      retrievedAt: now,
    },
    {
      providerId: 'mock-activity-001',
      providerName: 'Mock Activity Provider',
      providerType: 'activity',
      externalId: 'MT-FUJI-TOUR',
      title: 'Mount Fuji Day Tour',
      description: 'جولة طبيعية ليوم كامل إلى جبل فوجي',
      currency: 'SAR',
      price: 450,
      originalPrice: null,
      durationMinutes: 600,
      stops: null,
      rating: 4.7,
      location: 'Mount Fuji Area',
      cancellationPolicy: 'free cancellation 48h',
      baggageIncluded: null,
      familyFriendly: true,
      rawMetadata: {
        activityType: 'nature',
        destination: 'Tokyo',
      },
      retrievedAt: now,
    },
    {
      providerId: 'mock-activity-001',
      providerName: 'Mock Activity Provider',
      providerType: 'activity',
      externalId: 'TOKYO-CITY-TOUR',
      title: 'Tokyo Cultural City Tour',
      description: 'جولة ثقافية في معالم طوكيو التاريخية',
      currency: 'SAR',
      price: 300,
      originalPrice: null,
      durationMinutes: 360,
      stops: null,
      rating: 4.6,
      location: 'Various, Tokyo',
      cancellationPolicy: 'free cancellation 24h',
      baggageIncluded: null,
      familyFriendly: true,
      rawMetadata: {
        activityType: 'culture',
        destination: 'Tokyo',
      },
      retrievedAt: now,
    },
  ] satisfies ProviderSearchResult[]
}
