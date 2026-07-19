import type { ChatProvider } from './chatTypes'
import { mockChatProvider } from './mockChatProvider'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'
import { createConversationChatProvider } from './conversationExperience/conversationChatProvider'
import { isConversationUiEnabled } from './conversationExperience/feature'

export type ChatProviderType = 'travel-agent' | 'mock' | 'conversation-ui'

export function getDefaultChatProviderType(): ChatProviderType {
  const raw = (import.meta.env.VITE_CHAT_PROVIDER as string | undefined)?.trim().toLowerCase()
  if (raw === 'mock') return 'mock'
  if (raw === 'conversation-ui') return 'conversation-ui'
  if (raw === 'travel-agent' || !raw) {
    // When Sprint 32 flag is on, prefer conversation UI over legacy travel-agent path.
    if (isConversationUiEnabled()) return 'conversation-ui'
    return 'travel-agent'
  }
  // Unknown values fall back to the Travel AI Agent MVP provider.
  return 'travel-agent'
}

export function createChatProvider(type: ChatProviderType = getDefaultChatProviderType()): ChatProvider {
  switch (type) {
    case 'mock':
      return mockChatProvider
    case 'conversation-ui':
      return createConversationChatProvider()
    case 'travel-agent':
    default:
      return createTravelAgentProvider()
  }
}
