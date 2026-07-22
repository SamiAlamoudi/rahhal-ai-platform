/**
 * Sprint 98 — Live Conversation Experience (agent barrel).
 */

export {
  LIVE_CONVERSATION_FEATURE_ID,
  isLiveConversationEnabled,
} from './feature'

export {
  SPRINT98_LIVE_CONVERSATION_VERSION,
  LIVE_CONVERSATION_STAGE_ORDER,
  LIVE_CONVERSATION_STAGE_LABELS,
  LIVE_CONVERSATION_STREAM_CHUNKS,
  type LiveConversationSessionState,
  type ConversationStatus,
  type ConversationPhase,
  type ConversationTimelineDto,
  type StreamingChunkDto,
  type TypingMetadataDto,
  type ConversationProgressEvent,
  type LiveConversationSessionDto,
  type LiveConversationResponseMeta,
  type BuildLiveConversationInput,
} from './types'

export {
  buildConversationTimeline,
  buildStreamingChunks,
  buildTypingMetadata,
  createProgressEvent,
  buildLiveConversationSession,
  toLiveConversationResponseMeta,
  emptyLiveConversationSession,
} from './session'

export {
  serializeLiveConversationSession,
  toLiveConversationUiPayload,
  toAgentLiveConversationMeta,
  type LiveConversationUiPayload,
} from './serializers'

export {
  runLiveConversationExperience,
  enrichWithLiveConversation,
  type AgentLiveConversationRequest,
  type AgentLiveConversationResponse,
} from './bridge'
