export type {
  VoiceState,
  VoiceMessage,
  VoiceMessageRole,
  VoiceMessageModality,
  VoiceEvent,
  VoiceEventType,
  VoiceEventPriority,
  VoiceTimelineKind,
  VoiceTimelineEntry,
  VoiceSessionSnapshot,
  VoiceSessionTransitionReason,
  VoiceStateTransition,
} from './types'

export {
  canTransition,
  nextVoiceState,
  assertTransition,
  listAllowedReasons,
} from './stateMachine'

export { createVoiceQueue } from './voiceQueue'
export type { VoiceQueue, VoiceQueueItem, VoiceQueueKind } from './voiceQueue'

export { createVoiceTimeline } from './timeline'
export type { VoiceTimeline } from './timeline'

export { createVoiceSession } from './session'
export type { VoiceSession, VoiceSessionOptions } from './session'

export {
  createVoiceProvider,
  resolveVoiceProviderId,
  createMockVoiceProvider,
  createOpenAIRealtimeProvider,
  createAzureRealtimeProvider,
  createElevenLabsProvider,
} from './providers'
export type {
  VoiceProvider,
  VoiceProviderId,
  VoiceTransport,
  VoiceAudio,
  VoiceProviderHandlers,
  VoiceProviderStartOptions,
} from './providers'
