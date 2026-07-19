import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import {
  createVoiceSession,
  type VoiceSession,
  type VoiceSessionOptions,
  type VoiceSessionSnapshot,
} from '../lib/voiceConversation'

export type UseVoiceConversationOptions = VoiceSessionOptions & {
  autoStart?: boolean
}

export type UseVoiceConversationReturn = VoiceSessionSnapshot & {
  session: VoiceSession
  start: () => Promise<void>
  stop: () => Promise<void>
  interrupt: () => Promise<void>
  pause: () => void
  resume: () => void
  commitUserUtterance: (transcript: string) => string | null
  beginAssistantSpeech: (content: string) => string | null
  endAssistantSpeech: () => void
  queueAssistantResponse: (content: string) => unknown
  recordLatency: (label: string, durationMs: number) => void
}

/**
 * Sprint 18 — owns a VoiceSession and exposes a stable snapshot.
 * Does not connect to realtime APIs or generate audio.
 */
export function useVoiceConversation(
  options: UseVoiceConversationOptions = {},
): UseVoiceConversationReturn {
  const { autoStart = false, ...sessionOptions } = options
  const sessionRef = useRef<VoiceSession | null>(null)
  if (!sessionRef.current) {
    sessionRef.current = createVoiceSession(sessionOptions)
  }
  const session = sessionRef.current

  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  )

  useEffect(() => {
    return () => {
      session.dispose()
      sessionRef.current = null
    }
  }, [session])

  useEffect(() => {
    if (!autoStart) return
    void session.start()
  }, [session, autoStart])

  const start = useCallback(() => session.start(), [session])
  const stop = useCallback(() => session.stop(), [session])
  const interrupt = useCallback(() => session.interrupt(), [session])
  const pause = useCallback(() => session.pause(), [session])
  const resume = useCallback(() => session.resume(), [session])
  const commitUserUtterance = useCallback(
    (transcript: string) => session.commitUserUtterance(transcript),
    [session],
  )
  const beginAssistantSpeech = useCallback(
    (content: string) => session.beginAssistantSpeech(content),
    [session],
  )
  const endAssistantSpeech = useCallback(() => session.endAssistantSpeech(), [session])
  const queueAssistantResponse = useCallback(
    (content: string) => session.queueAssistantResponse(content),
    [session],
  )
  const recordLatency = useCallback(
    (label: string, durationMs: number) => session.recordLatency(label, durationMs),
    [session],
  )

  return {
    ...snapshot,
    session,
    start,
    stop,
    interrupt,
    pause,
    resume,
    commitUserUtterance,
    beginAssistantSpeech,
    endAssistantSpeech,
    queueAssistantResponse,
    recordLatency,
  }
}
