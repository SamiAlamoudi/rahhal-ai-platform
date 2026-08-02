import { describe, expect, it } from 'vitest'
import { TripPlanner } from './TripPlanner'

describe('TripPlanner', () => {
  it('builds skeleton with assumptions', () => {
    const plan = new TripPlanner().plan({ destination: 'Dubai' })
    expect(plan.nights).toBe(3)
    expect(plan.assumptions.length).toBeGreaterThan(0)
    expect(plan.steps.some((s) => s.kind === 'buffer')).toBe(true)
  })

  it('uses provided nights and origin', () => {
    const plan = new TripPlanner().plan({
      origin: 'Riyadh',
      destination: 'Cairo',
      durationNights: 2,
    })
    expect(plan.nights).toBe(2)
    expect(plan.steps.some((s) => s.kind === 'buffer')).toBe(false)
    expect(plan.steps[0]?.title).toContain('Riyadh')
  })
})
