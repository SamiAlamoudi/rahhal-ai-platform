/**
 * RC-1 Release Candidate Audit — recovery stack (PR #256–#262) gates.
 * Asserts experimental Phase 4–7 flags stay OFF and soft-enrich meta is absent when disabled.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { isConversationIntelligenceEnabled } from '../agent/conversationIntelligence'
import { createVoiceAdapter } from '../premiumExperience'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

const RC_EXPERIMENTAL_FLAGS = [
  'ai.conversation_intelligence',
  'ai.llm_conversation_brain',
  'ai.agent_runtime',
  'ai.realtime_voice',
] as const

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

  it('keeps Phase 4–7 experimental flags OFF by default', () => {
    const registry = getFeatureRegistry()
    for (const id of RC_EXPERIMENTAL_FLAGS) {
      expect(registry.isEnabled(id), `${id} must be OFF`).toBe(false)
    }
    expect(isConversationIntelligenceEnabled()).toBe(false)
  })

  it('createVoiceAdapter stays mock / non-network when realtime flag is OFF', async () => {
    const adapter = createVoiceAdapter()
    expect(adapter.mock).toBe(true)
    const result = await adapter.connect()
    expect(result.mock).toBe(true)
    expect(result.connected).toBe(true)
    await adapter.disconnect()
  })

  it('planTurn omits Phase 4–7 meta when flags are OFF', async () => {
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
