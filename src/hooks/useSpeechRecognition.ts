import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

export type SpeechRecognitionStatus =
  | 'idle'
  | 'listening'
  | 'unsupported'
  | 'permission-denied'
  | 'error'

export type SpeechRecognitionErrorKind =
  | 'permission-denied'
  | 'unsupported'
  | 'timeout'
  | 'no-speech'
  | 'recognition-failure'
  | 'user-cancelled'
  | null

export type SpeechLang = 'ar-SA' | 'en-US'

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: ((this: SpeechRecognitionLike, ev: Event) => void) | null
  onresult: ((this: SpeechRecognitionLike, ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((this: SpeechRecognitionLike, ev: SpeechRecognitionErrorEventLike) => void) | null
  onend: ((this: SpeechRecognitionLike, ev: Event) => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
    length: number
  }>
}

type SpeechRecognitionErrorEventLike = {
  error: string
  message?: string
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

export type UseSpeechRecognitionOptions = {
  /** Called with final transcript when recognition completes. Never auto-sends. */
  onResult?: (transcript: string) => void
  /** Optional interim transcript for live preview. */
  onInterim?: (transcript: string) => void
  /** Force language; default auto-detects from browser. */
  lang?: SpeechLang
  /** Auto-stop after this many ms of silence (default 2200). */
  silenceMs?: number
  /** Hard timeout for a listening session (default 20000). */
  maxListenMs?: number
}

export type SpeechRecognitionSnapshot = {
  status: SpeechRecognitionStatus
  error: SpeechRecognitionErrorKind
  errorMessage: string | null
  isSupported: boolean
  isListening: boolean
  lang: SpeechLang
  interimTranscript: string
  finalTranscript: string
}

export type UseSpeechRecognitionReturn = SpeechRecognitionSnapshot & {
  start: () => void
  stop: () => void
  toggle: () => void
  cancel: () => void
  clearError: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

/** Singleton owner so only one recognizer runs at a time (requirement #9). */
let activeOwnerId: symbol | null = null
let activeRecognition: SpeechRecognitionLike | null = null

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

/** Detect ar-SA vs en-US from browser / document language. */
export function detectSpeechLang(navigatorLang?: string): SpeechLang {
  const raw =
    navigatorLang ??
    (typeof navigator !== 'undefined'
      ? navigator.language || navigator.languages?.[0] || 'en'
      : 'en')
  const lower = raw.toLowerCase()
  if (lower.startsWith('ar') || lower.includes('ar-sa')) {
    return 'ar-SA'
  }
  return 'en-US'
}

function mapError(code: string): {
  kind: SpeechRecognitionErrorKind
  status: SpeechRecognitionStatus
  message: string
} {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        kind: 'permission-denied',
        status: 'permission-denied',
        message: 'Microphone permission denied. Allow mic access and try again.',
      }
    case 'no-speech':
      return {
        kind: 'no-speech',
        status: 'error',
        message: 'No speech detected. Tap the mic and try again.',
      }
    case 'aborted':
      return {
        kind: 'user-cancelled',
        status: 'idle',
        message: 'Voice input cancelled.',
      }
    case 'audio-capture':
      return {
        kind: 'recognition-failure',
        status: 'error',
        message: 'Could not access the microphone.',
      }
    case 'network':
      return {
        kind: 'recognition-failure',
        status: 'error',
        message: 'Network error during speech recognition.',
      }
    case 'timeout':
      return {
        kind: 'timeout',
        status: 'error',
        message: 'Listening timed out. Tap the mic to try again.',
      }
    default:
      return {
        kind: 'recognition-failure',
        status: 'error',
        message: 'Speech recognition failed. Please try again.',
      }
  }
}

export type SpeechRecognitionSessionOptions = {
  onResult?: (transcript: string) => void
  onInterim?: (transcript: string) => void
  lang?: SpeechLang
  silenceMs?: number
  maxListenMs?: number
  /** Inject ctor for tests. */
  getCtor?: () => SpeechRecognitionCtor | null
  /** Inject language detection for tests. */
  detectLang?: () => SpeechLang
}

/**
 * Framework-free speech recognition session (testable in Node).
 * Mobile Safari: webkitSpeechRecognition, continuous=false, silence auto-stop.
 */
export function createSpeechRecognitionSession(
  options: SpeechRecognitionSessionOptions = {},
) {
  let silenceMs = options.silenceMs ?? 2200
  let maxListenMs = options.maxListenMs ?? 20_000
  let langOverride = options.lang
  const getCtor = options.getCtor ?? getSpeechRecognitionCtor
  const detectLang = options.detectLang ?? (() => langOverride ?? detectSpeechLang())

  const ownerId = Symbol('speech-recognition')
  let onResult = options.onResult
  let onInterim = options.onInterim

  let status: SpeechRecognitionStatus = getCtor() ? 'idle' : 'unsupported'
  let error: SpeechRecognitionErrorKind = getCtor() ? null : 'unsupported'
  let errorMessage: string | null = getCtor()
    ? null
    : 'Voice input is not supported in this browser.'
  let lang: SpeechLang = detectLang()
  let interimTranscript = ''
  let finalTranscript = ''

  let recognition: SpeechRecognitionLike | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let maxTimer: ReturnType<typeof setTimeout> | null = null
  let interimBuffer = ''
  let finalBuffer = ''
  let delivered = false
  let cancelled = false
  let disposed = false

  const listeners = new Set<() => void>()

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const snapshot = (): SpeechRecognitionSnapshot => ({
    status,
    error,
    errorMessage,
    isSupported: status !== 'unsupported' && !!getCtor(),
    isListening: status === 'listening',
    lang,
    interimTranscript,
    finalTranscript,
  })

  const clearTimers = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
    if (maxTimer) {
      clearTimeout(maxTimer)
      maxTimer = null
    }
  }

  const deliverResult = (transcript: string) => {
    if (delivered || cancelled) return
    delivered = true
    const trimmed = transcript.trim()
    if (trimmed) {
      finalTranscript = trimmed
      onResult?.(trimmed)
      emit()
    }
  }

  const detachRecognition = (rec: SpeechRecognitionLike | null) => {
    if (!rec) return
    rec.onstart = null
    rec.onresult = null
    rec.onerror = null
    rec.onend = null
  }

  const tearDown = (abort = true) => {
    clearTimers()
    const rec = recognition
    recognition = null
    detachRecognition(rec)
    if (abort && rec) {
      try {
        rec.abort()
      } catch {
        /* ignore */
      }
    }
    if (activeOwnerId === ownerId) {
      activeRecognition = null
      activeOwnerId = null
    }
  }

  const bumpSilenceTimer = () => {
    if (silenceTimer) clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      try {
        recognition?.stop()
      } catch {
        /* ignore */
      }
    }, silenceMs)
  }

  const start = () => {
    if (disposed) return
    const Ctor = getCtor()
    if (!Ctor) {
      status = 'unsupported'
      error = 'unsupported'
      errorMessage = 'Voice input is not supported in this browser.'
      emit()
      return
    }

    // Prevent duplicate recognizers — release any previous owner.
    if (activeOwnerId && activeOwnerId !== ownerId) {
      try {
        activeRecognition?.abort()
      } catch {
        /* ignore */
      }
      activeRecognition = null
      activeOwnerId = null
    }
    if (recognition) {
      tearDown(true)
    }

    lang = detectLang()
    interimBuffer = ''
    finalBuffer = ''
    delivered = false
    cancelled = false
    interimTranscript = ''
    finalTranscript = ''
    error = null
    errorMessage = null

    const next = new Ctor()
    next.lang = lang
    // Safari / iOS: continuous false is more reliable; silence timer covers auto-stop.
    next.continuous = false
    next.interimResults = true
    next.maxAlternatives = 1

    next.onstart = () => {
      status = 'listening'
      emit()
      bumpSilenceTimer()
      maxTimer = setTimeout(() => {
        const mapped = mapError('timeout')
        error = mapped.kind
        errorMessage = mapped.message
        status = mapped.status
        emit()
        try {
          next.stop()
        } catch {
          /* ignore */
        }
      }, maxListenMs)
    }

    next.onresult = (event) => {
      let interim = ''
      let finalChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalChunk += text
        else interim += text
      }
      if (finalChunk) {
        finalBuffer = `${finalBuffer} ${finalChunk}`.trim()
        finalTranscript = finalBuffer
      }
      interimBuffer = interim
      interimTranscript = interim
      onInterim?.([finalBuffer, interim].filter(Boolean).join(' ').trim())
      emit()
      bumpSilenceTimer()
    }

    next.onerror = (event) => {
      clearTimers()
      if (cancelled || event.error === 'aborted') {
        if (cancelled) {
          status = 'idle'
          error = 'user-cancelled'
          errorMessage = 'Voice input cancelled.'
          emit()
        }
        return
      }
      const mapped = mapError(event.error)
      error = mapped.kind
      errorMessage = mapped.message
      status = mapped.status === 'idle' ? 'idle' : mapped.status
      if (mapped.kind === 'no-speech' || mapped.kind === 'timeout') {
        deliverResult(finalBuffer)
      }
      emit()
    }

    next.onend = () => {
      clearTimers()
      const text = [finalBuffer, interimBuffer].filter(Boolean).join(' ').trim()
      if (!cancelled) {
        deliverResult(text)
      }
      recognition = null
      if (activeOwnerId === ownerId) {
        activeRecognition = null
        activeOwnerId = null
      }
      if (status === 'listening') {
        status = 'idle'
      }
      interimTranscript = ''
      interimBuffer = ''
      emit()
    }

    recognition = next
    activeOwnerId = ownerId
    activeRecognition = next

    try {
      next.start()
    } catch {
      tearDown(true)
      status = 'error'
      error = 'recognition-failure'
      errorMessage = 'Could not start speech recognition.'
      emit()
    }
  }

  const stop = () => {
    if (disposed) return
    if (!recognition && status !== 'listening') {
      status = 'idle'
      emit()
      return
    }
    clearTimers()
    try {
      recognition?.stop()
    } catch {
      /* ignore */
    }
    // Fallback if onend is delayed (some WebKit builds).
    setTimeout(() => {
      if (status === 'listening') {
        status = 'idle'
        emit()
      }
    }, 300)
  }

  const cancel = () => {
    if (disposed) return
    cancelled = true
    delivered = true
    clearTimers()
    try {
      recognition?.abort()
    } catch {
      /* ignore */
    }
    tearDown(false)
    status = 'idle'
    error = 'user-cancelled'
    errorMessage = 'Voice input cancelled.'
    interimTranscript = ''
    emit()
  }

  const toggle = () => {
    if (status === 'listening') stop()
    else start()
  }

  const clearError = () => {
    error = null
    errorMessage = null
    if (status === 'error' || status === 'permission-denied') {
      status = 'idle'
    }
    emit()
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    cancelled = true
    delivered = true
    clearTimers()
    tearDown(true)
    listeners.clear()
  }

  const setCallbacks = (next: {
    onResult?: (transcript: string) => void
    onInterim?: (transcript: string) => void
    lang?: SpeechLang
    silenceMs?: number
    maxListenMs?: number
  }) => {
    onResult = next.onResult
    onInterim = next.onInterim
    if (next.lang !== undefined) langOverride = next.lang
    if (next.silenceMs !== undefined) silenceMs = next.silenceMs
    if (next.maxListenMs !== undefined) maxListenMs = next.maxListenMs
  }

  return {
    getSnapshot: snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start,
    stop,
    toggle,
    cancel,
    clearError,
    dispose,
    setCallbacks,
    /** @internal test helper */
    _ownerId: ownerId,
  }
}

export type SpeechRecognitionSession = ReturnType<typeof createSpeechRecognitionSession>

/**
 * Production Web Speech recognition for ConversationComposer / Home.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const {
    onResult,
    onInterim,
    lang: langOverride,
    silenceMs = 2200,
    maxListenMs = 20_000,
  } = options

  const sessionRef = useRef<SpeechRecognitionSession | null>(null)
  if (!sessionRef.current) {
    sessionRef.current = createSpeechRecognitionSession({
      lang: langOverride,
      silenceMs,
      maxListenMs,
      onResult,
      onInterim,
    })
  }

  const session = sessionRef.current
  session.setCallbacks({
    onResult,
    onInterim,
    lang: langOverride,
    silenceMs,
    maxListenMs,
  })

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

  const start = useCallback(() => session.start(), [session])
  const stop = useCallback(() => session.stop(), [session])
  const toggle = useCallback(() => session.toggle(), [session])
  const cancel = useCallback(() => session.cancel(), [session])
  const clearError = useCallback(() => session.clearError(), [session])

  return {
    ...snapshot,
    start,
    stop,
    toggle,
    cancel,
    clearError,
  }
}

/** Test helper — reset singleton between tests. */
export function resetSpeechRecognitionSingleton() {
  try {
    activeRecognition?.abort()
  } catch {
    /* ignore */
  }
  activeRecognition = null
  activeOwnerId = null
}
