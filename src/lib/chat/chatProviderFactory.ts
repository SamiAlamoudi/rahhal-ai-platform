import type { ChatProvider } from './chatTypes'
import { mockChatProvider } from './mockChatProvider'
import { createTravelAgentProvider } from '../agent/travelAgentProvider'

/**
 * Recovery Phase 1 — ONE conversation system.
 * Product default is always `travel-agent` → `travelAgentService.planTurn`.
 *
 * Quarantined providers (`conversation-ui` / `chatgpt-experience`) live in
 * `chatProviderFactory.quarantined.ts` so their finance/orchestrator graphs
 * are not pulled into the default chat chunk.
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
      throw new Error(
        `Deprecated chat provider "${type}" is quarantined. `
        + `Use createQuarantinedChatProvider from './chatProviderFactory.quarantined' in tests.`,
      )
    case 'travel-agent':
    default:
      return createTravelAgentProvider()
  }
}
