import { useMemo, useSyncExternalStore } from 'react'
import {
  listAllowedReasons,
  type VoiceSession,
  type VoiceSessionSnapshot,
  type VoiceState,
} from '../lib/voiceConversation'

export type UseVoiceStateOptions = {
  /** Required — pass the session from useVoiceConversation to avoid duplicates. */
  session: VoiceSession
}

export type UseVoiceStateReturn = {
  state: VoiceState
  previousState: VoiceState | null
  isListening: boolean
  isThinking: boolean
  isSpeaking: boolean
  isPaused: boolean
  isInterrupted: boolean
  isConnected: boolean
  isError: boolean
  allowedReasons: ReturnType<typeof listAllowedReasons>
  snapshot: VoiceSessionSnapshot
}

/**
 * Derived voice UI state from a single VoiceSession (no duplicated controllers).
 */
export function useVoiceState(options: UseVoiceStateOptions): UseVoiceStateReturn {
  const { session } = options
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  )

  return useMemo(
    () => ({
      state: snapshot.state,
      previousState: snapshot.previousState,
      isListening: snapshot.state === 'listening',
      isThinking: snapshot.state === 'thinking',
      isSpeaking: snapshot.state === 'speaking',
      isPaused: snapshot.state === 'paused',
      isInterrupted: snapshot.state === 'interrupted',
      isConnected: snapshot.connected,
      isError: snapshot.state === 'error',
      allowedReasons: listAllowedReasons(snapshot.state),
      snapshot,
    }),
    [snapshot],
  )
}
