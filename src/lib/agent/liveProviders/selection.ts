/**
 * Provider Selection — Sprint 56
 *
 * Agent chooses providers based on availability, speed, quota,
 * price coverage, and quality score.
 */

import type { ProviderHealthMonitor } from './health'
import type { LiveProviderId, LiveProviderSdk, LiveSearchDomain } from './types'

export type ProviderSelectionCriteria = {
  domain: LiveSearchDomain
  preferSpeed?: boolean
  preferQuality?: boolean
  preferCoverage?: boolean
}

export type ProviderSelectionScore = {
  providerId: LiveProviderId
  score: number
  available: boolean
  factors: {
    availability: number
    speed: number
    quota: number
    priceCoverage: number
    quality: number
  }
}

function domainCapability(
  sdk: LiveProviderSdk,
  domain: LiveSearchDomain,
): boolean {
  switch (domain) {
    case 'flights':
      return sdk.capabilities.flights && typeof sdk.searchFlights === 'function'
    case 'hotels':
      return sdk.capabilities.hotels && typeof sdk.searchHotels === 'function'
    case 'activities':
      return sdk.capabilities.activities && typeof sdk.searchActivities === 'function'
    case 'cars':
      return sdk.capabilities.cars && typeof sdk.searchCars === 'function'
    case 'transfers':
      return sdk.capabilities.transfers && typeof sdk.searchTransfers === 'function'
    case 'insurance':
      return sdk.capabilities.insurance && typeof sdk.searchInsurance === 'function'
    case 'airports':
      return sdk.capabilities.airports && typeof sdk.searchAirports === 'function'
    default:
      return false
  }
}

/** Rough price-coverage proxy from capability breadth + provider identity. */
function priceCoverageScore(sdk: LiveProviderSdk, domain: LiveSearchDomain): number {
  if (!domainCapability(sdk, domain)) return 0
  if (sdk.providerId === 'duffel' && domain === 'flights') return 0.92
  if (sdk.providerId === 'amadeus' && domain === 'flights') return 0.88
  if (sdk.providerId === 'booking' && domain === 'hotels') return 0.95
  return 0.7
}

export function scoreLiveProvider(input: {
  sdk: LiveProviderSdk
  health: ProviderHealthMonitor
  criteria: ProviderSelectionCriteria
}): ProviderSelectionScore {
  const { sdk, health, criteria } = input
  const snap = health.snapshot(sdk.providerId)
  const available =
    sdk.isAvailable() && health.isAvailable(sdk.providerId) && domainCapability(sdk, criteria.domain)

  const availability = available ? 1 : 0
  // Lower latency → higher speed score
  const speed =
    snap.latencyMsAvg <= 0
      ? 0.75
      : Math.max(0, Math.min(1, 1 - snap.latencyMsAvg / 10_000))
  const quota =
    snap.quotaRemaining == null
      ? 0.8
      : Math.max(0, Math.min(1, snap.quotaRemaining / Math.max(1, snap.quotaRemaining + 10)))
  const priceCoverage = priceCoverageScore(sdk, criteria.domain)
  const quality = Math.max(0, Math.min(1, snap.qualityScore))

  let score =
    availability * 0.35 +
    speed * 0.15 +
    quota * 0.15 +
    priceCoverage * 0.2 +
    quality * 0.15

  if (criteria.preferSpeed) score = score * 0.7 + speed * 0.3
  if (criteria.preferQuality) score = score * 0.7 + quality * 0.3
  if (criteria.preferCoverage) score = score * 0.7 + priceCoverage * 0.3
  if (!available) score = 0

  return {
    providerId: sdk.providerId,
    score,
    available,
    factors: { availability, speed, quota, priceCoverage, quality },
  }
}

export function selectLiveProviders(input: {
  providers: LiveProviderSdk[]
  health: ProviderHealthMonitor
  criteria: ProviderSelectionCriteria
  limit?: number
}): { selected: LiveProviderSdk[]; scores: ProviderSelectionScore[] } {
  const scores = input.providers
    .map((sdk) =>
      scoreLiveProvider({ sdk, health: input.health, criteria: input.criteria }),
    )
    .sort((a, b) => b.score - a.score)

  const limit = input.limit ?? scores.length
  const selectedIds = new Set(
    scores.filter((s) => s.available).slice(0, limit).map((s) => s.providerId),
  )
  const selected = input.providers.filter((p) => selectedIds.has(p.providerId))
  // Preserve score order
  selected.sort((a, b) => {
    const sa = scores.find((s) => s.providerId === a.providerId)?.score ?? 0
    const sb = scores.find((s) => s.providerId === b.providerId)?.score ?? 0
    return sb - sa
  })
  return { selected, scores }
}

/**
 * Failover: try providers in selection order until one returns results or all fail.
 */
export async function withProviderFailover<T>(input: {
  providers: LiveProviderSdk[]
  run: (sdk: LiveProviderSdk) => Promise<T>
  isEmpty?: (result: T) => boolean
}): Promise<{ result: T | null; usedProviderId: LiveProviderId | null; attempted: LiveProviderId[] }> {
  const attempted: LiveProviderId[] = []
  for (const sdk of input.providers) {
    if (!sdk.isAvailable()) continue
    attempted.push(sdk.providerId)
    try {
      const result = await input.run(sdk)
      if (input.isEmpty?.(result)) continue
      return { result, usedProviderId: sdk.providerId, attempted }
    } catch {
      continue
    }
  }
  return { result: null, usedProviderId: null, attempted }
}
