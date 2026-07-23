/**
 * UX-01 — optimistic conversation creation.
 * UI selects a usable conversation immediately (<300ms); remote create settles in background.
 * Does not change chat business logic — uses existing local + remote create paths.
 */

import type { ChatConversation } from './chatTypes'
import { chatEngine } from './chatEngine'
import { localChatStore } from './localChatStore'

export type OptimisticCreateResult = {
  /** Immediately usable conversation (local id). */
  conversation: ChatConversation
  /** Resolves to the preferred persisted conversation (remote when available). */
  settle: Promise<ChatConversation>
  /** High-res mark when optimistic row was ready (performance.now()). */
  readyAt: number
}

/**
 * Create a conversation that the UI can select instantly.
 * Background remote create is best-effort; if it fails, local remains valid.
 */
export function createConversationOptimistic(title?: string): OptimisticCreateResult {
  const readyAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const conversation = localChatStore.createConversation(title)

  const settle = (async (): Promise<ChatConversation> => {
    try {
      const remote = await chatEngine.createConversation(title)
      return remote
    } catch {
      return conversation
    }
  })()

  return { conversation, settle, readyAt }
}

/** True when the conversation still has no messages (safe to remap id). */
export function canRemapOptimisticConversation(conversationId: string): boolean {
  try {
    const detail = localChatStore.getConversationDetail(conversationId)
    return detail.messages.length === 0
  } catch {
    return false
  }
}
