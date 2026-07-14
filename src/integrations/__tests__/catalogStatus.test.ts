import { describe, it, expect } from 'vitest'
import {
  DEFERRED_CATALOG_DOMAINS,
  getCatalogStatus,
  isDeferredCatalogDomain,
} from '../catalogStatus'

describe('catalogStatus', () => {
  it('marks deferred domains as coming_soon', () => {
    expect(DEFERRED_CATALOG_DOMAINS).toEqual(['activity', 'transfer', 'visa'])
    const status = getCatalogStatus()
    for (const domain of DEFERRED_CATALOG_DOMAINS) {
      expect(isDeferredCatalogDomain(domain)).toBe(true)
      expect(status.find((s) => s.domain === domain)?.status).toBe('coming_soon')
    }
  })

  it('marks flight/hotel/weather/rental as live', () => {
    const status = getCatalogStatus()
    for (const domain of ['flight', 'hotel', 'weather', 'rental'] as const) {
      expect(status.find((s) => s.domain === domain)?.status).toBe('live')
      expect(isDeferredCatalogDomain(domain)).toBe(false)
    }
  })

  it('returns seven domain entries', () => {
    expect(getCatalogStatus()).toHaveLength(7)
  })
})
