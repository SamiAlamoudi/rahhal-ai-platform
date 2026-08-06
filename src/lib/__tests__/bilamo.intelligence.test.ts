import { describe, expect, it } from 'vitest'
import {
  canSearch,
  nextMinimumQuestion,
  runBilamoIntelligenceTurn,
  runBilamoSearchOrchestrator,
  emptyBilamoMemory,
  rememberAsked,
} from '../bilamo/intelligence'
import { emptyRequirements } from '../agent/types'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

function msg(
  role: 'user' | 'assistant',
  content: string,
  providerMeta: Record<string, unknown> = {},
): ChatMessage {
  const now = '2026-08-06T00:00:00.000Z'
  return {
    id: `${role}-${content.slice(0, 12)}`,
    conversationId: 'bilamo-c1',
    role,
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta,
    createdAt: now,
    updatedAt: now,
  }
}

describe('Bilamo Intelligence Layer', () => {
  it('asks only for dates after destination is known', async () => {
    const turn = await runBilamoIntelligenceTurn({
      conversationId: 'bilamo-c1',
      userText: 'I want to travel to Japan.',
      messages: [msg('user', 'I want to travel to Japan.')],
    })
    expect(turn).not.toBeNull()
    expect(turn!.phase).toBe('collecting')
    expect(turn!.askedSlot).toBe('dates')
    expect(turn!.requirements.destination).toMatch(/Japan/i)
    expect(turn!.displayText.toLowerCase()).toMatch(/when|day|date/)
    expect(turn!.displayText.toLowerCase()).not.toMatch(/budget/)
    expect(turn!.search).toBeNull()
  })

  it('never re-asks a slot already asked when still missing other hard slots', () => {
    const req = {
      ...emptyRequirements(),
      destination: 'Japan',
      destinations: ['Japan'],
    }
    const first = nextMinimumQuestion({ requirements: req, askedSlots: [] })
    expect(first).toBe('dates')
    const second = nextMinimumQuestion({
      requirements: req,
      askedSlots: ['dates'],
    })
    expect(second).toBe('travelers')
  })

  it('does not treat budget as required for search readiness', () => {
    const req = {
      ...emptyRequirements(),
      destination: 'Japan',
      destinations: ['Japan'],
      durationDays: 7,
      travelers: 2,
      budgetAmount: null,
    }
    expect(canSearch(req)).toBe(true)
    expect(nextMinimumQuestion({ requirements: req, askedSlots: [] })).toBeNull()
  })

  it('remembers asked slots across rememberAsked', () => {
    const base = emptyBilamoMemory('en')
    const next = rememberAsked(base, 'dates')
    expect(next.askedSlots).toEqual(['dates'])
    expect(rememberAsked(next, 'dates').askedSlots).toEqual(['dates'])
  })

  it('runs parallel search domains into one bundle', async () => {
    const bundle = await runBilamoSearchOrchestrator({
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
        travelers: 2,
        origin: 'RUH',
      },
    })
    expect(bundle.flights.length).toBeGreaterThan(0)
    expect(bundle.hotels.length).toBeGreaterThan(0)
    expect(bundle.context.weather).toBeTruthy()
    expect(bundle.context.visa).toBeTruthy()
    expect(bundle.context.currency).toBeTruthy()
    expect(bundle.context.transfer).toBeTruthy()
    expect(bundle.timeline.length).toBeGreaterThan(0)
    expect(bundle.flights[0].reason).toBeTruthy()
  })

  it('recommends with explanation once hard slots are filled', async () => {
    const turn = await runBilamoIntelligenceTurn({
      conversationId: 'bilamo-c1',
      userText: '7 days in Japan for 2 travelers',
      messages: [msg('user', '7 days in Japan for 2 travelers')],
    })
    expect(turn).not.toBeNull()
    expect(turn!.phase).toBe('recommending')
    expect(turn!.search?.flights.length).toBeGreaterThan(0)
    expect(turn!.displayText.toLowerCase()).toMatch(/option|choose|suggest|airline|hotel/)
    expect(turn!.spokenText.split(' ').length).toBeLessThan(40)
  })

  it('planTurn product path returns bilamo meta when enabled', async () => {
    const service = createTravelAgentService({ bilamoIntelligenceEnabled: true })
    const result = await service.planTurn({
      conversationId: 'bilamo-c1',
      messages: [msg('user', 'I want to travel to Japan.')],
    })
    expect(result.meta.kind).toBe('travel_agent')
    expect(result.meta.bilamo?.phase).toBe('collecting')
    expect(result.meta.bilamo?.askedSlot).toBe('dates')
    expect(result.reply.toLowerCase()).toMatch(/when|day/)
  })
})
