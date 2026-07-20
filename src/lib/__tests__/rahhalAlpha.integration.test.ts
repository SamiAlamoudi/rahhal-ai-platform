/**
 * Rahhal Alpha integration smoke — chat local fallback + journey wiring.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isLocalChatAuthError, localChatStore, clearLocalChatStore } from '../chat/localChatStore'
import { chatService, setChatProviderForTests, resetChatProviderForTests } from '../chat/chatService'
import { AppError } from '../ops/errors/canonicalError'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import type { ChatProvider } from '../chat/chatTypes'

describe('Rahhal Alpha — integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    clearLocalChatStore()
    resetChatProviderForTests()
  })

  afterEach(() => {
    resetFeatureRegistry()
    clearLocalChatStore()
    resetChatProviderForTests()
  })

  it('keeps core Alpha journey flags enabled', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ui.ai_home')).toBe(true)
    expect(registry.isEnabled('ui.conversation_home')).toBe(true)
    expect(registry.isEnabled('ai.booking_intelligence')).toBe(true)
    expect(registry.isEnabled('ai.booking_execution')).toBe(true)
    expect(registry.isEnabled('ai.payments')).toBe(true)
    expect(registry.isEnabled('ai.ticketing')).toBe(true)
  })

  it('detects auth errors for local chat fallback', () => {
    expect(isLocalChatAuthError(new AppError({
      code: 'auth_error',
      message: 'demo',
      userMessage: 'login',
      domain: 'chat.database',
      operation: 'x',
      status: 401,
    }))).toBe(true)
  })

  it('persists conversations locally and streams via provider', async () => {
    const provider: ChatProvider = {
      providerId: 'alpha-test',
      async *streamReply() {
        yield { type: 'delta', text: 'مرحباً ' }
        yield { type: 'delta', text: 'من رحّال' }
        yield {
          type: 'done',
          meta: {
            kind: 'travel_agent',
            version: 2,
            bookingIntelligence: { bookingReady: true },
          },
        }
      },
    }
    setChatProviderForTests(provider)

    const conversation = localChatStore.createConversation('Alpha')
    const chunks: string[] = []
    const { assistant } = await chatService.sendUserMessage(
      conversation.id,
      'أريد السفر إلى المغرب',
      {
        signal: new AbortController().signal,
        onDelta: (m) => chunks.push(m.content),
      },
    )
    expect(assistant.content).toContain('رحّال')
    expect(assistant.status).toBe('complete')
    const listed = await chatService.listConversations()
    expect(listed.some((c) => c.id === conversation.id)).toBe(true)
    const detail = await chatService.getConversationDetail(conversation.id)
    expect(detail.messages.length).toBeGreaterThanOrEqual(2)
  })
})
