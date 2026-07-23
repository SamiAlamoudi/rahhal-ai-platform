import type { ChatProvider } from './chatTypes'
import { mockChatProvider } from './mockChatProvider'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'
import { createConversationChatProvider } from './conversationExperience/conversationChatProvider'
import { createChatGptExperienceProvider } from './chatgptExperience/chatgptChatProvider'

/**
 * Recovery Phase 1 — ONE conversation system.
 * Product default is always `travel-agent` → `travelAgentService.planTurn`.
 * `conversation-ui` / `chatgpt-experience` remain creatable for quarantined tests only.
 */
export type ChatProviderType = 'travel-agent' | 'mock' | 'conversation-ui' | 'chatgpt-experience'

export function getDefaultChatProviderType(): ChatProviderType {
  const raw = (import.meta.env.VITE_CHAT_PROVIDER as string | undefined)?.trim().toLowerCase()
  if (raw === 'mock') return 'mock'
  // Recovery Phase 1: ignore env overrides that select deprecated providers.
  // travel-agent (or unset / unknown) is the only product path.
  return 'travel-agent'
}

export function createChatProvider(type: ChatProviderType = getDefaultChatProviderType()): ChatProvider {
  switch (type) {
    case 'mock':
      return mockChatProvider
    case 'chatgpt-experience':
      // @deprecated Recovery Phase 1 — disconnected from default selection.
      return createChatGptExperienceProvider()
    case 'conversation-ui':
      // @deprecated Recovery Phase 1 — disconnected from default selection.
      return createConversationChatProvider()
    case 'travel-agent':
    default:
      return createTravelAgentProvider()
  }
}
