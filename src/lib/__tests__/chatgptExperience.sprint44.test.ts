import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
} from '../ai'
import {
  isChatGptExperienceEnabled,
  EXPERIENCE_STATE_LABELS,
  readSessionUiRecovery,
  writeSessionUiRecovery,
  togglePinnedConversation,
} from '../chat/chatgptExperience'
import { getDefaultChatProviderType, createChatProvider } from '../chat/chatProviderFactory'

function enableChatGptExperienceChain(): void {
  const registry = getFeatureRegistry()
  for (const id of [
    'brain.enabled',
    'brain.concierge',
    'brain.travel_engine',
    'brain.trip_planning',
    'brain.execution',
    'brain.search',
    'brain.trip_orchestrator',
    'brain.context_memory',
    'brain.unified_travel_planner',
    'brain.conversation_ui',
    'brain.travel_execution_engine',
    'brain.payments_platform',
    'brain.trip_management',
    'ui.conversation_experience',
    'ui.chatgpt_experience',
  ] as const) {
    registry.setEnabled(id, true)
  }
}

describe('Sprint 44 — ChatGPT experience (quarantined remnants)', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('gates ui.chatgpt_experience behind conversation experience', () => {
    expect(isChatGptExperienceEnabled()).toBe(false)
    enableChatGptExperienceChain()
    expect(isChatGptExperienceEnabled()).toBe(true)
    getFeatureRegistry().setEnabled('ui.chatgpt_experience', false)
    expect(isChatGptExperienceEnabled()).toBe(false)
  })

  it('maps chatgpt-experience alias to travel-agent (provider deleted)', () => {
    enableChatGptExperienceChain()
    const provider = createChatProvider('chatgpt-experience')
    expect(provider.providerId).toBe('travel-agent')
    // Product default remains travel-agent (or mock under CI env).
    const def = getDefaultChatProviderType()
    expect(def === 'travel-agent' || def === 'mock').toBe(true)
  })

  it('restores session UI recovery and pinned conversations', () => {
    const storage = (() => {
      const map = new Map<string, string>()
      return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          map.set(k, v)
        },
      }
    })()
    writeSessionUiRecovery(
      {
        conversationId: 'c-restore',
        draft: 'draft text',
        modality: 'voice',
        voiceMode: 'hands_free',
        voiceLocale: 'en',
        pinnedIds: [],
      },
      storage,
    )
    const pinned = togglePinnedConversation('c-restore', storage)
    expect(pinned).toContain('c-restore')
    const recovered = readSessionUiRecovery(storage)
    expect(recovered?.draft).toBe('draft text')
    expect(recovered?.modality).toBe('voice')
    expect(recovered?.voiceMode).toBe('hands_free')
    expect(recovered?.pinnedIds).toContain('c-restore')
  })

  it('exposes experience state labels', () => {
    expect(EXPERIENCE_STATE_LABELS.listening.en).toBe('Listening…')
    expect(EXPERIENCE_STATE_LABELS.thinking.en).toBe('Thinking…')
  })
})
