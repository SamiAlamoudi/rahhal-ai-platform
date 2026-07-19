import type {
  AggregatableDomain,
  KnownProviderId,
  ProviderCapabilities,
  ProviderMetadata,
} from './types'

const DEFAULT_FEATURES: Record<AggregatableDomain, string[]> = {
  flights: ['search', 'offer_normalize'],
  hotels: ['search', 'stay_normalize'],
  weather: ['forecast_summary'],
  maps: ['route_legs'],
  currency: ['convert'],
  visa: ['guidance'],
  attractions: ['catalog_search'],
  transportation: ['intercity_options'],
}

/**
 * Build a capability record from metadata (+ optional overrides).
 */
export function buildProviderCapabilities(
  metadata: ProviderMetadata,
  overrides: Partial<ProviderCapabilities> = {},
): ProviderCapabilities {
  const features = overrides.features
    ?? metadata.domains.flatMap((domain) => DEFAULT_FEATURES[domain] ?? [])
  return {
    providerId: String(metadata.id),
    domains: [...metadata.domains],
    features: [...new Set(features)],
    supportsSearch: overrides.supportsSearch ?? metadata.domains.some((d) => (
      d === 'flights' || d === 'hotels' || d === 'attractions' || d === 'transportation'
    )),
    supportsRealtime: overrides.supportsRealtime ?? false,
    rateLimitPerMinute: overrides.rateLimitPerMinute ?? 60,
    mocked: overrides.mocked ?? metadata.mocked,
    futureSlot: overrides.futureSlot ?? Boolean(metadata.futureSlot),
  }
}

/** Future provider catalog — architecture slots with no live HTTP. */
export const FUTURE_PROVIDER_CATALOG: Array<{
  id: KnownProviderId
  displayName: string
  domains: AggregatableDomain[]
  features: string[]
}> = [
  {
    id: 'skyscanner',
    displayName: 'Skyscanner (future)',
    domains: ['flights'],
    features: ['search', 'meta_search'],
  },
  {
    id: 'hotelbeds',
    displayName: 'Hotelbeds (Sprint 30 sandbox foundation)',
    domains: ['hotels'],
    features: ['search', 'inventory', 'room_availability', 'pricing', 'cancellation_policy', 'sandbox'],
  },
  {
    id: 'mapbox',
    displayName: 'Mapbox (future)',
    domains: ['maps'],
    features: ['directions', 'geocode'],
  },
  {
    id: 'tomorrow_io',
    displayName: 'Tomorrow.io (future)',
    domains: ['weather'],
    features: ['forecast', 'timeline'],
  },
  {
    id: 'sherpa',
    displayName: 'Sherpa (future)',
    domains: ['visa'],
    features: ['requirements', 'documents'],
  },
  {
    id: 'google_places',
    displayName: 'Google Places (future)',
    domains: ['attractions'],
    features: ['places_search', 'details'],
  },
  {
    id: 'viator',
    displayName: 'Viator (future)',
    domains: ['attractions'],
    features: ['experiences', 'booking_intent'],
  },
  {
    id: 'getyourguide',
    displayName: 'GetYourGuide (future)',
    domains: ['attractions'],
    features: ['experiences', 'catalog'],
  },
]
