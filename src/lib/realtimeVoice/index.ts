/**
 * Phase 7 — Real AI Voice Integration
 * Multi-provider realtime voice + Agent Runtime incremental reasoning.
 */

export type {
  AudioTransportState,
  LatencySnapshot,
  PartialTranscript,
  RealtimeMetrics,
  RealtimeVoiceProviderId,
  VoiceConnectionInfo,
  VoiceProvider,
  VoiceProviderCapabilities,
  VoiceProviderConnectOptions,
  VoiceProviderHandlers,
  VoiceSessionEvent,
  VoiceSessionState,
} from './types'

export {
  REALTIME_VOICE_FEATURE_ID,
  isRealtimeVoiceEnabled,
  isVoiceLiveNetworkAllowed,
} from './feature'

export { AudioTransport } from './audioTransport'
export { LatencyMonitor } from './latencyMonitor'
export { ReconnectManager } from './reconnectManager'
export { VoiceState, canTransition, transitionVoiceState } from './voiceState'
export { VoiceConnection } from './voiceConnection'
export { RealtimeSession, type RealtimeSessionOptions } from './realtimeSession'
export { VoiceSession, createVoiceSession } from './voiceSession'

export { createMockProvider, MockProvider } from './providers/mockProvider'
export { createWebSpeechProvider, WebSpeechProvider } from './providers/webSpeechProvider'
export {
  createOpenAIRealtimeProvider,
  OpenAIRealtimeProvider,
  isOpenAiRealtimeClientEnabled,
  type OpenAiRealtimeProviderDeps,
} from './providers/openaiRealtimeProvider'
export {
  MOCK_TRAVEL_TOOLS,
  buildSessionUpdateEvent,
  mapToolNameToDecision,
} from './providers/openaiRealtimeProtocol'
export { buildTravelConsultantInstructions } from './travelConsultantPrompt'

export const INTEGRATION_OPENAI_REALTIME_VERSION = 'integration-openai-realtime-v1' as const
export { createGeminiLiveProvider, GeminiLiveProvider } from './providers/geminiLiveProvider'
export { createAzureRealtimeProvider, AzureRealtimeProvider } from './providers/azureRealtimeProvider'
export {
  createVoiceProvider,
  connectWithFailover,
  resolvePreferredProviderId,
  FAILOVER_CHAIN,
} from './providers/factory'

export const PHASE7_REALTIME_VOICE_VERSION = 'phase7-realtime-voice-v1' as const
