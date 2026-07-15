import { describe, it, expect } from 'vitest'
import { dedupeOffers } from '../agent/aggregation/dedupe'
import { rankOffers } from '../agent/aggregation/ranking'
import { scoreOfferConfidence } from '../agent/aggregation/confidence'
import { mergeCompatibleOffers } from '../agent/aggregation/merge'
import type { NormalizedOffer, ProviderMetadata } from '../agent/aggregation/types'

function offer(partial: Partial<NormalizedOffer> & { fingerprint: string; title: string }): NormalizedOffer {
  return {
    domain: 'flights',
    price: 100,
    currency: 'USD',
    confidence: 0.7,
    providerId: 'amadeus',
    rankScore: 0,
    scoreHints: { priceCompetitiveness: 0.8, relevance: 0.8 },
    payload: {},
    ...partial,
  }
}

describe('aggregation primitives', () => {
  it('scores confidence from reliability and hints', () => {
    const meta: ProviderMetadata = {
      id: 'amadeus',
      displayName: 'Amadeus',
      domains: ['flights'],
      priority: 80,
      reliability: 0.9,
      mocked: true,
    }
    const confidence = scoreOfferConfidence(offer({
      fingerprint: 'a',
      title: 'A',
      confidence: 0,
      scoreHints: { priceCompetitiveness: 1, relevance: 1, rating: 1, durationQuality: 1 },
    }), meta)
    expect(confidence).toBeGreaterThan(0.8)
  })

  it('dedupes by fingerprint keeping higher confidence', () => {
    const result = dedupeOffers([
      offer({ fingerprint: 'x', title: 'low', confidence: 0.4, price: 120 }),
      offer({ fingerprint: 'x', title: 'high', confidence: 0.9, price: 130, providerId: 'duffel' }),
      offer({ fingerprint: 'y', title: 'other', confidence: 0.5 }),
    ])
    expect(result.duplicatesRemoved).toBe(1)
    expect(result.items).toHaveLength(2)
    expect(result.items.find((i) => i.fingerprint === 'x')?.title).toBe('high')
  })

  it('ranks by confidence and score hints', () => {
    const meta = new Map<string, ProviderMetadata>([
      ['amadeus', {
        id: 'amadeus',
        displayName: 'A',
        domains: ['flights'],
        priority: 90,
        reliability: 0.9,
        mocked: true,
      }],
      ['duffel', {
        id: 'duffel',
        displayName: 'D',
        domains: ['flights'],
        priority: 50,
        reliability: 0.8,
        mocked: true,
      }],
    ])
    const ranked = rankOffers([
      offer({
        fingerprint: 'cheap',
        title: 'cheap',
        providerId: 'duffel',
        confidence: 0.6,
        price: 90,
        scoreHints: { priceCompetitiveness: 0.95, relevance: 0.5 },
      }),
      offer({
        fingerprint: 'best',
        title: 'best',
        providerId: 'amadeus',
        confidence: 0.95,
        price: 110,
        scoreHints: { priceCompetitiveness: 0.8, relevance: 0.95, rating: 0.9 },
      }),
    ], meta)
    expect(ranked[0].title).toBe('best')
    expect(ranked[0].rankScore).toBeGreaterThan(ranked[1].rankScore)
  })

  it('merges to domain-specific top-N', () => {
    const many = Array.from({ length: 10 }, (_, i) => offer({
      fingerprint: `f${i}`,
      title: `F${i}`,
      confidence: 1 - i * 0.05,
      rankScore: 1 - i * 0.05,
    }))
    expect(mergeCompatibleOffers('weather', many)).toHaveLength(1)
    expect(mergeCompatibleOffers('flights', many)).toHaveLength(5)
  })
})
