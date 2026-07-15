/**
 * Explicit catalog clarity: which travel domains are live-capable vs coming soon.
 * Aligns with deferred activity/transfer/visa outside flight + hotel (+ weather/rental).
 */

/** Domains intentionally deferred / mock-only in the product catalog. */
export const DEFERRED_CATALOG_DOMAINS = [
  'activity',
  'transfer',
  'visa',
] as const

export type CatalogDomain =
  | 'flight'
  | 'hotel'
  | 'weather'
  | 'rental'
  | 'activity'
  | 'transfer'
  | 'visa'

export type CatalogAvailability = 'live' | 'coming_soon'

export interface CatalogDomainStatus {
  domain: CatalogDomain
  status: CatalogAvailability
}

const LIVE_DOMAINS: readonly CatalogDomain[] = [
  'flight',
  'hotel',
  'weather',
  'rental',
] as const

export function getCatalogStatus(): CatalogDomainStatus[] {
  const live = LIVE_DOMAINS.map((domain) => ({
    domain,
    status: 'live' as const,
  }))
  const deferred = DEFERRED_CATALOG_DOMAINS.map((domain) => ({
    domain,
    status: 'coming_soon' as const,
  }))
  return [...live, ...deferred]
}

export function isDeferredCatalogDomain(domain: string): boolean {
  return (DEFERRED_CATALOG_DOMAINS as readonly string[]).includes(domain)
}
