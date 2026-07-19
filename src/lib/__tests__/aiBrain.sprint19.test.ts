/**
 * Sprint 19 — AI Travel Brain.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  ConversationMemoryApi,
  ConversationOrchestrator,
  IntentClassifier,
  MissingInformationDetector,
  RequirementExtractor,
  ResponsePlanner,
  TravelPlanner,
  createConversationContext,
  createEmptyMemory,
} from '../brain'

describe('Sprint 19 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers brain flags disabled by default', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('brain.enabled')).toBe(false)
    expect(registry.isEnabled('brain.memory')).toBe(false)
    expect(registry.isEnabled('brain.intent')).toBe(false)
    expect(registry.isEnabled('brain.planner')).toBe(false)
    expect(registry.isEnabled('brain.debug')).toBe(false)
  })

  it('cascades children off when brain.enabled is off', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.memory', true)
    registry.setEnabled('brain.intent', true)
    registry.setEnabled('brain.planner', true)
    registry.setEnabled('brain.debug', true)
    expect(registry.isEnabled('brain.memory')).toBe(false)
    expect(registry.isEnabled('brain.debug')).toBe(false)
  })

  it('enables dependents when parent chain is on', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.memory', true)
    expect(registry.isEnabled('brain.enabled')).toBe(true)
    expect(registry.isEnabled('brain.memory')).toBe(true)
    expect(registry.isEnabled('brain.planner')).toBe(false)
  })
})

describe('Sprint 19 IntentClassifier', () => {
  it('classifies core travel intents', () => {
    expect(IntentClassifier({ text: 'Find flights to Dubai' }).intent).toBe('SearchFlights')
    expect(IntentClassifier({ text: 'ابحث عن فنادق في باريس' }).intent).toBe('SearchHotels')
    expect(IntentClassifier({ text: 'Do I need a visa for Japan?' }).intent).toBe('VisaQuestion')
    expect(IntentClassifier({ text: 'What is the weather in Istanbul?' }).intent).toBe(
      'WeatherQuestion',
    )
    expect(IntentClassifier({ text: 'What should I pack?' }).intent).toBe('PackingAdvice')
    expect(IntentClassifier({ text: 'Cancel my booking' }).intent).toBe('CancelBooking')
    expect(IntentClassifier({ text: 'Continue my booking' }).intent).toBe('ContinueBooking')
  })
})

describe('Sprint 19 RequirementExtractor + Memory', () => {
  it('extracts destination, budget, travelers, cabin, activities', () => {
    const { patch } = RequirementExtractor({
      text: 'Trip to Tokyo for 2 adults, budget 8000 SAR, business class, beach',
    })
    expect(patch.destination).toBe('Tokyo')
    expect(patch.budget?.amount).toBe(8000)
    expect(patch.budget?.currency).toBe('SAR')
    expect(patch.travelers?.count).toBe(2)
    expect(patch.cabinClass).toBe('business')
    expect(patch.activities).toContain('beach')
  })

  it('merges memory without losing previous answers', () => {
    let memory = createEmptyMemory('c1', 'en')
    memory = ConversationMemoryApi.applyPatch(memory, {
      destination: 'Dubai',
      destinations: ['Dubai'],
    })
    memory = ConversationMemoryApi.applyPatch(memory, {
      budget: { amount: 5000, currency: 'SAR', flexible: false },
    })
    expect(memory.destination).toBe('Dubai')
    expect(memory.budget.amount).toBe(5000)
    expect(memory.answeredFields).toEqual(
      expect.arrayContaining(['destination', 'budget', 'currency']),
    )
  })
})

describe('Sprint 19 MissingInformationDetector', () => {
  it('asks only for missing fields and never twice', () => {
    let memory = createEmptyMemory('c2', 'en')
    const first = MissingInformationDetector({
      memory,
      intent: 'SearchFlights',
    })
    expect(first[0]).toBe('destination')

    memory = ConversationMemoryApi.markAsked(memory, ['destination'])
    const second = MissingInformationDetector({
      memory,
      intent: 'SearchFlights',
    })
    expect(second.includes('destination')).toBe(false)
    expect(second[0]).toBe('travelDates')
  })

  it('skips filled slots', () => {
    let memory = createEmptyMemory('c3', 'en')
    memory = ConversationMemoryApi.applyPatch(memory, {
      destination: 'Paris',
      destinations: ['Paris'],
      travelDates: { startDate: null, endDate: null, durationDays: 5, flexible: false },
      travelers: { count: 2, adults: 2, children: 0, infants: 0 },
    })
    const missing = MissingInformationDetector({
      memory,
      intent: 'SearchFlights',
    })
    expect(missing).toEqual([])
  })
})

describe('Sprint 19 planners', () => {
  it('returns structured response plan without LLM prose', () => {
    const context = createConversationContext('c4', 'en')
    context.memory = ConversationMemoryApi.applyPatch(context.memory, {
      destination: 'Istanbul',
      destinations: ['Istanbul'],
      travelDates: { startDate: null, endDate: null, durationDays: 4, flexible: false },
      travelers: { count: 1, adults: 1, children: 0, infants: 0 },
    })
    const classification = IntentClassifier({ text: 'Search flights to Istanbul' })
    const missing = MissingInformationDetector({
      memory: context.memory,
      intent: classification.intent,
    })
    const travelPlan = TravelPlanner({
      intent: classification.intent,
      context,
      hasMissing: missing.length > 0,
    })
    const plan = ResponsePlanner({
      context,
      classification,
      missingFields: missing,
      travelPlan,
    })

    expect(plan.action).toBe('search_flights')
    expect(plan.searchRequests[0]?.kind).toBe('flights')
    expect(plan.summary.startsWith('ready:')).toBe(true)
    expect(plan.assistantGoal.startsWith('execute:')).toBe(true)
    // No fake conversational paragraph — tokens only.
    expect(plan.summary.includes('Istanbul is lovely')).toBe(false)
  })
})

describe('Sprint 19 ConversationOrchestrator', () => {
  it('runs the full orchestration pipeline and remembers slots across turns', () => {
    const brain = ConversationOrchestrator({ locale: 'en' })

    const t1 = brain.runTurn({ userText: 'I want flights to Dubai' })
    expect(t1.classification.intent).toBe('SearchFlights')
    expect(t1.context.memory.destination).toBe('Dubai')
    expect(t1.plan.action).toBe('ask_missing')
    expect(t1.missingFields.length).toBeGreaterThan(0)
    const asked = [...t1.context.memory.askedFields]
    expect(asked.length).toBe(1)

    const t2 = brain.runTurn({ userText: 'for 5 days with 2 travelers' })
    expect(t2.context.memory.destination).toBe('Dubai')
    expect(t2.context.memory.travelDates.durationDays).toBe(5)
    expect(t2.context.memory.travelers.count).toBe(2)
    // Previously asked field stays marked; not re-asked if still somehow missing.
    expect(t2.context.memory.askedFields).toEqual(expect.arrayContaining(asked))

    const t3 = brain.runTurn({ userText: 'find flights please' })
    expect(t3.plan.action).toBe('search_flights')
    expect(t3.plan.searchRequests).toHaveLength(1)
    expect(t3.context.history.turns.length).toBeGreaterThanOrEqual(6)
  })

  it('does not invent assistant chat content', () => {
    const brain = ConversationOrchestrator({ locale: 'en' })
    const result = brain.runTurn({ userText: 'Recommend a trip to Maldives' })
    const assistantTurns = result.context.history.turns.filter((t) => t.role === 'assistant')
    for (const turn of assistantTurns) {
      expect(turn.content.startsWith('need_slot:') || turn.content.startsWith('ready:')).toBe(
        true,
      )
    }
  })
})
