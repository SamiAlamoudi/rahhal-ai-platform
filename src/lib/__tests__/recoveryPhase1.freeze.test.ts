import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { getDefaultChatProviderType, createChatProvider } from '../chat/chatProviderFactory'
import {
  RECOVERY_CHAT_UI,
  RECOVERY_CONVERSATION,
  RECOVERY_CONVERSATION_STORE,
  RECOVERY_FROZEN_OFF_FLAGS,
  RECOVERY_MEMORY,
  RECOVERY_PAYMENT,
  RECOVERY_TURN_OWNER,
  RECOVERY_VOICE_INTERRUPT_RESPONSE,
  RECOVERY_VOICE_MIC_AFTER_REPLY,
} from '../recovery/freeze'
import { buildRealtimeTurnDetection } from '../chat/voice/realtimeTurnConfig'

describe('Recovery Phase 1 freeze', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  it('documents a single product spine', () => {
    expect(RECOVERY_CONVERSATION).toContain('travel-agent')
    expect(RECOVERY_TURN_OWNER).toBe('travelAgentService.planTurn')
    expect(RECOVERY_CHAT_UI).toBe('BilamoChat')
    expect(RECOVERY_PAYMENT).toBe('lib/payment')
    expect(RECOVERY_CONVERSATION_STORE).toContain('chatService')
    expect(RECOVERY_MEMORY).toContain('agent/memory.ts')
  })

  it('defaults chat provider to travel-agent (mock only in vitest env)', () => {
    // vitest.config sets VITE_CHAT_PROVIDER=mock
    expect(getDefaultChatProviderType()).toBe('mock')
    expect(createChatProvider('travel-agent').providerId).toBe('travel-agent')
  })

  it('keeps frozen-off flags disabled by default', () => {
    const registry = getFeatureRegistry()
    for (const id of RECOVERY_FROZEN_OFF_FLAGS) {
      const def = registry.get(id as never)
      if (!def) continue
      expect(def.enabled, id).toBe(false)
      expect(registry.isEnabled(id as never), id).toBe(false)
    }
  })

  it('marks key parallel stacks deprecated', () => {
    const registry = getFeatureRegistry()
    for (const id of [
      'ui.production_integration',
      'ui.chatgpt_experience',
      'brain.conversation_ui',
      'brain.ai_orchestrator',
      'brain.payments_platform',
      'ai.memory_engine',
      'ai.orchestrator',
      'ai.execution_pipeline',
    ] as const) {
      expect(registry.get(id)?.lifecycle).toBe('deprecated')
    }
  })

  it('freezes post-#311 voice mic / barge-in contracts (Sprint 80 P1-7)', () => {
    expect(RECOVERY_VOICE_MIC_AFTER_REPLY).toBe('idle')
    expect(RECOVERY_VOICE_INTERRUPT_RESPONSE).toBe(false)
    expect(buildRealtimeTurnDetection().interrupt_response).toBe(RECOVERY_VOICE_INTERRUPT_RESPONSE)
  })
})
