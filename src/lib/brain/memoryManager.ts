import { ConversationMemoryApi } from './conversationMemory'
import type { BrainMemorySlot, ConversationMemory } from './types'

/**
 * MemoryManager — apply extractions patches and track asked slots.
 */
export function MemoryManager(initial: ConversationMemory) {
  let memory = ConversationMemoryApi.clone(initial)

  return {
    get(): ConversationMemory {
      return ConversationMemoryApi.clone(memory)
    },

    replace(next: ConversationMemory) {
      memory = ConversationMemoryApi.clone(next)
    },

    updateFromExtraction(patch: Partial<ConversationMemory>) {
      memory = ConversationMemoryApi.applyPatch(memory, patch)
      return ConversationMemoryApi.clone(memory)
    },

    markAsked(fields: BrainMemorySlot[]) {
      memory = ConversationMemoryApi.markAsked(memory, fields)
      return ConversationMemoryApi.clone(memory)
    },
  }
}

export type MemoryManagerHandle = ReturnType<typeof MemoryManager>
