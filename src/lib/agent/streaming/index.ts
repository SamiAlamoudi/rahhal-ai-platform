/**
 * Sprint 116 — AI Streaming Conversation Experience barrel.
 */

export {
  STREAMING_CONVERSATION_FEATURE_ID,
  isStreamingConversationEnabled,
} from './feature'

export {
  SPRINT116_STREAMING_CONVERSATION_VERSION,
  STREAMING_STAGE_DEFINITIONS,
  getStreamingStageDefinition,
  streamingStageOrder,
  remainingStagesAfter,
  type StreamingStageId,
  type StreamingStageDefinition,
} from './StreamingStage'

export {
  STREAMING_PROGRESS_STEPS,
  normalizeProgress,
  type StreamingEventKind,
  type StreamingStageStatus,
  type StreamingProgressPercent,
} from './StreamingStatus'

export {
  createStreamingEvent,
  StreamingEventBus,
  createStreamingEventBus,
  type StreamingEvent,
  type StreamingEventListener,
} from './StreamingEvents'

export {
  StreamingTimeline,
  createStreamingTimeline,
  timelineFromEvents,
  type StreamingTimelineEntry,
} from './StreamingTimeline'

export {
  StreamingProgressTracker,
  createStreamingProgressTracker,
  type StreamingProgressSnapshot,
} from './StreamingProgress'

export {
  collectStreamingMetrics,
  emptyStreamingMetrics,
  StreamingMetricsCollector,
  createStreamingMetricsCollector,
  type StreamingMetrics,
} from './StreamingMetrics'

export {
  renderStreamingEvent,
  renderStreamingTranscript,
  StreamingRenderer,
  createStreamingRenderer,
} from './StreamingRenderer'

export {
  wrapAdaptersWithStreaming,
  StreamingRunner,
  createStreamingRunner,
  type StreamingRunnerOptions,
} from './StreamingRunner'

export {
  StreamingConversation,
  createStreamingConversation,
  runStreamingConversation,
  type StreamingConversationInput,
  type StreamingConversationResult,
  type StreamingConversationOptions,
} from './StreamingConversation'
