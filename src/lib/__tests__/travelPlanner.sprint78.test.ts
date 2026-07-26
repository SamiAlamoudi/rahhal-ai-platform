/**
 * Sprint 78 — AI Travel Strategy Planner production tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import { emptyMemory, emptyRequirements } from '../agent'
import {
  detectConstraints,
  detectPlannerIntent,
  planRequiredQuestions,
  runTravelPlanner,
  SPRINT78_TRAVEL_PLANNER_VERSION,
} from '../agent/travelPlanner'
import { selectToolsForTurn } from '../agent/tools/selectTools'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import type { TripRequirements } from '../agent/types'

function msg(content: string, conversationId = 'p78'): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 7)}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
  }
}

function req(partial: Partial<TripRequirements> = {}): TripRequirements {
  return { ...emptyRequirements(), ...partial }
}

describe('Sprint 78 — AI Travel Strategy Planner', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('enables ai.travel_planner by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.travel_planner')).toBe(true)
    expect(SPRINT78_TRAVEL_PLANNER_VERSION).toMatch(/travel-planner/)
  })

  it('detects business and conference purposes', () => {
    expect(detectPlannerIntent('I have a conference in Tokyo.').travelPurpose).toBe('conference')
    expect(runTravelPlanner({
      userText: 'Business trip to Dubai with an early meeting',
      memory: { ...emptyMemory('en'), requirements: req({ destination: 'Dubai' }) },
    }).travelPurpose).toMatch(/business|conference/)
  })

  it('detects family travelers and children constraints', () => {
    const result = runTravelPlanner({
      userText: 'We have two children and want a family vacation in Paris',
      memory: {
        ...emptyMemory('en'),
        requirements: req({ destination: 'Paris', travelers: 4, travelerType: 'family' }),
      },
    })
    expect(result.travelPurpose).toBe('family')
    expect(result.travelerType).toBe('family')
    expect(result.constraints.some((c) => c.kind === 'children')).toBe(true)
    expect(result.priorityWeights.family).toBeGreaterThan(result.priorityWeights.business)
  })

  it('detects luxury and honeymoon strategies', () => {
    const honeymoon = runTravelPlanner({
      userText: 'My wife and I want a honeymoon. I only stay at Marriott.',
      memory: {
        ...emptyMemory('en'),
        requirements: req({ destination: 'Maldives', travelerType: 'couple', tripPurpose: 'honeymoon' }),
      },
    })
    expect(honeymoon.travelPurpose).toBe('honeymoon')
    expect(honeymoon.decisions.needHotelFirst).toBe(true)
    expect(honeymoon.preferences.some((p) => p.kind === 'hotel_brand' && /marriott/i.test(p.value))).toBe(true)
  })

  it('detects medical purpose and accessibility constraints', () => {
    const medical = runTravelPlanner({
      userText: 'Medical treatment abroad; I need wheelchair accessibility.',
      memory: { ...emptyMemory('en'), requirements: req({ destination: 'Germany' }) },
    })
    expect(medical.travelPurpose).toBe('medical')
    expect(medical.constraints.some((c) => c.kind === 'accessibility' || c.kind === 'medical_needs')).toBe(true)
    expect(medical.riskFlags.some((f) => /access|medical/i.test(f) || f.includes('accessibility'))).toBe(true)
  })

  it('detects multi-city trip type', () => {
    expect(detectPlannerIntent('Multi-city trip across Tokyo and Osaka').tripType).toBe('multi_city')
    const result = runTravelPlanner({
      userText: 'Multi-city Japan: Tokyo then Osaka',
      memory: {
        ...emptyMemory('en'),
        requirements: req({ destinations: ['Tokyo', 'Osaka'], destination: 'Tokyo' }),
      },
    })
    expect(result.decisions.needMultiCity).toBe(true)
  })

  it('handles incomplete requests with one clarifying question at a time', () => {
    const result = runTravelPlanner({
      userText: 'I want to travel somewhere nice',
      memory: emptyMemory('en'),
      locale: 'en',
    })
    expect(result.missingInformation.length).toBeGreaterThan(0)
    expect(result.decisions.shouldAskQuestion).toBe(true)
    expect(result.combinedQuestion).toBeTruthy()
    expect(result.requiredQuestions).toHaveLength(1)
    expect((result.combinedQuestion!.match(/\?/g) ?? []).length).toBe(1)
  })

  it('marks missing budget when destination and dates exist', () => {
    const result = runTravelPlanner({
      userText: 'Trip to Cairo for 5 days with my family',
      memory: {
        ...emptyMemory('en'),
        requirements: req({
          destination: 'Cairo',
          durationDays: 5,
          travelers: 3,
          travelerType: 'family',
        }),
      },
    })
    expect(result.missingInformation).toContain('budget')
  })

  it('marks missing dates for incomplete date requests', () => {
    const result = runTravelPlanner({
      userText: 'I want to go to London with 2 travelers, budget SAR 9000',
      memory: {
        ...emptyMemory('en'),
        requirements: req({
          destination: 'London',
          travelers: 2,
          budgetAmount: 9000,
          budgetCurrency: 'SAR',
        }),
      },
    })
    expect(result.missingInformation).toContain('dates')
    expect(result.decisions.shouldAskQuestion).toBe(true)
  })

  it('skips visa tool when traveler already has a visa', () => {
    const result = runTravelPlanner({
      userText: 'Tokyo conference. I already have a visa. Budget SAR 9000.',
      memory: {
        ...emptyMemory('en'),
        requirements: req({
          destination: 'Tokyo',
          durationDays: 4,
          travelers: 1,
          budgetAmount: 9000,
          tripPurpose: 'business',
        }),
      },
    })
    expect(result.constraints.some((c) => c.kind === 'visa' && c.value === 'already_have')).toBe(true)
    expect(result.searchPlan.skipTools).toContain('visa')
    expect(result.riskFlags).toContain('visa_satisfied')
  })

  it('requires direct flights and meeting-time constraints', () => {
    const { constraints } = detectConstraints(
      'I want direct flights and need to arrive before 8 AM.',
      { ...emptyMemory('en'), requirements: req({ destination: 'Dubai' }) },
    )
    expect(constraints.some((c) => c.kind === 'direct_flight')).toBe(true)
    expect(constraints.some((c) => c.kind === 'meeting_time')).toBe(true)

    const result = runTravelPlanner({
      userText: 'I want direct flights and need to arrive before 8 AM for a meeting in Dubai.',
      memory: {
        ...emptyMemory('en'),
        requirements: req({ destination: 'Dubai', durationDays: 3, travelers: 1, budgetAmount: 5000 }),
      },
    })
    expect(result.decisions.needFlightsFirst).toBe(true)
    expect(result.riskFlags).toContain('hard_arrival_deadline')
  })

  it('asks only the highest-priority missing item (one question)', () => {
    const planned = planRequiredQuestions({
      missingInformation: ['dates', 'travelers', 'destination'],
      locale: 'en',
    })
    expect(planned.requiredQuestions).toHaveLength(1)
    expect(planned.combinedQuestion).toMatch(/dates/i)
    expect(planned.combinedQuestion).not.toMatch(/people|joining|destination/i)
  })

  it('handles complex mixed requests with preferences and budget', () => {
    const result = runTravelPlanner({
      userText:
        'Conference in Tokyo. My budget is SAR 9000. I only stay at Marriott. I want direct flights. I already have a visa. I don\'t care about airlines.',
      memory: {
        ...emptyMemory('en'),
        requirements: req({
          destination: 'Tokyo',
          durationDays: 5,
          travelers: 1,
          budgetAmount: 9000,
          budgetCurrency: 'SAR',
          tripPurpose: 'business',
        }),
      },
    })
    expect(result.travelPurpose).toBe('conference')
    expect(result.constraints.some((c) => c.kind === 'budget' && c.value === 9000)).toBe(true)
    expect(result.constraints.some((c) => c.kind === 'hotel_brand')).toBe(true)
    expect(result.constraints.some((c) => c.kind === 'direct_flight')).toBe(true)
    expect(result.searchPlan.skipTools).toContain('visa')
    expect(result.confidenceScore).toBeGreaterThan(50)
    expect(result.diagnostics.plannerReasoning.length).toBeGreaterThan(0)
  })

  it('reorders tools using planner searchPlan without removing core selection rules', () => {
    const planner = runTravelPlanner({
      userText: 'Luxury honeymoon — I only stay at Marriott in Bali',
      memory: {
        ...emptyMemory('en'),
        requirements: req({
          destination: 'Bali',
          durationDays: 7,
          travelers: 2,
          budgetAmount: 20000,
          tripPurpose: 'honeymoon',
        }),
      },
    })
    const tools = selectToolsForTurn({
      requirements: req({
        destination: 'Bali',
        durationDays: 7,
        travelers: 2,
        budgetAmount: 20000,
      }),
      intent: 'plan',
      missingFields: [],
      searchPlan: planner.searchPlan,
    })
    expect(tools).toContain('flights')
    expect(tools).toContain('hotels')
    const hotelIdx = tools.indexOf('hotels')
    const flightIdx = tools.indexOf('flights')
    expect(hotelIdx).toBeGreaterThanOrEqual(0)
    expect(hotelIdx).toBeLessThan(flightIdx)
  })

  it('planTurn attaches travelPlanner meta before search path', async () => {
    const agent = createTravelAgentService({
      travelPlannerEnabled: true,
      tripOptimizerEnabled: false,
      travelerPersonalizationEnabled: false,
      budgetIntelligenceEnabled: false,
      bookingIntelligenceEnabled: false,
      bookingExecutionEnabled: false,
      paymentsEnabled: false,
      rahhalBrainEnabled: false,
      autonomousAgentEnabled: false,
    })
    const turn = await agent.planTurn({
      conversationId: 'p78-meta',
      messages: [msg('I have a conference in Tokyo. My budget is SAR 9000.', 'p78-meta')],
    })
    expect(turn.meta.travelPlanner).toBeTruthy()
    expect(turn.meta.travelPlanner?.travelPurpose).toBe('conference')
    expect(turn.meta.travelPlanner?.confidenceScore).toBeGreaterThan(0)
    expect(turn.meta.travelPlanner?.travelStrategy).toBeTruthy()
  })
})
