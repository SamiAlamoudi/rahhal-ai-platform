/**
 * Phase 7 — Real AI Voice Integration models.
 * Multi-provider realtime voice. Production live sockets disabled by default.
 */

export type RealtimeVoiceProviderId =
  | 'mock'
  | 'openai_realtime'
  | 'gemini_live'
  | 'azure_realtime'
  | 'web_speech'

export type VoiceSessionState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'transcribing'
  | 'reasoning'
  | 'speaking'
  | 'interrupted'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export type AudioTransportState = 'closed' | 'open' | 'degraded'

export interface VoiceConnectionInfo {
  providerId: RealtimeVoiceProviderId
  connected: boolean
  live: boolean
  failoverFrom?: RealtimeVoiceProviderId
  endpointLabel: string
}

export interface PartialTranscript {
  text: string
  final: boolean
  at: string
  locale: 'ar' | 'en'
}

export interface LatencySnapshot {
  sttMs: number
  reasonMs: number
  ttsMs: number
  roundTripMs: number
  samples: number
}

export interface RealtimeMetrics {
  latency: LatencySnapshot
  reconnectCount: number
  droppedPackets: number
  streamingCharsPerSec: number
  providerState: VoiceSessionState
  providerId: RealtimeVoiceProviderId
}

export interface VoiceSessionEvent {
  type:
    | 'state'
    | 'partial_transcript'
    | 'final_transcript'
    | 'assistant_partial'
    | 'assistant_final'
    | 'interrupted'
    | 'reconnected'
    | 'failover'
    | 'metrics'
    | 'error'
  at: string
  detail: string
  meta?: Record<string, unknown>
}

export interface VoiceProviderCapabilities {
  duplex: boolean
  streamingStt: boolean
  streamingTts: boolean
  bargeIn: boolean
}

export interface VoiceProviderConnectOptions {
  conversationId: string
  locale?: 'ar' | 'en'
  /** Never log or persist — read from env by provider. */
  allowLive?: boolean
}

export interface VoiceProviderHandlers {
  onState?: (state: VoiceSessionState) => void
  onPartialTranscript?: (partial: PartialTranscript) => void
  onFinalTranscript?: (text: string) => void
  onAssistantPartial?: (text: string) => void
  onAssistantFinal?: (text: string) => void
  onError?: (message: string) => void
  onDisconnect?: () => void
}

export interface VoiceProvider {
  readonly providerId: RealtimeVoiceProviderId
  readonly displayName: string
  readonly capabilities: VoiceProviderCapabilities
  /** True when provider performs live network I/O. */
  readonly isLive: boolean
  isAvailable(): boolean
  connect(options: VoiceProviderConnectOptions): Promise<VoiceConnectionInfo>
  disconnect(): Promise<void>
  startListening(): Promise<void>
  stopListening(): Promise<void>
  /** Push mic PCM/base64 chunk — mock accepts text via pushText instead. */
  pushAudio?(chunk: ArrayBuffer): Promise<void>
  /** Dev/mock path: inject transcript text incrementally. */
  pushText?(text: string, final?: boolean): Promise<void>
  speak(text: string): Promise<void>
  interrupt(): Promise<void>
  getState(): VoiceSessionState
  setHandlers(handlers: VoiceProviderHandlers): void
}
