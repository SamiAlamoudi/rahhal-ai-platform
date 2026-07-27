/**
 * Recovery Phase 2 — premium AI experience helpers.
 */
import { describe, expect, it } from 'vitest'
import {
  buildDynamicResultCards,
  consultantLine,
  createMockVoiceAdapter,
  createVoiceAdapter,
  resolveVoiceAdapterProviderId,
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

  it('does not emit legacy demo result cards', () => {
    const cards = buildDynamicResultCards('hotel weather budget flight morocco', 4)
    expect(cards).toEqual([])
  })

  it('uses mock voice adapter by default', () => {
    expect(resolveVoiceAdapterProviderId()).toBe('mock')
    const adapter = createVoiceAdapter()
    expect(adapter.id).toBe('mock')
    expect(createMockVoiceAdapter().label).toMatch(/mock/i)
  })

  it('exposes consultant personality lines', () => {
    expect(consultantLine('ar', 'whereToday')).toContain('تود')
    expect(consultantLine('en', 'dreamTrip').toLowerCase()).toContain('dream')
  })
})
