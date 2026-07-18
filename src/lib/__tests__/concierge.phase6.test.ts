/**
 * Sprint 9 Phase 6 — wire Concierge into travelAgentService.planTurn.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createTravelAgentService } from '../agent/travelAgentService'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
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

describe('Concierge Phase 6 — planTurn wiring', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('registers ai.concierge and enables it by default', () => {
    const registry = getFeatureRegistry()
    expect(registry.get('ai.concierge')?.lifecycle).toBe('experimental')
    expect(registry.isEnabled('ai.concierge')).toBe(true)
  })

  it('uses consultant voice while collecting requirements', async () => {
    const service = createTravelAgentService()
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user('I want to travel to Japan.')],
    })
    expect(turn.tripPlan).toBeNull()
    expect(turn.reply).toMatch(/consultant|Rahhal|مستشار|رحّال/i)
    expect(turn.reply.toLowerCase()).toMatch(/day|when|مدة|متى/)
    expect(turn.meta.concierge).toBeTruthy()
    expect(turn.meta.concierge?.turnCount).toBeGreaterThan(0)
  })

  it('hands off to agent planning when intake is complete', async () => {
    const service = createTravelAgentService()
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user(COMPLETE_JAPAN_5D)],
    })
    expect(turn.tripPlan?.destinations).toContain('Japan')
    expect(turn.reply).toMatch(/Summary|الملخص|Daily itinerary|برنامج/)
    expect(turn.meta.concierge).toBeTruthy()
  })

  it('can disable Concierge and fall back to classic follow-ups', async () => {
    const service = createTravelAgentService({ concierge: false })
    const turn = await service.planTurn({
      conversationId: 'c1',
      messages: [user('I want to travel to Japan.')],
    })
    expect(turn.tripPlan).toBeNull()
    expect(turn.reply).toMatch(/smart trip plan|خطة سفر ذكية|Next question|سؤال التالي/)
    expect(turn.meta.concierge).toBeUndefined()
  })

  it('persists Concierge state across turns via provider_meta', async () => {
    const service = createTravelAgentService()
    const history: ChatMessage[] = [user('Trip to Bali please')]
    const t1 = await service.planTurn({ conversationId: 'c1', messages: history })
    expect(t1.meta.concierge?.turnCount).toBe(1)
    history.push({
      ...user('a1'),
      id: 'a1',
      role: 'assistant',
      content: t1.reply,
      providerMeta: t1.meta as unknown as Record<string, unknown>,
    })
    history.push(user('5 days, relaxed beach pace'))
    const t2 = await service.planTurn({ conversationId: 'c1', messages: history })
    expect(t2.meta.concierge?.turnCount).toBe(2)
    expect(t2.meta.concierge?.softSignals).toBeTruthy()
  })

  it('concierge public API stays provider-agnostic', async () => {
    const mod = await import('../concierge')
    const keys = Object.keys(mod).join(' ').toLowerCase()
    expect(keys).not.toMatch(/amadeus|duffel|travelport|sabre|expedia|orchestrate/)
    expect(typeof mod.createConciergeService).toBe('function')
    expect(typeof mod.decideConciergeTurn).toBe('function')
  })
})
