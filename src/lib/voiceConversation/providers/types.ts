/**
 * Provider / transport / audio abstractions for realtime voice.
 * Sprint 18: interfaces + stubs only — no network, no API keys, no audio output.
 */

import type { VoiceEvent, VoiceState } from '../types'

export type VoiceProviderId =
  | 'mock'
  | 'openai-realtime'
  | 'azure-realtime'
  | 'elevenlabs'

export interface VoiceTransportConnectOptions {
  conversationId: string
  /** Explicitly unused in Sprint 18 — no secrets accepted. */
  apiKey?: never
}

export interface VoiceTransport {
  readonly transportId: string
  connect(options: VoiceTransportConnectOptions): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  send(event: VoiceEvent): Promise<void>
}

export interface VoiceAudioStartOptions {
  conversationId: string
}

/**
 * Audio sink/source port. Sprint 18 stubs must not synthesize or play audio.
 */
export interface VoiceAudio {
  readonly audioId: string
  startCapture?(options: VoiceAudioStartOptions): Promise<void>
  stopCapture?(): Promise<void>
  /** Must remain a no-op until a future sprint enables TTS playback. */
  enqueuePlayback?(chunk: ArrayBuffer): Promise<void>
  stopPlayback?(): Promise<void>
  interruptPlayback?(): Promise<void>
}

export interface VoiceProviderHandlers {
  onStateHint?: (state: VoiceState) => void
  onEvent?: (event: VoiceEvent) => void
  onError?: (message: string) => void
}

export interface VoiceProviderStartOptions {
  conversationId: string
  handlers?: VoiceProviderHandlers
}

export interface VoiceProvider {
  readonly providerId: VoiceProviderId
  readonly displayName: string
  /** When false, provider is a stub and must not perform I/O. */
  readonly isLive: boolean
  getTransport(): VoiceTransport
  getAudio(): VoiceAudio
  startSession(options: VoiceProviderStartOptions): Promise<void>
  stopSession(): Promise<void>
  /**
   * Interrupt assistant output immediately (barge-in).
   * Mock/stub implementations update local state only.
   */
  interrupt(): Promise<void>
}
