/**
 * Recovery Phase 2.3 — single authoritative VoiceSessionManager.
 *
 * Owns session lifecycle for continuous conversation. Wraps createVoiceSession
 * so there is one recognition instance, one timer owner, and one state machine.
 *
 * State flow (real TTS):
 *   IDLE → LISTENING → PROCESSING → SPEAKING → READY → LISTENING
 *
 * State flow (TTS unavailable / mock):
 *   IDLE → LISTENING → PROCESSING → READY → LISTENING
 *
 * Explicit stop or inactivity → ENDED (no automatic restart).
 */

import {
  createVoiceSession,
  type CreateVoiceSessionOptions,
  type VoiceSession,
  type VoiceSessionCallbacks,
} from './voiceSession'
import {
  VOICE_UX_LABELS_AR,
  type VoiceSessionStatus,
} from './voiceTypes'
import { isBrowserSpeechRecognitionAvailable } from './voiceProviderFactory'

export type VoiceManagerState = VoiceSessionStatus

export interface VoiceSessionManager extends VoiceSession {
  /** Arabic UX label for the current authoritative state. */
  getUxLabelAr: () => string
  /** Whether the browser can run SpeechRecognition. */
  isSpeechRecognitionSupported: () => boolean
  /** Start continuous conversation (one mic tap). */
  start: (conversationId: string) => Promise<void>
  /** Stop continuous conversation explicitly. */
  stop: () => Promise<void>
}

export interface CreateVoiceSessionManagerOptions extends CreateVoiceSessionOptions {
  callbacks?: VoiceSessionCallbacks
}

let activeManager: VoiceSessionManager | null = null

/**
 * Create the sole voice session manager for the page.
 * Disposes any previous manager to prevent concurrent recognition sessions.
 */
export function createVoiceSessionManager(
  options: CreateVoiceSessionManagerOptions = {},
): VoiceSessionManager {
  activeManager?.dispose()
  activeManager = null

  const session = createVoiceSession({
    ...options,
    mode: options.mode ?? 'hands_free',
  })

  const manager: VoiceSessionManager = {
    ...session,
    getUxLabelAr: () => VOICE_UX_LABELS_AR[session.getStatus()] ?? 'جاهز',
    isSpeechRecognitionSupported: () => isBrowserSpeechRecognitionAvailable(),
    start: (conversationId) => session.startContinuous(conversationId),
    stop: () => session.stopSession(),
    dispose: () => {
      session.dispose()
      if (activeManager === manager) activeManager = null
    },
  }

  activeManager = manager
  return manager
}

export function getActiveVoiceSessionManager(): VoiceSessionManager | null {
  return activeManager
}

export function mapStatusToUxLabel(status: VoiceSessionStatus): string {
  return VOICE_UX_LABELS_AR[status] ?? 'جاهز'
}
