export type {
  BilamoSpeakHandle,
  BilamoSpeakRequest,
  BilamoTranscriptEvent,
  BilamoVoiceConnectOptions,
  BilamoVoiceConnectionState,
  BilamoVoiceTransport,
  BilamoVoiceTransportCallbacks,
  BilamoVoiceTransportKind,
  BilamoVoiceTransportMode,
} from './bilamoVoiceTransport'
export { resolveVoiceTransportMode } from './bilamoVoiceTransport'
export { captureMicFromUserGesture, stopMicStream } from './micGestureCapture'

export { createClassicBilamoTransport } from './classicTransport'
export { createRealtimeWebRtcBilamoTransport } from './realtimeWebRtcTransport'
export { createBilamoVoiceTransport } from './createBilamoVoiceTransport'
export type { CreateBilamoVoiceTransportOptions } from './createBilamoVoiceTransport'

export {
  createBilamoVoiceSession,
  obtainSharedBilamoVoiceSession,
  getSharedBilamoVoiceSession,
  resetSharedBilamoVoiceSessionForTests,
  orbStateFromVoiceSession,
} from './bilamoVoiceSession'
export type {
  BilamoVoiceSession,
  BilamoVoiceSessionState,
  BilamoVoiceSessionSnapshot,
  BilamoOrbVoiceState,
  CreateBilamoVoiceSessionOptions,
} from './bilamoVoiceSession'

export { createBilamoVoiceMetrics } from './bilamoVoiceMetrics'
export type {
  BilamoVoiceMetricsSnapshot,
  BilamoVoiceMetricMark,
  BilamoVoiceMetricsReport,
  BilamoVoiceLatencyAggregate,
} from './bilamoVoiceMetrics'
export {
  emptyVoicePlaybackDiagnostics,
  readAudioContextState,
} from './voicePlaybackDiagnostics'
export type {
  VoicePlaybackDiagnostics,
  VoicePlaybackDiagEvent,
} from './voicePlaybackDiagnostics'
export {
  publishBilamoVoiceMetrics,
  readPublishedBilamoVoiceMetrics,
  voiceMetricsEnabled,
} from './bilamoVoiceMetricsReporter'
