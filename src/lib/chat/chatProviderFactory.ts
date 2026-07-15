import type { ChatProvider } from './chatTypes'
import { mockChatProvider } from './mockChatProvider'

export type ChatProviderType = 'mock'

export function getDefaultChatProviderType(): ChatProviderType {
  const raw = (import.meta.env.VITE_CHAT_PROVIDER as string | undefined)?.trim().toLowerCase()
  if (raw === 'mock' || !raw) return 'mock'
  // Future providers (openai, etc.) plug in here without changing chatService.
  return 'mock'
}

export function createChatProvider(type: ChatProviderType = getDefaultChatProviderType()): ChatProvider {
  switch (type) {
    case 'mock':
    default:
      return mockChatProvider
  }
}
