/**
 * Sprint 46 — Smart Clarification / Never-Ask-Twice tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import {
  inferSoftRequirements,
  missingClarificationFields,
  HARD_CLARIFICATION_FIELDS,
} from '../agent/clarification'
import { mergeRequirements, missingRequirementFields } from '../agent/memory'
import { emptyRequirements } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

function user(content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-46',
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

describe('Sprint 46 feature flag', () => {
  beforeEach(() => resetFeatureRegistry())

  it('enables ai.smart_clarification by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.smart_clarification')).toBe(true)
  })
})

describe('inferSoftRequirements', () => {
  it('infers traveler type, interests, weather, style, hotel, and package', () => {
    const base = mergeRequirements(emptyRequirements(), {
      destination: 'Japan',
      destinations: ['Japan'],
      durationDays: 5,
      budgetAmount: 3000,
      budgetCurrency: 'USD',
      travelers: 2,
    })
    const result = inferSoftRequirements(base, { locale: 'en' })
    expect(result.requirements.travelerType).toBe('couple')
    expect(result.requirements.interests).toEqual(['any'])
    expect(result.requirements.weatherPreference).toBe('flexible')
    expect(result.requirements.budgetStyle).toBeTruthy()
    expect(result.requirements.hotelPreference).toBeTruthy()
    expect(result.requirements.packageScope).toBe('full_package')
    expect(result.inferred).toEqual(expect.arrayContaining([
      'interests',
      'weatherPreference',
      'budgetStyle',
      'hotelPreference',
      'packageScope',
    ]))
  })

  it('never overwrites explicit soft preferences', () => {
    const base = mergeRequirements(emptyRequirements(), {
      destination: 'Bali',
      destinations: ['Bali'],
      durationDays: 7,
      budgetAmount: 5000,
      budgetCurrency: 'USD',
      travelers: 2,
      travelerType: 'couple',
      interests: ['beach'],
      weatherPreference: 'warm',
      budgetStyle: 'luxury',
      hotelPreference: 'resort',
      packageScope: 'full_package',
    })
    const result = inferSoftRequirements(base)
    expect(result.inferred).toEqual([])
    expect(result.requirements.interests).toEqual(['beach'])
    expect(result.requirements.budgetStyle).toBe('luxury')
  })

  it('infers business flights_only and central hotel', () => {
    const base = mergeRequirements(emptyRequirements(), {
      destination: 'London',
      destinations: ['London'],
      durationDays: 3,
      budgetAmount: 2500,
      budgetCurrency: 'USD',
      travelers: 1,
      travelerType: 'business',
      tripPurpose: 'business',
    })
    const result = inferSoftRequirements(base, { locale: 'en' })
    expect(result.requirements.packageScope).toBe('flights_only')
    expect(result.requirements.hotelPreference).toBe('central')
  })
})

describe('missingClarificationFields', () => {
  it('only reports hard slots when smart', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Japan',
      destinations: ['Japan'],
      durationDays: 5,
      budgetAmount: 3000,
      budgetCurrency: 'USD',
      travelers: 2,
    })
    expect(missingClarificationFields(req, { smart: true })).toEqual([])
    expect(HARD_CLARIFICATION_FIELDS).toContain('destination')
  })

  it('still requires duration and budget as hard slots', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Japan',
      destinations: ['Japan'],
    })
    expect(missingClarificationFields(req, { smart: true })[0]).toBe('durationDays')
  })
})

describe('missingRequirementFields with smart clarification ON', () => {
  beforeEach(() => resetFeatureRegistry())

  it('does not block on soft preferences', () => {
    const req = mergeRequirements(emptyRequirements(), {
      destination: 'Japan',
      destinations: ['Japan'],
      durationDays: 5,
      budgetAmount: 3000,
      budgetCurrency: 'USD',
      travelers: 2,
    })
    expect(missingRequirementFields(req, { smart: true })).toEqual([])
    expect(missingRequirementFields(req, { smart: false })).toContain('interests')
  })
})

describe('travelAgentService never-ask-twice', () => {
  beforeEach(() => resetFeatureRegistry())

  it('builds a plan from hard facts only — no soft preference interrogation', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 'conv-46',
      messages: [
        user('Plan 5 days in Japan under $3000 for 2 travelers.'),
      ],
    })
    expect(turn.memory.missingFields).toEqual([])
    expect(turn.tripPlan).toBeTruthy()
    expect(turn.tripPlan?.destinations).toContain('Japan')
    expect(turn.tripPlan?.durationDays).toBe(5)
    expect(turn.memory.requirements.interests.length).toBeGreaterThan(0)
    expect(turn.memory.requirements.packageScope).toBeTruthy()
    expect(turn.meta.clarification?.inferredFields.length).toBeGreaterThan(0)
    expect(turn.reply.toLowerCase()).not.toMatch(/preferred weather\?|ما الطقس المفضل/)
    expect(turn.reply.toLowerCase()).not.toMatch(/hotel preference\?|تفضيل الفندق/)
  })

  it('still asks for duration when only destination is known', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
    })
    const turn = await service.planTurn({
      conversationId: 'conv-46',
      messages: [user('I want to travel to Japan.')],
    })
    expect(turn.tripPlan).toBeNull()
    expect(turn.memory.missingFields[0]).toBe('durationDays')
    expect(turn.reply.toLowerCase()).toMatch(/when|day|مدة|متى/)
  })
})
