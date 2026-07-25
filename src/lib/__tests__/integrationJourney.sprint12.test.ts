/**
 * Integration Sprint 12 — End-to-End Journey Integration tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_JOURNEY_FEATURE_ID,
  INTEGRATION_JOURNEY_VERSION,
  JOURNEY_STAGE_ORDER,
  buildHandoffContext,
  enrichWithIntegrationJourney,
  inferJourneyStage,
  isIntegrationJourneyEnabled,
  resetJourneyMemoryForTests,
  runIntegrationJourney,
  scoreSharedJourneyDecision,
} from '../agent/integrationJourney'
import { emptyMemory, emptyRequirements, mergeRequirements, withTripPlan } from '../agent'
import { buildTripPlan } from '../agent/buildItinerary'
import type { AgentMemory } from '../agent/types'

function memoryForScenario(opts: {
  purpose?: string
  travelerType?: string
  budgetStyle?: string
  durationDays?: number
  destinations?: string[]
  budgetAmount?: number
}): AgentMemory {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: 'Riyadh',
    destination: opts.destinations?.[0] ?? 'Dubai',
    destinations: opts.destinations ?? ['Dubai'],
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    durationDays: opts.durationDays ?? 4,
    travelers: opts.travelerType === 'family' ? 4 : 2,
    children: opts.travelerType === 'family' ? 2 : 0,
    budgetAmount: opts.budgetAmount ?? 8000,
    budgetCurrency: 'SAR',
    budgetStyle: (opts.budgetStyle as 'budget' | 'midrange' | 'luxury') ?? 'midrange',
    tripPurpose: opts.purpose as 'business' | 'leisure' | 'family' | 'honeymoon' | undefined,
    travelerType: opts.travelerType as 'business' | 'family' | 'couple' | 'solo' | undefined,
  })
  const base = emptyMemory('en')
  const plan = buildTripPlan({
    conversationId: 'journey-e2e',
    requirements,
    locale: 'en',
  })
  plan.flights = [{
    from: 'RUH',
    to: 'DXB',
    airline: 'EK',
    stops: 0,
    estimatedCost: 1800,
    currency: 'SAR',
    notes: null,
  }]
  plan.accommodations = [{
    name: 'City Suites',
    area: 'Downtown',
    category: 'hotel',
    fit: 'Central',
    estimatedNightly: 450,
    currency: 'SAR',
  }]
  return withTripPlan({ ...base, requirements, missingFields: [] }, plan)
}

describe('Integration Sprint 12 — End-to-End Journey', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetJourneyMemoryForTests()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetJourneyMemoryForTests()
  })

  it('keeps journey flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(INTEGRATION_JOURNEY_FEATURE_ID)).toBe(false)
    expect(isIntegrationJourneyEnabled()).toBe(false)
    expect(INTEGRATION_JOURNEY_VERSION).toMatch(/integration-journey/)
    expect(JOURNEY_STAGE_ORDER).toContain('completion')
    expect(JOURNEY_STAGE_ORDER[0]).toBe('conversation')
  })

  it('returns disabled when flag is OFF', async () => {
    const result = await runIntegrationJourney({
      memory: memoryForScenario({}),
      userText: 'Plan my trip.',
    })
    expect(result.enabled).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('builds shared handoff without duplicating known slots', () => {
    const memory = memoryForScenario({ purpose: 'business', travelerType: 'business' })
    const handoff = buildHandoffContext({
      memory,
      stage: 'budget',
      scenario: 'business',
    })
    expect(handoff.knownSlots).toEqual(expect.arrayContaining([
      'destination',
      'origin',
      'budget',
      'flights',
      'hotels',
    ]))
    expect(handoff.previousDecisions).toEqual([])
    expect(handoff.travelerState).toBe('booking')
  })

  it('shared decision considers budget, flights, hotels, maps, risk, preference', () => {
    const memory = memoryForScenario({ budgetStyle: 'luxury', purpose: 'honeymoon' })
    const handoff = buildHandoffContext({ memory, stage: 'orchestrator', scenario: 'luxury' })
    const decision = scoreSharedJourneyDecision({
      memory,
      handoff,
      mapsMinutes: 35,
      riskHint: 25,
    })
    expect(decision.overall).toBeGreaterThan(40)
    expect(decision.budget).toBeGreaterThan(0)
    expect(decision.flights).toBeGreaterThan(0)
    expect(decision.hotels).toBeGreaterThan(0)
    expect(decision.maps).toBeGreaterThan(0)
    expect(decision.risk).toBe(25)
    expect(decision.preference).toBeGreaterThan(50)
  })

  it.each([
    [{ purpose: 'business', travelerType: 'business' }, 'business'],
    [{ travelerType: 'family', purpose: 'family' }, 'family'],
    [{ budgetStyle: 'luxury', purpose: 'honeymoon' }, 'luxury'],
    [{ durationDays: 2 }, 'weekend'],
    [{ budgetStyle: 'budget', budgetAmount: 2500 }, 'budget'],
    [{ destinations: ['Dubai', 'Abu Dhabi'] as string[] }, 'multi_city'],
  ] as const)('scenario %j → %s', async (opts, scenario) => {
    getFeatureRegistry().setEnabled(INTEGRATION_JOURNEY_FEATURE_ID, true)
    const result = await runIntegrationJourney({
      memory: memoryForScenario({ ...opts }),
      userText: 'Plan my trip.',
      deps: { enabled: true, userId: `scenario-${scenario}`, scenario },
    })
    expect(result.ok).toBe(true)
    expect(result.scenario).toBe(scenario)
    expect(result.stages.length).toBe(JOURNEY_STAGE_ORDER.length)
  })

  it('disruption recovery scenario + observability traces', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_JOURNEY_FEATURE_ID, true)
    const result = await runIntegrationJourney({
      memory: memoryForScenario({}),
      userText: 'My flight is delayed 3 hours.',
      deps: { enabled: true, userId: 'disrupt-1' },
    })
    expect(result.stage).toBe('disruption')
    expect(result.scenario).toBe('disruption_recovery')
    expect(result.observability.conversation[0]?.stage).toBe('disruption')
    expect(result.observability.decision[0]?.decision.overall).toBeGreaterThan(0)
    expect(result.observability.execution.length).toBeGreaterThan(0)
  })

  it('full conversation arc: plan → modify → book → travel → recover → complete', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_JOURNEY_FEATURE_ID, true)
    const userId = 'arc-traveler'
    const memory = memoryForScenario({ purpose: 'leisure' })

    const plan = await runIntegrationJourney({
      memory,
      userText: 'Plan my trip to Dubai.',
      deps: { enabled: true, userId, forceStage: 'planner' },
    })
    expect(plan.stage).toBe('planner')
    expect(plan.handoff.knownSlots.includes('destination')).toBe(true)

    const modify = await runIntegrationJourney({
      memory,
      userText: 'Change hotel area preferences.',
      deps: { enabled: true, userId, forceStage: 'hotels' },
    })
    expect(modify.stage).toBe('hotels')
    expect(modify.memory.turn).toBeGreaterThan(plan.memory.turn)

    const book = await runIntegrationJourney({
      memory,
      userText: 'Book it.',
      deps: { enabled: true, userId },
    })
    expect(book.stage).toBe('action')

    const travel = await runIntegrationJourney({
      memory,
      userText: "What's next on my trip?",
      deps: { enabled: true, userId },
    })
    expect(travel.stage).toBe('companion')

    const recover = await runIntegrationJourney({
      memory,
      userText: 'I missed my connection.',
      deps: { enabled: true, userId },
    })
    expect(recover.stage).toBe('disruption')

    const complete = await runIntegrationJourney({
      memory,
      userText: 'Trip complete, thank you.',
      deps: { enabled: true, userId, forceStage: 'completion' },
    })
    expect(complete.stage).toBe('completion')
    expect(complete.memory.completedStages).toContain('completion')
  })

  it('soft-activates child modules when activateChildren is set', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_JOURNEY_FEATURE_ID, true)
    const result = await runIntegrationJourney({
      memory: memoryForScenario({}),
      userText: 'Stay under my budget.',
      deps: {
        enabled: true,
        userId: 'child-activate',
        forceStage: 'budget',
        activateChildren: true,
      },
    })
    expect(result.ok).toBe(true)
    const budgetTrace = result.stages.find((s) => s.stage === 'budget')
    expect(budgetTrace?.note).toMatch(/budget_/)
    expect(budgetTrace?.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('infers stages from conversational cues', () => {
    const memory = memoryForScenario({})
    expect(inferJourneyStage({ userText: 'Book it.', memory })).toBe('action')
    expect(inferJourneyStage({ userText: 'How far is the hotel?', memory })).toBe('maps')
    expect(inferJourneyStage({ userText: 'Stay under my budget.', memory })).toBe('budget')
  })

  it('regression: enrich is a no-op when flag OFF', async () => {
    const memory = memoryForScenario({})
    const enriched = await enrichWithIntegrationJourney({
      memory,
      userText: 'Plan my trip.',
    })
    expect(enriched.journey).toBeNull()
    expect(enriched.memory).toBe(memory)
  })

  it('performance: journey path completes under budget', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_JOURNEY_FEATURE_ID, true)
    const started = Date.now()
    for (let i = 0; i < 20; i++) {
      resetJourneyMemoryForTests()
      await runIntegrationJourney({
        memory: memoryForScenario({}),
        userText: i % 2 === 0 ? 'Plan my trip.' : 'Book it.',
        deps: { enabled: true, userId: `perf-${i}` },
      })
    }
    expect(Date.now() - started).toBeLessThan(2000)
  })
})
