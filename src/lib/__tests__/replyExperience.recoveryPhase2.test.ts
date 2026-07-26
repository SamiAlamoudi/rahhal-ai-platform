/**
 * Recovery Phase 2 — real conversation experience helpers.
 */
import { describe, expect, it } from 'vitest'
import { DETAILS_MARKER, splitConsultantReply } from '../chat/replyExperience'
import { composeTripPlanDisplay } from '../agent/formatReply'
import { buildTripPlan } from '../agent/buildItinerary'
import { emptyRequirements } from '../agent/types'
import { selectThinkingSteps, thinkingLabel } from '../premiumExperience'
import { memoryReflectLine } from '../consultantIntelligence'
import { DEFAULT_HANDS_FREE_SILENCE_MS } from '../chat/voice/voiceTypes'

describe('Recovery Phase 2 — reply experience', () => {
  it('splits marker-based replies into summary + expandable details', () => {
    const raw = `أرشح أكادير لأنها أهدأ.${DETAILS_MARKER}### Daily itinerary\n- Day 1`
    const split = splitConsultantReply(raw)
    expect(split.summary).toMatch(/أكادير/)
    expect(split.summary).not.toContain('Daily itinerary')
    expect(split.details).toContain('Daily itinerary')
  })

  it('auto-truncates long unmarked replies to a short summary', () => {
    const long = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} with extra travel prose.`).join('\n')
    const split = splitConsultantReply(long)
    expect(split.summary.split('\n').filter(Boolean).length).toBeLessThanOrEqual(5)
    expect(split.details).toBeTruthy()
  })

  it('keeps plan display details expandable while summary stays short', () => {
    const plan = buildTripPlan({
      conversationId: 'rp2',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Tokyo',
        destinations: ['Tokyo'],
        durationDays: 5,
        travelers: 2,
        travelerType: 'couple',
        budgetAmount: 3000,
        budgetCurrency: 'USD',
      },
    })
    const display = composeTripPlanDisplay(plan, 'en')
    expect(display).toContain('<!--RAHHAL_DETAILS-->')
    expect(display).toContain('### Daily itinerary')
    const split = splitConsultantReply(display)
    expect(split.summary.split('\n').filter(Boolean).length).toBeLessThanOrEqual(5)
    expect(split.details).toContain('Daily itinerary')
  })

  it('uses human memory phrasing instead of field dumps', () => {
    expect(memoryReflectLine({ locale: 'ar', beach: true })).toMatch(/تفضل البحر/)
    expect(memoryReflectLine({
      locale: 'ar',
      budgetAmount: 10000,
      budgetCurrency: 'ريال',
    })).toMatch(/ميزانيتك/)
  })

  it('thinking rail uses consultant phrases', () => {
    const steps = selectThinkingSteps('المغرب ميزانية')
    expect(thinkingLabel(steps[0]!, 'ar')).toMatch(/أفكر في أفضل الخيارات|أقارن بين الوجهات|أراجع الميزانية/)
  })

  it('hands-free silence auto-sends without a Send tap', () => {
    expect(DEFAULT_HANDS_FREE_SILENCE_MS).toBe(2200)
    expect(DEFAULT_HANDS_FREE_SILENCE_MS).toBeLessThanOrEqual(3000)
  })
})
