import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react'
import {
  createBilamoVoiceSession,
  obtainSharedBilamoVoiceSession,
  orbStateFromVoiceSession,
  type BilamoOrbVoiceState,
  type BilamoVoiceSession,
  type BilamoVoiceSessionSnapshot,
} from '../lib/bilamo/voice'

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
      audioContextState: null,
      playback: {
        remoteTrackReceived: false,
        remoteTrackMuted: null,
        remoteTrackReadyState: null,
        audioElementAttached: false,
        audioPlayRequested: false,
        audioPlaybackStarted: false,
        audioPlaybackFailed: false,
        audioPlaybackEnded: false,
        speechDetected: false,
        endOfSpeechDetected: false,
        inputCommitted: false,
        finalTranscriptReceived: false,
        assistantResponseCreated: false,
        classicFallbackInvoked: false,
        interruptAcknowledged: false,
        lastEvent: null,
        lastSafeErrorCode: null,
        lastFsmTransition: null,
        stuckWatchdogCount: 0,
        audioContextState: null,
        peerConnectionState: null,
        iceConnectionState: null,
        playResult: null,
      },
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
    speak: (text: string, locale?: 'ar' | 'en') => session.speak(text, locale),
    interrupt: () => session.interrupt(),
    bargeIn: () => session.bargeIn(),
    startListening: () => session.startListening(),
    stopListening: () => session.stopListening(),
    /** End-of-speech finalize (commit once) — preferred over stopListening for silence. */
    finalizeListening: () => session.finalizeListening(),
    connect: () => session.connect(),
    disconnect: () => session.disconnect(),
    switchToClassic: () => session.switchToClassic(),
    clearError: () => session.clearError(),
    setConversationId: (id: string | null) => session.setConversationId(id),
    setLocale: (locale: 'ar' | 'en') => session.setLocale(locale),
    getMetrics: () => session.getMetrics(),
    getMetricsReport: () => session.getMetricsReport(),
  }
}
