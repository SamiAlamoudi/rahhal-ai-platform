/**
 * Recovery Phase 2 — premium AI experience helpers.
 */
import { describe, expect, it } from 'vitest'
import {
  buildDynamicResultCards,
  consultantLine,
  createMockRealtimeVoiceAdapter,
  createRealtimeVoiceAdapter,
  resolveRealtimeVoiceProviderId,
  selectThinkingSteps,
  thinkingLabel,
} from '../premiumExperience'

describe('Recovery Phase 2 — premium experience', () => {
  it('selects natural consultant thinking steps without CoT', () => {
    const steps = selectThinkingSteps('أريد رحلة طيران وفندق في دبي بميزانية جيدة')
    expect(steps.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'considering_options',
        'comparing_destinations',
        'reviewing_budget',
        'crafting_reply',
      ]),
    )
    expect(thinkingLabel(steps[0]!, 'ar')).toMatch(/أفكر|أقارن|أراجع/)
    expect(thinkingLabel(steps[0]!, 'ar')).not.toMatch(/chain|reason|think hard|spinner/i)
  })

  it('builds dynamic result cards from seed text', () => {
    const cards = buildDynamicResultCards('hotel weather budget flight', 4)
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.some((c) => c.kind === 'flight')).toBe(true)
    expect(cards.some((c) => c.kind === 'hotel')).toBe(true)
  })

  it('uses mock realtime voice when keys are absent', () => {
    expect(resolveRealtimeVoiceProviderId()).toBe('mock')
    const adapter = createRealtimeVoiceAdapter()
    expect(adapter.id).toBe('mock')
    expect(createMockRealtimeVoiceAdapter().label).toMatch(/mock/i)
  })

  it('exposes consultant personality lines', () => {
    expect(consultantLine('ar', 'whereToday')).toContain('تود')
    expect(consultantLine('en', 'dreamTrip').toLowerCase()).toContain('dream')
  })
})
