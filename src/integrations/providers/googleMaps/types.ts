/** Canonical maps models — never expose raw Google API shapes outside this package. */

export interface CanonicalLocation {
  /** Display label (usually name or formatted address). */
  label: string
  /** Place / city / venue name when available. */
  name: string
  formattedAddress: string | null
  placeId: string | null
  lat: number | null
  lng: number | null
  countryCode: string | null
  country: string | null
  city: string | null
  types: string[]
  timezoneId: string | null
}

export interface CanonicalRouteLeg {
  from: string
  to: string
  mode: 'driving' | 'walking' | 'transit' | 'bicycling' | string
  distanceKm: number
  durationMinutes: number
  fromLocation: CanonicalLocation | null
  toLocation: CanonicalLocation | null
}

export interface CanonicalPlaceSuggestion {
  placeId: string
  description: string
  types: string[]
}

export interface CanonicalPlaceDetails {
  location: CanonicalLocation
  phone: string | null
  website: string | null
  rating: number | null
}

export type GoogleMapsOperation =
  | 'geocode'
  | 'reverse_geocode'
  | 'place_search'
  | 'place_details'
  | 'autocomplete'
  | 'distance_matrix'
  | 'timezone'

export interface GoogleMapsClientConfig {
  /** Server-side Google Maps API key. Never a VITE_* value. */
  apiKey: string | null
  /** SPA proxy URL that holds the key server-side. */
  proxyUrl: string | null
  /** Key used to invoke the proxy (e.g. Supabase anon). */
  invokeApiKey: string | null
  timeoutMs: number
  maxRetries: number
  fetchImpl?: typeof fetch
}
