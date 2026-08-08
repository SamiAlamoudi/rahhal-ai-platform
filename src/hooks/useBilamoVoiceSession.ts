import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react'
import {
  createBilamoVoiceSession,
  emptyVoicePlaybackDiagnostics,
  obtainSharedBilamoVoiceSession,
  orbStateFromVoiceSession,
  type BilamoOrbVoiceState,
  type BilamoVoiceConnectOptions,
  type BilamoVoiceSession,
  type BilamoVoiceSessionSnapshot,
} from '../lib/bilamo/voice'
import type { VoiceLocale } from '../lib/chat/voice/voiceTypes'

export type UseBilamoVoiceSessionOptions = {
  enabled?: boolean
  /** When false, creates an isolated session (unit tests). Default: shared. */
  shared?: boolean
  onFinalUtterance?: (text: string, normalizedForExtract?: string | null) => void
}

/**
 * React binding for the shared Bilamo VoiceSession.
 * Home and Conversation must use this so there is only one mic / one playback path.
 */
export function useBilamoVoiceSession(options: UseBilamoVoiceSessionOptions = {}) {
  const enabled = options.enabled !== false
  const shared = options.shared !== false
  const sessionRef = useRef<BilamoVoiceSession | null>(null)

  if (!sessionRef.current) {
    sessionRef.current = shared
      ? obtainSharedBilamoVoiceSession()
      : createBilamoVoiceSession()
  }
  const session = sessionRef.current

  const onFinal = useEffectEvent((text: string, normalizedForExtract?: string | null) => {
    options.onFinalUtterance?.(text, normalizedForExtract)
  })

  useEffect(() => {
    if (!enabled) return
    void session.prepare()
    session.setOnFinalUtterance((event) => {
      onFinal(event.text, event.normalizedForExtract ?? null)
    })
    const detachGuards = session.attachReliabilityGuards()
    return () => {
      session.setOnFinalUtterance(null)
      detachGuards()
      // Do not dispose shared session on unmount — Home ↔ Conversation share it.
      if (!shared) session.dispose()
    }
  }, [enabled, session, shared])

  const snapshot = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getSnapshot(),
    (): BilamoVoiceSessionSnapshot => ({
      state: 'idle',
      connection: 'idle',
      transportKind: null,
      requestedTransport: null,
      partialTranscript: '',
      finalTranscript: null,
      normalizedForExtract: null,
      generation: 0,
      error: null,
      lastSafeErrorCode: null,
      fellBackToClassic: false,
      locale: 'en',
      conversationId: null,
      listening: false,
      speaking: false,
      secondTurnReady: true,
      voiceSessionActive: false,
      manuallyStopped: false,
      audioContextState: null,
      playback: emptyVoicePlaybackDiagnostics(),
    }),
  )

  const [toggleBusy, setToggleBusy] = useState(false)

  const toggleMic = useEffectEvent(async () => {
    if (!enabled || toggleBusy) return
    setToggleBusy(true)
    try {
      if (snapshot.state === 'speaking' || snapshot.speaking) {
        await session.bargeIn()
        return
      }
      // Stuck processing after first turn — recover via barge-in (no reload).
      if (snapshot.state === 'processing' && !snapshot.secondTurnReady) {
        await session.bargeIn()
        return
      }
      if (snapshot.listening || snapshot.state === 'listening') {
        session.stopListening()
        return
      }
      await session.startListening()
    } finally {
      setToggleBusy(false)
    }
  })

  const orbState: BilamoOrbVoiceState = orbStateFromVoiceSession(snapshot.state)

  return {
    session,
    snapshot,
    orbState,
    speaking: snapshot.speaking,
    listening: snapshot.listening,
    partialTranscript: snapshot.partialTranscript,
    lastError: snapshot.error,
    transportKind: snapshot.transportKind,
    fellBackToClassic: snapshot.fellBackToClassic,
    toggleMic,
    speak: (text: string, locale?: VoiceLocale) => session.speak(text, locale),
    interrupt: () => session.interrupt(),
    bargeIn: () => session.bargeIn(),
    startListening: (options?: BilamoVoiceConnectOptions) => session.startListening(options),
    stopListening: () => session.stopListening(),
    cancelListening: () => session.cancelListening(),
    /** End-of-speech finalize (commit once) — preferred over stopListening for silence. */
    finalizeListening: () => session.finalizeListening(),
    connect: (options?: BilamoVoiceConnectOptions) => session.connect(options),
    disconnect: () => session.disconnect(),
    switchToClassic: () => session.switchToClassic(),
    clearError: () => session.clearError(),
    releaseToIdle: (reason?: string) => session.releaseToIdle(reason),
    setConversationId: (id: string | null) => session.setConversationId(id),
    setLocale: (locale: VoiceLocale) => session.setLocale(locale),
    setContinuousListening: (enabled: boolean) => session.setContinuousListening(enabled),
    stopVoiceSession: () => session.stopVoiceSession(),
    getMetrics: () => session.getMetrics(),
    getMetricsReport: () => session.getMetricsReport(),
  }
}
