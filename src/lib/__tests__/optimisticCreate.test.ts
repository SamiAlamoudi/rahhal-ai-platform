import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  canRemapOptimisticConversation,
  createConversationOptimistic,
} from '../chat/optimisticCreate'
import { clearLocalChatStore, localChatStore } from '../chat/localChatStore'
import { chatEngine } from '../chat/chatEngine'

describe('createConversationOptimistic', () => {
  beforeEach(() => {
    clearLocalChatStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    clearLocalChatStore()
  })

  it('returns a usable conversation synchronously (<300ms path)', async () => {
    const remote = {
      id: 'remote-1',
      title: 'محادثة جديدة',
      modalityDefault: 'text' as const,
      travelSessionId: null,
      lastMessagePreview: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    vi.spyOn(chatEngine, 'createConversation').mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(remote), 80)),
    )

    const started = performance.now()
    const { conversation, settle, readyAt } = createConversationOptimistic()
    const uiMs = performance.now() - started

    expect(uiMs).toBeLessThan(300)
    expect(conversation.id.startsWith('lconv')).toBe(true)
    expect(localChatStore.listConversations()).toHaveLength(1)
    expect(readyAt).toBeGreaterThan(0)

    const settled = await settle
    expect(settled.id).toBe('remote-1')
  })

  it('falls back to local conversation when remote create fails', async () => {
    vi.spyOn(chatEngine, 'createConversation').mockRejectedValue(new Error('network'))
    const { conversation, settle } = createConversationOptimistic()
    const settled = await settle
    expect(settled.id).toBe(conversation.id)
  })

  it('canRemapOptimisticConversation is true only while empty', () => {
    const c = localChatStore.createConversation()
    expect(canRemapOptimisticConversation(c.id)).toBe(true)
    localChatStore.appendMessage({
      conversationId: c.id,
      role: 'user',
      content: 'مرحبا',
    })
    expect(canRemapOptimisticConversation(c.id)).toBe(false)
  })
})
