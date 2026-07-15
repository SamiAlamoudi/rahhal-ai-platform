import { describe, it, expect } from 'vitest'
import {
  mergeRequirements,
  missingRequirementFields,
  rebuildMemoryFromMessages,
} from '../agent/memory'
import { emptyRequirements } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

function assistantWithMemory(memory: Record<string, unknown>): ChatMessage {
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
      version: 1,
      memory,
      itinerary: null,
    },
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

describe('agent memory', () => {
  it('merges requirements and tracks missing fields', () => {
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
        itinerary: null,
        missingFields: [],
        lastIntent: 'plan',
      }),
    ], 'ar')
    expect(memory.locale).toBe('en')
    expect(memory.requirements.destination).toBe('Riyadh')
    expect(memory.missingFields).toEqual([])
  })
})
