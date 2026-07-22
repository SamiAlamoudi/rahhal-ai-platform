/**
 * Sprint 98 — serializers for live conversation UI metadata.
 */

import {
  buildLiveConversationSession,
  toLiveConversationResponseMeta,
} from './session'
import type {
  BuildLiveConversationInput,
  LiveConversationResponseMeta,
  LiveConversationSessionDto,
  StreamingChunkDto,
  TypingMetadataDto,
  ConversationTimelineDto,
} from './types'
import { SPRINT98_LIVE_CONVERSATION_VERSION } from './types'

export interface LiveConversationUiPayload {
  enabled: boolean
  version: string
  session: LiveConversationSessionDto | null
  meta: LiveConversationResponseMeta | null
  timeline: ConversationTimelineDto | null
  chunks: StreamingChunkDto[]
  typing: TypingMetadataDto | null
}

export function serializeLiveConversationSession(
  session: LiveConversationSessionDto,
): LiveConversationUiPayload {
  return {
    enabled: true,
    version: session.version,
    session,
    meta: toLiveConversationResponseMeta(session),
    timeline: session.timeline,
    chunks: [...session.chunks],
    typing: { ...session.typing },
  }
}

export function toLiveConversationUiPayload(
  input: BuildLiveConversationInput & { enabled?: boolean },
): LiveConversationUiPayload {
  if (input.enabled === false) {
    return {
      enabled: false,
      version: SPRINT98_LIVE_CONVERSATION_VERSION,
      session: null,
      meta: null,
      timeline: null,
      chunks: [],
      typing: null,
    }
  }
  const session = buildLiveConversationSession(input)
  return serializeLiveConversationSession(session)
}

/** Attachable AgentProviderMeta slice. */
export function toAgentLiveConversationMeta(
  session: LiveConversationSessionDto | null,
  enabled: boolean,
): LiveConversationResponseMeta | null {
  if (!enabled || !session) return null
  return toLiveConversationResponseMeta(session)
}
