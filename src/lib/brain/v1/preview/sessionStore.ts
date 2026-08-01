/**
 * Sprint 86 — persist Brain ConversationManager session across planTurn calls.
 * Stored on assistant providerMeta (no UI / no DB changes).
 */

import type { ChatMessage } from '../../../chat/chatTypes'
import type { AgentProviderMeta } from '../../../agent/types'
import type { ConversationSession } from '../conversation/types'

export function extractBrainPreviewSession(
  messages: ChatMessage[],
): ConversationSession | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (!msg || msg.role !== 'assistant') continue
    const meta = msg.providerMeta as unknown as AgentProviderMeta | null | undefined
    const session = meta?.brainV1Preview?.session as ConversationSession | null | undefined
    if (session && typeof session === 'object' && typeof session.sessionId === 'string') {
      return session
    }
  }
  return null
}
