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

describe('agent memory', () => {
  it('merges requirements and tracks missing fields without guessing duration', () => {
    const merged = mergeRequirements(emptyRequirements(), {
      destination: 'Japan',
      destinations: ['Japan'],
    })
    expect(missingRequirementFields(merged)).toEqual(['durationDays'])
    const complete = mergeRequirements(merged, { durationDays: 7 })
    expect(missingRequirementFields(complete)).toEqual([])
  })

  it('rebuilds conversation memory from assistant provider meta', () => {
    const memory = rebuildMemoryFromMessages([
      assistantWithMemory({
        locale: 'en',
        phase: 'collecting',
        requirements: {
          ...emptyRequirements(),
          destination: 'Riyadh',
          destinations: ['Riyadh'],
          durationDays: 2,
        },
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
