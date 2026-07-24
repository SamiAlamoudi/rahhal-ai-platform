/**
 * Quarantined chat providers — Recovery Phase 1.
 * Kept for sprint/regression tests only. Must NOT be statically imported by the
 * default product factory (`chatProviderFactory.ts`) so finance/aiOrchestrator
 * stay out of the default chat chunk graph.
 */
import type { ChatProvider } from './chatTypes'
import { createConversationChatProvider } from './conversationExperience/conversationChatProvider'
import { createChatGptExperienceProvider } from './chatgptExperience/chatgptChatProvider'
import type { ChatProviderType } from './chatProviderFactory'

export function createQuarantinedChatProvider(
  type: Extract<ChatProviderType, 'conversation-ui' | 'chatgpt-experience'>,
): ChatProvider {
  switch (type) {
    case 'chatgpt-experience':
      return createChatGptExperienceProvider()
    case 'conversation-ui':
      return createConversationChatProvider()
  }
}
