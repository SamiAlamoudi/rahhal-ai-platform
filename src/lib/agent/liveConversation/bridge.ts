/**
 * Sprint 98 — Live Conversation Experience agent bridge.
 * Presentation metadata only — no engine calls.
 */

import { isLiveConversationEnabled } from './feature'
import {
  buildLiveConversationSession,
  toLiveConversationResponseMeta,
} from './session'
import { toLiveConversationUiPayload } from './serializers'
import type {
  BuildLiveConversationInput,
  LiveConversationResponseMeta,
  LiveConversationSessionDto,
} from './types'
import { SPRINT98_LIVE_CONVERSATION_VERSION } from './types'
import type { LiveConversationUiPayload } from './serializers'

export { SPRINT98_LIVE_CONVERSATION_VERSION }

export interface AgentLiveConversationRequest extends BuildLiveConversationInput {
  enabled?: boolean
}

export interface AgentLiveConversationResponse {
  enabled: boolean
  session: LiveConversationSessionDto | null
  meta: LiveConversationResponseMeta | null
  ui: LiveConversationUiPayload
}

/**
 * Build streaming-ready live conversation metadata for a turn.
 */
export function runLiveConversationExperience(
  input: AgentLiveConversationRequest = {},
): AgentLiveConversationResponse {
  if (!isLiveConversationEnabled({ enabled: input.enabled })) {
    return {
      enabled: false,
      session: null,
      meta: null,
      ui: toLiveConversationUiPayload({ ...input, enabled: false }),
    }
  }

  const session = buildLiveConversationSession(input)
  return {
    enabled: true,
    session,
    meta: toLiveConversationResponseMeta(session),
    ui: toLiveConversationUiPayload({ ...input, enabled: true }),
  }
}

export function enrichWithLiveConversation(
  input: AgentLiveConversationRequest = {},
): AgentLiveConversationResponse {
  return runLiveConversationExperience(input)
}
