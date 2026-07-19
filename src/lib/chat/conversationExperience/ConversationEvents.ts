/**
 * Sprint 32 — ConversationEvents (lightweight pub/sub).
 */

import type { ConversationEvent, ConversationEventType } from './types'

export type ConversationEventListener = (event: ConversationEvent) => void

export class ConversationEvents {
  private readonly listeners = new Map<ConversationEventType | '*', Set<ConversationEventListener>>()

  on(type: ConversationEventType | '*', listener: ConversationEventListener): () => void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
    return () => {
      set.delete(listener)
    }
  }

  emit(event: ConversationEvent): void {
    const specific = this.listeners.get(event.type)
    if (specific) {
      for (const listener of specific) listener(event)
    }
    const all = this.listeners.get('*')
    if (all) {
      for (const listener of all) listener(event)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}

export function createConversationEvent(
  type: ConversationEventType,
  conversationId: string,
  data?: Record<string, unknown>,
): ConversationEvent {
  return {
    type,
    at: new Date().toISOString(),
    conversationId,
    data,
  }
}
