/**
 * Sprint 32 — ChatProvider that uses ConversationController when brain.conversation_ui is on.
 * Falls back to the existing travel-agent provider — additive only.
 */

import type { ChatCompletionRequest, ChatProvider, ChatStreamChunk } from '../chatTypes'
import { createTravelAgentProvider } from '../../agent/travelAgentProvider'
import {
  ConversationController,
  type ConversationControllerHandle,
} from './ConversationController'
import { isConversationUiEnabled } from './feature'

export type CreateConversationChatProviderOptions = {
  controller?: ConversationControllerHandle
  /** Force conversation UI path on/off for tests. */
  conversationUiEnabled?: boolean
  /** Fallback provider when conversation UI is off. */
  fallback?: ChatProvider
}

export function createConversationChatProvider(
  options: CreateConversationChatProviderOptions = {},
): ChatProvider {
  const fallback = options.fallback ?? createTravelAgentProvider()
  const controller =
    options.controller
    ?? ConversationController({
      enabled: options.conversationUiEnabled,
      skipPlannerOrchestrator: true,
      plannerOptions: {
        enabled: true,
        skipOrchestrator: true,
      },
    })

  return {
    providerId: 'conversation-ui',

    async *streamReply(input: ChatCompletionRequest): AsyncIterable<ChatStreamChunk> {
      const uiOn =
        typeof options.conversationUiEnabled === 'boolean'
          ? options.conversationUiEnabled
          : isConversationUiEnabled()

      if (!uiOn) {
        yield* fallback.streamReply(input)
        return
      }

      const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')
      const userText = lastUser?.content?.trim() || ''
      if (!userText) {
        yield { type: 'error', error: 'empty_user_message' }
        return
      }

      yield* controller.streamTurn({
        conversationId: input.conversationId,
        userText,
        locale: 'en',
        signal: input.signal,
      })
    },
  }
}
