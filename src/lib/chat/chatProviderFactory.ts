import type { ChatProvider } from './chatTypes'
import { mockChatProvider } from './mockChatProvider'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'

export type ChatProviderType = 'travel-agent' | 'mock'

export function getDefaultChatProviderType(): ChatProviderType {
  const raw = (import.meta.env.VITE_CHAT_PROVIDER as string | undefined)?.trim().toLowerCase()
  if (raw === 'mock') return 'mock'
  if (raw === 'travel-agent' || !raw) return 'travel-agent'
  // Unknown values fall back to the Travel AI Agent MVP provider.
  return 'travel-agent'
}

export function createChatProvider(type: ChatProviderType = getDefaultChatProviderType()): ChatProvider {
  switch (type) {
    case 'mock':
      return mockChatProvider
    case 'travel-agent':
    default:
      return createTravelAgentProvider()
  }
}
