/**
 * Bilamo voice transport contract.
 *
 * Classic path today: one-shot TTS after a completed turn (no auto-relisten).
 * Future realtime WebRTC should implement the same surface so the conversation
 * experience can swap transports without rewriting orb / mic lifecycle.
 */

import type { VoiceLocale } from '../../chat/voice/voiceTypes'

export type BilamoVoiceTransportKind = 'classic_tts' | 'realtime_webrtc'

export interface BilamoSpeakRequest {
  text: string
  locale: VoiceLocale
}

export interface BilamoSpeakHandle {
  /** Monotonic generation — callers must ignore stale completions. */
  generation: number
  done: Promise<void>
}

/**
 * Minimal transport API shared by classic TTS and (future) realtime WebRTC.
 * Contracts:
 * - stop() is synchronous and cancels in-flight audio
 * - speak() always interrupts prior playback
 * - no transport may auto-reopen the microphone after a reply
 */
export interface BilamoVoiceTransport {
  readonly kind: BilamoVoiceTransportKind
  speak(request: BilamoSpeakRequest): BilamoSpeakHandle
  stop(): void
  isSpeaking(): boolean
}
