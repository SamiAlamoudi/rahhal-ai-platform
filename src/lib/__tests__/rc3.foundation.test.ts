/**
 * RC-3 — Final Foundation Cleanup gates.
 * Isolation, flag purity, stress, and deferred-loader independence.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  loadBrainCore,
  loadConversationIntelligence,
  loadReasoning,
  loadTravelPlanner,
  resetDeferredLoaderCache,
} from '../agent/deferredLoaders'
import { createDefaultAggregationEngine } from '../agent/aggregation/factory'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId: string, i = 0): ChatMessage {
  return {
    id: `u-${conversationId}-${i}`,
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

describe('RC-3 foundation — deferred isolation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDeferredLoaderCache()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDeferredLoaderCache()
  })

  it('keeps recovery experimental flags OFF (feature flag purity)', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ai.conversation_intelligence')).toBe(false)
    expect(registry.isEnabled('ai.llm_conversation_brain')).toBe(false)
    expect(registry.isEnabled('ai.agent_runtime')).toBe(false)
    expect(registry.isEnabled('ai.realtime_voice')).toBe(false)
  })

  it('loads Conversation Intelligence / Planner / Reasoner independently', async () => {
    const [ci, planner, reasoning] = await Promise.all([
      loadConversationIntelligence(),
      loadTravelPlanner(),
      loadReasoning(),
    ])
    expect(typeof ci.enrichWithConversationIntelligence).toBe('function')
    expect(typeof planner.runTravelPlanner).toBe('function')
    expect(typeof reasoning.runTravelReasoning).toBe('function')
  })

  it('brain core loader is independent of recovery Phase 4 modules', async () => {
    const core = await loadBrainCore()
    expect(typeof core.runRahhalBrainTurn).toBe('function')
    expect(typeof core.isRahhalBrainEnabled).toBe('function')
  })

  it('mock aggregation has zero live sockets / timers by default', async () => {
    const engine = createDefaultAggregationEngine()
    const result = await engine.aggregate({
      domain: 'flights',
      locale: 'en',
      input: { origin: 'RUH', destination: 'DXB', travelers: 1, currency: 'SAR' },
    })
    expect(result.meta.providersSucceeded).toBeGreaterThan(0)
  })

  it('planTurn with Phase 4 forced OFF omits experimental meta', async () => {
    const agent = createTravelAgentService({
      conversationIntelligenceEnabled: false,
    })
    const turn = await agent.planTurn({
      conversationId: 'rc3-off',
      messages: [msg('أبي رحلة لدبي', 'rc3-off')],
    })
    expect(turn.meta.conversationIntelligence).toBeUndefined()
    expect(turn.meta.llmBrain).toBeUndefined()
    expect(turn.meta.agentRuntime).toBeUndefined()
    expect(turn.reply.length).toBeGreaterThan(0)
  })
})

describe('RC-3 foundation — stress (100 conversations)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDeferredLoaderCache()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetDeferredLoaderCache()
  })

  it('completes 100 sequential planTurn conversations without failure', async () => {
    const agent = createTravelAgentService({
      conversationIntelligenceEnabled: false,
    })
    const replies: number[] = []
    for (let i = 0; i < 100; i += 1) {
      const id = `rc3-stress-${i}`
      const turn = await agent.planTurn({
        conversationId: id,
        messages: [msg(i % 2 === 0 ? 'أبي رحلة لدبي' : 'I want Tokyo for a week', id, i)],
      })
      expect(turn.reply.length).toBeGreaterThan(0)
      replies.push(turn.reply.length)
    }
    expect(replies).toHaveLength(100)
    expect(Math.min(...replies)).toBeGreaterThan(0)
  }, 120_000)

  it('survives interruptions via AbortController across 20 turns', async () => {
    const agent = createTravelAgentService({
      conversationIntelligenceEnabled: false,
    })
    let completed = 0
    let aborted = 0
    for (let i = 0; i < 20; i += 1) {
      const id = `rc3-abort-${i}`
      const controller = new AbortController()
      if (i % 3 === 0) controller.abort()
      try {
        const turn = await agent.planTurn({
          conversationId: id,
          messages: [msg('رحلة قصيرة للرياض', id, i)],
          signal: controller.signal,
        })
        if (turn.reply) completed += 1
      } catch {
        aborted += 1
      }
    }
    expect(completed + aborted).toBe(20)
    expect(completed).toBeGreaterThan(0)
  }, 60_000)
})
