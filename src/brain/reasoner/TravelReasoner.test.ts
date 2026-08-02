import { describe, expect, it } from 'vitest'
import { TravelReasoner } from './TravelReasoner'

describe('TravelReasoner', () => {
  const r = new TravelReasoner()

  it('flags missing endpoints', () => {
    const report = r.reason({})
    expect(report.overallFeasible).toBe(false)
  })

  it('flags same city impossible', () => {
    const report = r.reason({ origin: 'Dubai', destination: 'Dubai' })
    expect(report.overallFeasible).toBe(false)
  })

  it('reasons over mock destination meta', () => {
    const report = r.reason(
      { origin: 'Riyadh', destination: 'Istanbul', budgetAmount: 5000, durationNights: 4 },
      'family',
    )
    expect(report.overallFeasible).toBe(true)
    expect(report.findings.some((f) => f.topic === 'weather')).toBe(true)
    expect(report.findings.some((f) => f.topic === 'holidays')).toBe(true)
  })

  it('handles tight budget and unknown destination', () => {
    const tight = r.reason({
      origin: 'Riyadh',
      destination: 'Dubai',
      budgetAmount: 500,
      durationNights: 5,
    })
    expect(tight.findings.some((f) => f.topic === 'budget' && f.ok === false)).toBe(true)

    const unknown = r.reason({ origin: 'Riyadh', destination: 'Nairobi' })
    expect(unknown.findings.some((f) => f.topic === 'season')).toBe(true)

    const noBudget = r.reason({ origin: 'Riyadh', destination: 'Cairo' })
    expect(noBudget.findings.some((f) => f.topic === 'budget')).toBe(true)

    const business = r.reason(
      { origin: 'Riyadh', destination: 'London', budgetAmount: 1000 },
      'business',
    )
    expect(business.findings.some((f) => f.topic === 'business_suitability')).toBe(true)
  })
})
