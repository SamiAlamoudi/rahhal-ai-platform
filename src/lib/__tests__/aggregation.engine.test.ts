import { describe, it, expect } from 'vitest'
import {
  createAggregationEngine,
  createProviderRegistry,
  createMockAmadeusAdapter,
  createMockDuffelAdapter,
  createMockBookingComAdapter,
  createMockExpediaAdapter,
  createDuplicateFlightAdapterForTests,
  createDefaultMockProviderAdapters,
} from '../agent/aggregation'

describe('aggregation engine', () => {
  it('queries multiple flight providers in parallel and ranks results', async () => {
    const registry = createProviderRegistry([
      createMockAmadeusAdapter(),
      createMockDuffelAdapter(),
    ])
    const engine = createAggregationEngine({ registry })
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: {
        origin: 'RUH',
        destination: 'Japan',
        travelers: 2,
        currency: 'USD',
      },
    })

    expect(result.meta.providersQueried).toBe(2)
    expect(result.meta.providersSucceeded).toBe(2)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0].rankScore).toBeGreaterThan(0)
    expect(result.averageConfidence).toBeGreaterThan(0)
    expect(result.providerResults.every((p) => p.status === 'ok')).toBe(true)
  })

  it('deduplicates identical fingerprints across providers', async () => {
    const registry = createProviderRegistry([
      createMockAmadeusAdapter(),
      createDuplicateFlightAdapterForTests(),
    ])
    const engine = createAggregationEngine({ registry })
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'Japan', travelers: 2, currency: 'USD' },
    })
    expect(result.meta.duplicatesRemoved).toBeGreaterThan(0)
    const fingerprints = result.items.map((i) => i.fingerprint)
    expect(new Set(fingerprints).size).toBe(fingerprints.length)
  })

  it('handles partial provider failure gracefully', async () => {
    const failing = {
      ...createMockDuffelAdapter(),
      async fetch() {
        throw new Error('upstream_down')
      },
    }
    const registry = createProviderRegistry([
      createMockAmadeusAdapter(),
      failing,
    ])
    const engine = createAggregationEngine({ registry })
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'London', travelers: 1, currency: 'USD' },
    })
    expect(result.meta.providersSucceeded).toBe(1)
    expect(result.providerResults.some((p) => p.status === 'error')).toBe(true)
    expect(result.items.length).toBeGreaterThan(0)
  })

  it('aggregates hotels from Booking.com + Expedia mocks', async () => {
    const registry = createProviderRegistry([
      createMockBookingComAdapter(),
      createMockExpediaAdapter(),
    ])
    const engine = createAggregationEngine({ registry })
    const result = await engine.aggregate({
      domain: 'hotels',
      locale: 'en',
      input: { destination: 'Japan', nights: 4, currency: 'USD' },
    })
    expect(result.meta.providersSucceeded).toBe(2)
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items.every((i) => i.domain === 'hotels')).toBe(true)
  })

  it('default registry includes future provider ids as metadata catalog', () => {
    const adapters = createDefaultMockProviderAdapters()
    const ids = adapters.map((a) => a.metadata.id)
    expect(ids).toEqual(expect.arrayContaining([
      'amadeus_mock',
      'duffel',
      'booking_com_mock',
      'expedia',
      'google_maps_mock',
      'openstreetmap',
      'openweather',
      'exchangerate',
      'visa_info',
      'attractions_catalog',
      'rome2rio',
    ]))
  })
})
