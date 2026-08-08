/**
 * Bilamo voice transport contract — single abstraction for classic + realtime.
 *
 * UI and VoiceSession must not import WebRTC APIs directly.
 * Classic TTS remains a production-safe fallback.
 */

import type { VoiceLocale } from '../../chat/voice/voiceTypes'

export type BilamoVoiceTransportKind = 'classic_tts' | 'realtime_webrtc'

/** Canonical transport / session connection lifecycle. */
export type BilamoVoiceConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export type BilamoVoiceTransportMode = 'realtime' | 'classic' | 'auto'

export interface BilamoSpeakRequest {
  text: string
  locale: VoiceLocale
}

export interface BilamoSpeakHandle {
  /** Monotonic generation — callers must ignore stale completions. */
  generation: number
  done: Promise<void>
}

export interface BilamoTranscriptEvent {
  text: string
  isFinal: boolean
  /** Parser-only enrichment (Arabic ASR normalize). Never rewrite display. */
  normalizedForExtract?: string
  locale?: VoiceLocale
  /** Pre-normalize ASR text (diagnostics). */
  rawText?: string
}

export interface BilamoVoiceTransportCallbacks {
  onPartialTranscript?: (event: BilamoTranscriptEvent) => void
  onFinalTranscript?: (event: BilamoTranscriptEvent) => void
  onAudioChunk?: (info: { bytes?: number; generation: number }) => void
  onSpeakingStart?: (generation: number) => void
  onSpeakingEnd?: (generation: number) => void
  onConnectionStateChange?: (state: BilamoVoiceConnectionState) => void
  onError?: (message: string, detail?: { code?: string; recoverable?: boolean }) => void
  onListeningChange?: (listening: boolean) => void
  /** Silent / missing remote audio — session may fall back to classic for this turn. */
  onSilentPlayback?: (detail: { generation: number; code: string }) => void
}

/**
 * Full duplex-capable transport surface.
 * Contracts:
 * - interrupt() / stop() cancel in-flight audio synchronously
 * - no transport may auto-reopen the microphone after a reply completes
 * - barge-in is user-intent (orb/mic) → interrupt + startListening
 */
export interface BilamoVoiceTransport {
  readonly kind: BilamoVoiceTransportKind
  setCallbacks(callbacks: BilamoVoiceTransportCallbacks): void
  connect(): Promise<void>
  disconnect(): void
  startListening(locale?: VoiceLocale): Promise<boolean>
  /**
   * End listening and finalize the current utterance once (silence / user stop).
   * Must emit at most one final transcript. Must NOT auto-relisten.
   */
  stopListening(): void
  /**
   * Silence / end-of-speech finalize — prefer commit over cancel for realtime.
   * Classic may alias stopListening. Default: stopListening.
   */
  finalizeListening?(): void
  /**
   * Soft-cancel listening without emitting a final transcript.
   * Used when typed send must not spawn a parallel voice turn.
   */
  cancelListening?(): void
  /** Optional raw PCM / blob path — classic may no-op. */
  sendAudio?(chunk: ArrayBuffer): void
  speak(request: BilamoSpeakRequest): BilamoSpeakHandle
  interrupt(): void
  /** Alias for interrupt — cancels playback without auto-relisten. */
  stop(): void
  isSpeaking(): boolean
  isListening(): boolean
  isConnected(): boolean
  getConnectionState(): BilamoVoiceConnectionState
  /** Optional Safari/WebRTC playback diagnostics (no secrets / transcripts). */
  getPlaybackDiagnostics?(): import('./voicePlaybackDiagnostics').VoicePlaybackDiagnostics
  dispose(): void
}

export function resolveVoiceTransportMode(
  envValue: string | null | undefined,
): BilamoVoiceTransportMode {
  const raw = (envValue || '').trim().toLowerCase()
  if (raw === 'classic' || raw === 'tts' || raw === 'classic_tts') return 'classic'
  if (raw === 'realtime' || raw === 'webrtc' || raw === 'realtime_webrtc') return 'realtime'
  if (raw === 'auto') return 'auto'
  return 'auto'
}
