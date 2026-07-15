import { describe, it, expect } from 'vitest'
import {
  mergeRequirements,
  missingRequirementFields,
  rebuildMemoryFromMessages,
  tripPlanFromMeta,
} from '../agent/memory'
import { emptyRequirements } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

function assistantWithMemory(memory: Record<string, unknown>, tripPlan: unknown = null): ChatMessage {
  return {
    id: 'a1',
    conversationId: 'c1',
    role: 'assistant',
    modality: 'text',
    content: 'ok',
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {
      kind: 'travel_agent',
      version: 2,
      memory,
      tripPlan,
      itinerary: tripPlan,
    },
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

function completeRequirements() {
  return {
    ...emptyRequirements(),
    destination: 'Riyadh',
    destinations: ['Riyadh'],
    durationDays: 2,
    budgetAmount: 2000,
    budgetCurrency: 'SAR',
    travelers: 2,
    travelerType: 'couple' as const,
    interests: ['food'],
    weatherPreference: 'mild',
    budgetStyle: 'midrange' as const,
    hotelPreference: 'central',
    packageScope: 'full_package' as const,
  }
}

describe('agent memory', () => {
  it('merges requirements and tracks interactive intake fields without guessing', () => {
    const merged = mergeRequirements(emptyRequirements(), {
      destination: 'Japan',
      destinations: ['Japan'],
    })
    expect(missingRequirementFields(merged)[0]).toBe('durationDays')
    const withDuration = mergeRequirements(merged, { durationDays: 7 })
    expect(missingRequirementFields(withDuration)[0]).toBe('budgetAmount')
    const complete = mergeRequirements(withDuration, {
      budgetAmount: 3000,
      budgetCurrency: 'USD',
      travelers: 2,
      travelerType: 'couple',
      interests: ['food'],
      weatherPreference: 'mild',
      budgetStyle: 'midrange',
      hotelPreference: 'central',
      packageScope: 'full_package',
    })
    expect(missingRequirementFields(complete)).toEqual([])
  })

  it('rebuilds conversation memory from assistant provider meta', () => {
    const memory = rebuildMemoryFromMessages([
      assistantWithMemory({
        locale: 'en',
        phase: 'collecting',
        requirements: completeRequirements(),
        tripPlan: null,
        itinerary: null,
        missingFields: [],
        lastIntent: 'plan',
      }),
    ], 'ar')
    expect(memory.locale).toBe('en')
    expect(memory.requirements.destination).toBe('Riyadh')
    expect(memory.missingFields).toEqual([])
  })

  it('reads tripPlan from meta for UI actions', () => {
    const plan = { id: 'p1', title: 'Bali', destinations: ['Bali'] }
    expect(tripPlanFromMeta({
      kind: 'travel_agent',
      version: 2,
      memory: {
        locale: 'en',
        phase: 'planned',
        requirements: emptyRequirements(),
        tripPlan: plan,
        itinerary: plan,
        missingFields: [],
        lastIntent: 'plan',
      },
      tripPlan: plan,
      itinerary: plan,
    })?.title).toBe('Bali')
  })
})
