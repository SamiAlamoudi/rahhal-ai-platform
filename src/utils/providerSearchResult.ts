/**
 * Leaf search result types — no orchestrator/mocks imports.
 * Breaks searchOrchestrator ↔ destinationAwareMocks ↔ toSearchResult cycles.
 */

export type SearchProviderType = 'flight' | 'hotel' | 'activity' | 'transportation'

export interface SearchProvider {
  id: string
  name: string
  type: SearchProviderType
  priority: number
  enabled: boolean
}

// ── Provider search result (raw output from a provider adapter) ────────────

export interface ProviderSearchResult {
  providerId: string
  providerName: string
  providerType: SearchProviderType
  externalId: string
  title: string
  description: string
  currency: string
  price: number
  originalPrice: number | null
  durationMinutes: number | null
  stops: number | null
  rating: number | null
  location: string | null
  cancellationPolicy: string | null
  baggageIncluded: boolean | null
  familyFriendly: boolean | null
  rawMetadata: Record<string, unknown>
  retrievedAt: string
}
