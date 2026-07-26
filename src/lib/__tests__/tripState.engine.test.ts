/**
 * Trip Planning State — persistent memory, stages, one missing question, card gate.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { emptyMemory, emptyRequirements } from '../agent/types'
import { mergeRequirements } from '../agent/memory'
import { extractFromUserText } from '../agent/extractRequirements'
import {
  emptyTripState,
  shouldShowTravelerResultCards,
  updateTripState,
} from '../tripState'
import type { ChatMessage } from '../chat/chatTypes'

function user(content: string, conversationId = 'ts'): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
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
    createdAt: now,
    updatedAt: now,
  }
}

function assistant(
  content: string,
  meta: Record<string, unknown>,
  conversationId = 'ts',
): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `a-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role: 'assistant',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: meta,
    createdAt: now,
    updatedAt: now,
  }
}

describe('TripState — incremental memory', () => {
  it('accumulates country → couple → budget → beach style without losing fields', () => {
    let state = emptyTripState()
    let req = emptyRequirements()

    const t1 = extractFromUserText('أريد السفر للمغرب', 'ar')
    req = mergeRequirements(req, t1.patch)
    state = updateTripState({
      previous: state,
      requirements: req,
      userText: 'أريد السفر للمغرب',
      hasTripPlan: false,
    })
    expect(state.destinationCountry).toBe('Morocco')
    expect(state.destinationCity).toBeNull()
    expect(state.primaryMissing).toBe('destinationCity')
    expect(state.conversationStage).toBe('CLARIFICATION')
    expect(state.cardsAllowed).toBe(false)

    const t2 = extractFromUserText('مع زوجتي', 'ar')
    req = mergeRequirements(req, t2.patch)
    state = updateTripState({
      previous: state,
      requirements: req,
      userText: 'مع زوجتي',
      hasTripPlan: false,
    })
    expect(state.destinationCountry).toBe('Morocco')
    expect(state.travelers).toBe(2)
    expect(state.relationship).toBe('couple')
    expect(state.primaryMissing).toBe('destinationCity')

    const t3 = extractFromUserText('ميزانيتي 10000', 'ar')
    req = mergeRequirements(req, t3.patch)
    state = updateTripState({
      previous: state,
      requirements: req,
      userText: 'ميزانيتي 10000',
      hasTripPlan: false,
    })
    expect(state.budget).toBe(10000)
    expect(state.destinationCountry).toBe('Morocco')
    expect(state.travelers).toBe(2)

    const t4 = extractFromUserText('أحب البحر', 'ar')
    req = mergeRequirements(req, t4.patch)
    state = updateTripState({
      previous: state,
      requirements: req,
      userText: 'أحب البحر',
      hasTripPlan: false,
    })
    expect(state.travelStyle).toBe('Beach')
    expect(state.budget).toBe(10000)
    expect(state.destinationCountry).toBe('Morocco')
    expect(state.cardsAllowed).toBe(false)
  })

  it('locks city and advances stage after Marrakech + timing + budget + style', () => {
    let state = emptyTripState()
    let req = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      travelers: 2,
      travelerType: 'couple',
      budgetAmount: 10000,
      budgetCurrency: 'SAR',
    })
    state = updateTripState({
      previous: state,
      requirements: req,
      userText: 'المغرب',
      hasTripPlan: false,
    })

    const city = extractFromUserText('مراكش', 'ar')
    req = mergeRequirements(req, city.patch, { replaceDestinations: true })
    state = updateTripState({
      previous: state,
      requirements: req,
      userText: 'مراكش',
      hasTripPlan: false,
    })
    expect(state.destinationCity).toBe('Marrakech')
    expect(state.destinationCountry).toBe('Morocco')

    req = mergeRequirements(req, { durationDays: 7 })
    state = updateTripState({
      previous: state,
      requirements: req,
      userText: 'أسبوع',
      hasTripPlan: false,
    })
    state = updateTripState({
      previous: state,
      requirements: req,
      userText: 'أحب البحر',
      hasTripPlan: false,
    })
    expect(state.travelStyle).toBe('Beach')
    expect(state.primaryMissing).toBeNull()
    expect(state.conversationStage).toBe('RECOMMENDATIONS')
    expect(state.cardsAllowed).toBe(true)
    expect(state.completionPercentage).toBeGreaterThan(50)
  })
})

describe('TripState — planTurn persistence', () => {
  beforeEach(() => resetFeatureRegistry())

  it('attaches tripState on every turn and never forgets Morocco + budget', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const t1 = await service.planTurn({
      conversationId: 'ts-persist',
      messages: [user('أريد السفر للمغرب', 'ts-persist')],
    })
    expect(t1.meta.tripState?.destinationCountry).toBe('Morocco')
    expect(t1.meta.tripState?.primaryMissing).toBe('destinationCity')
    expect(t1.meta.tripState?.cardsAllowed).toBe(false)
    expect(t1.tripPlan).toBeFalsy()

    const t2 = await service.planTurn({
      conversationId: 'ts-persist',
      messages: [
        user('أريد السفر للمغرب', 'ts-persist'),
        assistant(t1.reply, t1.meta as unknown as Record<string, unknown>, 'ts-persist'),
        user('مع زوجتي لمدة أسبوع بميزانية 10000 ريال', 'ts-persist'),
      ],
    })
    expect(t2.meta.tripState?.destinationCountry).toBe('Morocco')
    expect(t2.meta.tripState?.travelers).toBe(2)
    expect(t2.meta.tripState?.relationship).toBe('couple')
    expect(t2.meta.tripState?.budget).toBe(10000)
    expect(t2.meta.tripState?.duration).toBe(7)
    expect(t2.meta.tripState?.primaryMissing).toBe('destinationCity')
    expect(t2.meta.tripState?.cardsAllowed).toBe(false)

    const t3 = await service.planTurn({
      conversationId: 'ts-persist',
      messages: [
        user('أريد السفر للمغرب', 'ts-persist'),
        assistant(t1.reply, t1.meta as unknown as Record<string, unknown>, 'ts-persist'),
        user('مع زوجتي لمدة أسبوع بميزانية 10000 ريال', 'ts-persist'),
        assistant(t2.reply, t2.meta as unknown as Record<string, unknown>, 'ts-persist'),
        user('مراكش', 'ts-persist'),
      ],
    })
    expect(t3.meta.tripState?.destinationCity).toBe('Marrakech')
    expect(t3.meta.tripState?.budget).toBe(10000)
    expect(t3.meta.tripState?.duration).toBe(7)
    expect(t3.meta.tripState?.cardsAllowed).toBe(false)
  })

  it('hides result cards until planning stage completes', () => {
    const clarifying = assistant('أي مدينة تفضل؟', {
      kind: 'travel_agent',
      version: 2,
      memory: emptyMemory('ar'),
      tripState: {
        ...emptyTripState(),
        destinationCountry: 'Morocco',
        conversationStage: 'CLARIFICATION',
        cardsAllowed: false,
        primaryMissing: 'destinationCity',
        missingFields: ['destinationCity'],
      },
    })
    expect(shouldShowTravelerResultCards(clarifying)).toBe(false)

    const ready = assistant('وجدت خيارات تناسب رحلتك', {
      kind: 'travel_agent',
      version: 2,
      memory: emptyMemory('ar'),
      tripState: {
        ...emptyTripState(),
        destinationCountry: 'Morocco',
        destinationCity: 'Marrakech',
        duration: 7,
        budget: 10000,
        travelStyle: 'Beach',
        conversationStage: 'RECOMMENDATIONS',
        cardsAllowed: true,
        primaryMissing: null,
        missingFields: [],
        completionPercentage: 75,
      },
    })
    expect(shouldShowTravelerResultCards(ready)).toBe(true)
  })
})
