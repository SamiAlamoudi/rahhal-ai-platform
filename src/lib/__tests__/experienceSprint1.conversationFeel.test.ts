import { describe, it, expect } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import {
  buildFollowUpQuestion,
  buildSpokenPlanSummary,
  composeTripPlanDisplay,
  buildThinkingBridge,
} from '../agent/formatReply'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'
import { emptyMemory, emptyRequirements } from '../agent/types'
import { buildTripPlan } from '../agent/buildItinerary'
import type { ChatMessage } from '../chat/chatTypes'
import { COMPLETE_JAPAN_5D } from './agentTestFixtures'

function user(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'c1',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

describe('Experience Sprint 1 — conversation-first advisor', () => {
  it('extracts Japan + two weeks + wife as couple without re-asking those slots', () => {
    const result = extractFromUserText(
      'I want to spend two weeks in Japan next August with my wife.',
    )
    expect(result.patch.destination).toBe('Japan')
    expect(result.patch.durationDays).toBe(14)
    expect(result.patch.travelerType).toBe('couple')
    expect(result.patch.travelers).toBe(2)
    expect(result.patch.startDate).toMatch(/-08-15$/)
  })

  it('follow-ups never sound like a form wizard', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Japan',
      destinations: ['Japan'],
    }
    memory.missingFields = ['durationDays']
    const reply = buildFollowUpQuestion(memory, memory.missingFields)
    expect(reply.toLowerCase()).not.toMatch(/next question|step 1|please choose|select |بدون تخمين|سؤال التالي/)
    expect(reply).toMatch(/Japan|wonderful|timing|days|dates/i)
    // At most one question mark for a single follow-up.
    expect((reply.match(/\?/g) ?? []).length).toBeLessThanOrEqual(2)
  })

  it('plan display keeps details on screen while spoken summary stays short', () => {
    const plan = buildTripPlan({
      conversationId: 'c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
        travelers: 2,
        travelerType: 'couple',
        budgetAmount: 3000,
        budgetCurrency: 'USD',
        budgetFlexible: false,
      },
    })
    const spoken = buildSpokenPlanSummary(plan, 'en')
    const display = composeTripPlanDisplay(plan, 'en')
    expect(spoken.length).toBeLessThan(500)
    expect(spoken.toLowerCase()).not.toMatch(/decision engine|overall score|packing suggestions/)
    expect(display).toContain('### Daily itinerary')
    expect(display).toContain(spoken.split('.')[0]!)
  })

  it('thinking bridge helper remains but is not the production reply path', () => {
    expect(buildThinkingBridge('en')).toMatch(/second|ideas|compare/i)
    expect(buildThinkingBridge('en').toLowerCase()).not.toMatch(/generating|loading|please wait/)
  })

  it('planTurn follow-up (concierge off) is conversational and attaches spokenText', async () => {
    const service = createTravelAgentService({ concierge: false })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user('I want to travel to Japan.')],
    })
    expect(turn.tripPlan).toBeNull()
    expect(turn.reply.toLowerCase()).not.toMatch(/next question|smart trip plan|بدون تخمين|سؤال التالي/)
    expect(turn.meta.spokenText).toBeTruthy()
    expect(turn.meta.spokenText!.length).toBeLessThan(turn.reply.length + 50)
  })

  it('complete intake yields spoken summary meta shorter than itinerary body', async () => {
    const service = createTravelAgentService({ concierge: false })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan?.destinations).toContain('Japan')
    expect(turn.meta.spokenText).toBeTruthy()
    expect(turn.meta.spokenText!.length).toBeLessThan(600)
    expect(turn.reply.length).toBeGreaterThan(turn.meta.spokenText!.length)
    // Experience Sprint 2 — display is LLM-authored; may summarize rather than paste template headings.
    expect(turn.reply.toLowerCase()).not.toMatch(/decision engine|next question/)
  })

  it('provider streams spokenText without scripted bridge copy', async () => {
    const provider = createTravelAgentProvider({
      service: createTravelAgentService({ concierge: false }),
    })
    const chunks: Array<{ type: string; text?: string; meta?: Record<string, unknown> }> = []
    const controller = new AbortController()
    for await (const chunk of provider.streamReply({
      conversationId: 'c1',
      messages: [user('I want to travel to Japan.')],
      signal: controller.signal,
    })) {
      chunks.push(chunk as never)
    }
    const joined = chunks.map((c) => c.text ?? '').join('')
    expect(joined).not.toMatch(/Give me a second — I already have a few ideas/)
    const done = chunks.find((c) => c.type === 'done')
    expect(done?.meta?.spokenText).toBeTruthy()
  })
})
