import { describe, expect, it } from 'vitest'
import { TripPlanner } from '../planner'
import { TimelineBuilder } from './TimelineBuilder'

describe('TimelineBuilder', () => {
  it('builds day labels with and without start date', () => {
    const plan = new TripPlanner().plan({ destination: 'Dubai', durationNights: 3 })
    const tl = new TimelineBuilder()
    const withDate = tl.build(plan, '2026-10-01')
    expect(withDate[0]?.dateLabel).toBe('2026-10-01')
    const noDate = tl.build(plan)
    expect(noDate[0]?.dateLabel).toMatch(/Day/)
    expect(tl.build(plan, 'not-a-date')[0]?.dateLabel).toMatch(/Day/)
  })
})
