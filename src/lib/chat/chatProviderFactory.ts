import type { ChatProvider } from './chatTypes'
import { mockChatProvider } from './mockChatProvider'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'

/**
 * Recovery Phase 1 — ONE conversation system.
 * Product default is always `travel-agent` → `travelAgentService.planTurn`.
 * `conversation-ui` / `chatgpt-experience` remain creatable for quarantined tests only.
 *
 * RC-2: deprecated providers are dynamically imported so the product chat path
 * does not pay their module graph on cold start.
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
    case 'conversation-ui':
      // Sync API retained for tests; loads deprecated provider module on demand via
      // a cached promise kicked by the async helper. First sync call uses deopt path.
      return createDeprecatedChatProviderSync(type)
    case 'travel-agent':
    default:
      return createTravelAgentProvider()
  }
}

/** Preferred for deprecated providers — keeps them out of the travel-agent chunk. */
export async function createChatProviderAsync(
  type: ChatProviderType = getDefaultChatProviderType(),
): Promise<ChatProvider> {
  switch (type) {
    case 'mock':
      return mockChatProvider
    case 'chatgpt-experience': {
      const { createChatGptExperienceProvider } = await import('./chatgptExperience/chatgptChatProvider')
      return createChatGptExperienceProvider()
    }
    case 'conversation-ui': {
      const { createConversationChatProvider } = await import(
        './conversationExperience/conversationChatProvider'
      )
      return createConversationChatProvider()
    }
    case 'travel-agent':
    default:
      return createTravelAgentProvider()
  }
}

function createDeprecatedChatProviderSync(
  type: 'conversation-ui' | 'chatgpt-experience',
): ChatProvider {
  // Lazy-ish: import() is async, so sync callers get a proxy that delays streamReply.
  let resolved: ChatProvider | null = null
  let pending: Promise<ChatProvider> | null = null

  const ensure = (): Promise<ChatProvider> => {
    if (resolved) return Promise.resolve(resolved)
    if (!pending) {
      pending = createChatProviderAsync(type).then((p) => {
        resolved = p
        return p
      })
    }
    return pending
  }

  return {
    providerId: type === 'chatgpt-experience' ? 'chatgpt-experience' : 'conversation-ui',
    async *streamReply(input) {
      const provider = await ensure()
      yield* provider.streamReply(input)
    },
  }
}
