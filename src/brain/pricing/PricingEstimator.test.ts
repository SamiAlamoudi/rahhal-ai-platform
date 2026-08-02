import { describe, expect, it } from 'vitest'
import { PricingEstimator } from './PricingEstimator'

describe('PricingEstimator', () => {
  const p = new PricingEstimator()

  it('estimates bands', () => {
    const band = p.estimate({
      destination: 'London',
      durationNights: 4,
      travellers: { adults: 2, children: 0 },
      hotelClass: 5,
      currency: 'GBP',
    })
    expect(band.low).toBeLessThan(band.mid)
    expect(band.high).toBeGreaterThan(band.mid)
    expect(band.currency).toBe('GBP')
  })

  it('predicts trends', () => {
    expect(p.predictTrend('Dubai')).toBe('rising')
    expect(p.predictTrend('Cairo')).toBe('falling')
    expect(p.predictTrend('Istanbul')).toBe('stable')
    expect(p.predictTrend()).toBe('stable')
  })
})
