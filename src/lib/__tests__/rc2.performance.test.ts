/**
 * RC-2 — Performance Excellence gate tests.
 * Ensures lazy agent facade + experimental flags remain OFF (no feature changes).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createDefaultAggregationEngine } from '../agent/aggregation/factory'
import { createChatProvider, getDefaultChatProviderType } from '../chat/chatProviderFactory'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId = 'rc2-perf'): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 7)}`,
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
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
  }
}

describe('RC-2 performance gates', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps recovery experimental flags OFF', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ai.conversation_intelligence')).toBe(false)
    expect(registry.isEnabled('ai.llm_conversation_brain')).toBe(false)
    expect(registry.isEnabled('ai.agent_runtime')).toBe(false)
    expect(registry.isEnabled('ai.realtime_voice')).toBe(false)
  })

  it('creates travel-agent provider when explicitly requested', () => {
    // CI may set VITE_CHAT_PROVIDER=mock; product path remains travel-agent.
    expect(createChatProvider('travel-agent').providerId).toBe('travel-agent')
    const def = getDefaultChatProviderType()
    expect(def === 'travel-agent' || def === 'mock').toBe(true)
  })

  it('default aggregation engine is mock-backed without requiring live adapters', async () => {
    const engine = createDefaultAggregationEngine()
    const flights = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'DXB', travelers: 1, currency: 'SAR' },
    })
    expect(flights.meta.providersSucceeded).toBeGreaterThan(0)
  })

  it('lazy travelAgentService facade still plans turns', async () => {
    const agent = createTravelAgentService({
      conversationIntelligenceEnabled: false,
    })
    const turn = await agent.planTurn({
      conversationId: 'rc2-perf',
      messages: [msg('أبي رحلة لدبي')],
    })
    expect(turn.reply.length).toBeGreaterThan(0)
    expect(turn.meta.conversationIntelligence).toBeUndefined()
    expect(turn.meta.llmBrain).toBeUndefined()
    expect(turn.meta.agentRuntime).toBeUndefined()
  })
})
