/**
 * Conversation-first consultant behavior — one question, no dumps, no «عندي».
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { evaluateConciergeValueOpportunity } from '../concierge/decisionEngine'
import { emptyRequirements, emptyMemory } from '../agent/types'
import { mergeRequirements } from '../agent/memory'
import { shouldShowTravelerResultCards } from '../chat/resultCardGate'
import type { ChatMessage } from '../chat/chatTypes'
import { consultantLine } from '../premiumExperience'

function user(content: string, conversationId = 'cf'): ChatMessage {
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
  memory: ReturnType<typeof emptyMemory>,
  conversationId = 'cf',
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
    providerMeta: {
      kind: 'travel_agent',
      version: 2,
      memory,
      concierge: { phase: 'advising', turnCount: 1 },
    },
    createdAt: now,
    updatedAt: now,
  }
}

describe('Conversation-first — Morocco city wait', () => {
  beforeEach(() => resetFeatureRegistry())

  it('asks one city question and waits (Arabic seed)', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 'cf-ma',
      messages: [user('أريد السفر إلى المغرب مع زوجتي.', 'cf-ma')],
    })
    expect(turn.reply).toMatch(/مدينة|مراكش|أكادير|طنجة|الدار البيضاء/)
    expect(turn.reply).toMatch(/نقطة واحدة|أي مدينة/)
    expect((turn.reply.match(/[?؟]/g) ?? []).length).toBeLessThanOrEqual(2)
    expect(turn.reply).not.toMatch(/عندي/)
    expect(turn.reply).not.toMatch(/طيران|فنادق|مطعم|أنشطة|تقدير أوّلي/)
    expect(turn.tripPlan).toBeFalsy()
  })

  it('after city, asks one style question — still no inventory dump', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const t1 = await service.planTurn({
      conversationId: 'cf-style',
      messages: [user('أريد السفر إلى المغرب مع زوجتي.', 'cf-style')],
    })
    const t2 = await service.planTurn({
      conversationId: 'cf-style',
      messages: [
        user('أريد السفر إلى المغرب مع زوجتي.', 'cf-style'),
        assistant(t1.reply, t1.memory, 'cf-style'),
        user('مراكش', 'cf-style'),
      ],
    })
    expect(t2.memory.requirements.destination?.toLowerCase() || '').toMatch(/marrakech|مراكش|morocco/)
    expect(t2.reply).toMatch(/استرخاء|ثقاف|relax|cultural|ممتاز/i)
    expect(t2.reply).not.toMatch(/عندي/)
    expect(t2.reply).not.toMatch(/تقدير أوّلي|First-pass ranges/)
    expect(t2.tripPlan).toBeFalsy()
  })
})

describe('Conversation-first — language + cards', () => {
  it('never opens city brief with why-dumps', () => {
    const assessment = evaluateConciergeValueOpportunity({
      requirements: mergeRequirements(emptyRequirements(), {
        destination: 'Morocco',
        destinations: ['Morocco'],
      }),
      locale: 'ar',
      userText: 'أريد السفر إلى المغرب مع زوجتي.',
      previous: null,
    })
    expect(assessment.mode).toBe('destination_cities')
    expect(assessment.valueBrief).toEqual(
      expect.arrayContaining(['مراكش', 'أكادير', 'طنجة', 'الدار البيضاء']),
    )
    expect(assessment.valueBrief.every((line) => !line.includes('—'))).toBe(true)
    expect(assessment.framingNote).toMatch(/نقطة واحدة/)
    expect(assessment.preferenceQuestion).toMatch(/أي مدينة/)
  })

  it('hides result cards while concierge is still clarifying', () => {
    const msg = assistant('أي مدينة تفضل؟', emptyMemory('ar'))
    expect(shouldShowTravelerResultCards(msg)).toBe(false)
  })

  it('composer send label is Send — not Start conversation', () => {
    expect(consultantLine('ar', 'startChat')).toBe('أرسل')
    expect(consultantLine('en', 'startChat')).toBe('Send')
  })
})
