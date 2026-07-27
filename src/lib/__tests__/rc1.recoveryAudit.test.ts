/**
 * RC-1 Release Candidate Audit — Conversation-First gates.
 * Experimental Phase 5–7 modules (llmBrain / agentRuntime / realtimeVoice) were removed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { isConversationIntelligenceEnabled } from '../agent/conversationIntelligence'
import { createVoiceAdapter } from '../premiumExperience'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId = 'rc1-audit'): ChatMessage {
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
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  }
}

describe('RC-1 recovery audit — feature gates', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps conversation intelligence OFF by default (rules soft-enrich only when enabled)', () => {
    const registry = getFeatureRegistry()
    const ids = new Set(registry.list().map((f) => f.id as string))
    expect(ids.has('ai.llm_conversation_brain')).toBe(false)
    expect(ids.has('ai.agent_runtime')).toBe(false)
    expect(ids.has('ai.realtime_voice')).toBe(false)
    expect(isConversationIntelligenceEnabled()).toBe(false)
  })

  it('createVoiceAdapter stays presentation-only (no duplex network)', async () => {
    const adapter = createVoiceAdapter()
    expect(adapter.mock).toBe(true)
    const result = await adapter.connect()
    expect(result.mock).toBe(true)
    expect(result.connected).toBe(true)
    await adapter.disconnect()
  })

  it('planTurn omits removed Phase 5–6 meta', async () => {
    const agent = createTravelAgentService({
      conversationIntelligenceEnabled: false,
    })
    const turn = await agent.planTurn({
      conversationId: 'rc1-audit',
      messages: [msg('أبي رحلة لدبي')],
    })
    expect(turn.meta.conversationIntelligence).toBeUndefined()
    expect(turn.meta.llmBrain).toBeUndefined()
    expect(turn.meta.agentRuntime).toBeUndefined()
  })
})
