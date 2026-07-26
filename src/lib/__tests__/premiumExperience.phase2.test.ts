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
  it('selects user-friendly thinking steps without CoT', () => {
    const steps = selectThinkingSteps('أريد رحلة طيران وفندق في دبي بميزانية جيدة')
    expect(steps.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'searching_flights',
        'comparing_hotels',
        'finding_offers',
        'crafting_reply',
      ]),
    )
    expect(thinkingLabel(steps[0]!, 'ar')).not.toMatch(/chain|reason|think hard/i)
  })

  it('builds dynamic result cards from seed text', () => {
    const cards = buildDynamicResultCards('hotel weather budget flight', 4)
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.some((c) => c.kind === 'flight')).toBe(true)
    expect(cards.some((c) => c.kind === 'hotel')).toBe(true)
  })

  it('does not show Riyadh→Dubai cards for a Morocco seed', () => {
    const cards = buildDynamicResultCards(
      'أريد السفر إلى المغرب لمدة أسبوع من الرياض ميزانية عشرة آلاف',
      4,
    )
    const flight = cards.find((c) => c.kind === 'flight')
    expect(flight?.titleAr).toMatch(/المغرب|أكادير|مراكش/)
    expect(flight?.titleAr).not.toContain('دبي')
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
