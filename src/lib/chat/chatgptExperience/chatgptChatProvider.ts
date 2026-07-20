/**
 * Sprint 44 — ChatProvider wrapping the ChatGPT experience orchestrator.
 */

import type { ChatCompletionRequest, ChatProvider, ChatStreamChunk } from '../chatTypes'
import { isChatGptExperienceEnabled } from './feature'
import { createChatGptExperienceOrchestrator } from './experienceOrchestrator'
import { createConversationChatProvider } from '../conversationExperience/conversationChatProvider'

export function createChatGptExperienceProvider(options?: {
  enabled?: boolean
  fallback?: ChatProvider
}): ChatProvider {
  const fallback = options?.fallback ?? createConversationChatProvider()
  const orchestrator = createChatGptExperienceOrchestrator({
    toolProvider: fallback,
  })

  return {
    providerId: 'chatgpt-experience',

    async *streamReply(input: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
      const on =
        typeof options?.enabled === 'boolean'
          ? options.enabled
          : isChatGptExperienceEnabled()
      if (!on) {
        yield* fallback.streamReply(input)
        return
      }
      yield* orchestrator.streamTurn(input)
    },
  }
}
