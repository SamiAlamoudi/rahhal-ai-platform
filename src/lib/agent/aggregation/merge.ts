import type { AggregatableDomain, NormalizedOffer } from './types'

/**
 * Merge compatible ranked offers into a final list (top-N unique results).
 * Domain-aware caps keep responses lean for the agent.
 */
export function mergeCompatibleOffers(
  domain: AggregatableDomain,
  ranked: NormalizedOffer[],
): NormalizedOffer[] {
  const limit = domainLimit(domain)
  return ranked.slice(0, limit)
}

function domainLimit(domain: AggregatableDomain): number {
  switch (domain) {
    case 'flights':
      return 5
    case 'hotels':
      return 5
    case 'weather':
      return 1
    case 'maps':
      return 6
    case 'currency':
      return 1
    case 'visa':
      return 1
    case 'attractions':
      return 6
    case 'transportation':
      return 5
    default:
      return 5
  }
}
