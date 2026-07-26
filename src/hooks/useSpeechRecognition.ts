import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { voiceStage } from '../lib/chat/voice/voiceDebugTrace'

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

/** Default silence gap before auto-stop (2–3s pause tolerance for natural speech). */
export const DEFAULT_SILENCE_MS = 3000

/** Hard cap for a continuous listening session. */
export const DEFAULT_MAX_LISTEN_MS = 60_000

/** Brief delay before restarting after an unexpected browser end (WebKit). */
const RESTART_DELAY_MS = 160

/**
 * After STT_START, if no onresult arrives, end with FAILURE.
 * Prevents Safari no-speech restart loops that never reach FINAL_RESULT.
 */
export const DEFAULT_NO_RESULT_WATCHDOG_MS = 8_000

export type UseSpeechRecognitionOptions = {
  /** Called with the full session transcript when listening ends. Never auto-sends. */
  onResult?: (transcript: string) => void
  /** Optional interim transcript for live preview. */
  onInterim?: (transcript: string) => void
  /** Force language; default auto-detects from browser. */
  lang?: SpeechLang
  /** Auto-stop after this many ms of silence (default 3000). */
  silenceMs?: number
  /** Hard timeout for a listening session (default 60000). */
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

/** Singleton owner so only one recognizer runs at a time. */
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
  /** Fail session if no speech result after STT_START (default 8000). */
  noResultWatchdogMs?: number
  /** Inject ctor for tests. */
  getCtor?: () => SpeechRecognitionCtor | null
  /** Inject language detection for tests. */
  detectLang?: () => SpeechLang
}

/**
 * Framework-free speech recognition session (testable in Node).
 * Mobile Safari: webkitSpeechRecognition with continuous restart + silence gate.
 */
export function createSpeechRecognitionSession(
  options: SpeechRecognitionSessionOptions = {},
) {
  let silenceMs = options.silenceMs ?? DEFAULT_SILENCE_MS
  let maxListenMs = options.maxListenMs ?? DEFAULT_MAX_LISTEN_MS
  let noResultWatchdogMs = options.noResultWatchdogMs ?? DEFAULT_NO_RESULT_WATCHDOG_MS
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
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let noResultTimer: ReturnType<typeof setTimeout> | null = null
  let onStartWatchdog: ReturnType<typeof setTimeout> | null = null
  let interimBuffer = ''
  let finalBuffer = ''
  /** Last non-empty transcript seen in this session (interim or final). */
  let lastHeardTranscript = ''
  let sawFinalChunk = false
  let sttStarted = false
  let pendingCommitReason: string | null = null
  let delivered = false
  let cancelled = false
  let disposed = false
  /** True from start until Stop / silence / max timeout / cancel. */
  let listeningDesired = false
  /** Silence timer arms only after the first speech result (never cut thinking pauses before talking). */
  let heardSpeech = false

  const listeners = new Set<() => void>()

  // Cached for useSyncExternalStore — getSnapshot must return a stable
  // reference when data has not changed (React prod error #185 otherwise).
  let cachedSnapshot: SpeechRecognitionSnapshot = {
    status,
    error,
    errorMessage,
    isSupported: status !== 'unsupported' && !!getCtor(),
    isListening: false,
    lang,
    interimTranscript,
    finalTranscript,
  }

  const rebuildSnapshot = () => {
    cachedSnapshot = {
      status,
      error,
      errorMessage,
      isSupported: status !== 'unsupported' && !!getCtor(),
      isListening: status === 'listening',
      lang,
      interimTranscript,
      finalTranscript,
    }
  }

  const emit = () => {
    rebuildSnapshot()
    for (const listener of listeners) listener()
  }

  const snapshot = (): SpeechRecognitionSnapshot => cachedSnapshot

  const clearSilenceTimer = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  const clearRestartTimer = () => {
    if (restartTimer) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  const clearMaxTimer = () => {
    if (maxTimer) {
      clearTimeout(maxTimer)
      maxTimer = null
    }
  }

  const clearNoResultTimer = () => {
    if (noResultTimer) {
      clearTimeout(noResultTimer)
      noResultTimer = null
    }
  }

  const clearOnStartWatchdog = () => {
    if (onStartWatchdog) {
      clearTimeout(onStartWatchdog)
      onStartWatchdog = null
    }
  }

  const clearTimers = () => {
    clearSilenceTimer()
    clearMaxTimer()
    clearRestartTimer()
    clearNoResultTimer()
    clearOnStartWatchdog()
  }

  const failStage = (reason: string, recoveryAction: string, errorKind: SpeechRecognitionErrorKind = 'no-speech') => {
    const mapped = mapError(
      errorKind === 'timeout'
        ? 'timeout'
        : errorKind === 'no-speech'
          ? 'no-speech'
          : errorKind === 'permission-denied'
            ? 'not-allowed'
            : 'network',
    )
    error = errorKind
    errorMessage = mapped.message
    status = mapped.status === 'idle' ? 'error' : mapped.status
    voiceStage({
      stage: 'FAILURE',
      success: false,
      reason,
      previousState: 'LISTENING',
      currentState: 'ERROR',
      recoveryAction,
      transcriptLen: lastHeardTranscript.length || finalBuffer.length || undefined,
      preview: lastHeardTranscript || finalBuffer || undefined,
      meta: {
        failedStage: 'FINAL_RESULT',
        heardSpeech,
        sttStarted,
        sawFinalChunk,
      },
    })
  }

  const commitInterimToFinal = () => {
    const piece = interimBuffer.trim()
    if (!piece) {
      interimBuffer = ''
      interimTranscript = ''
      return
    }
    finalBuffer = `${finalBuffer} ${piece}`.trim()
    finalTranscript = finalBuffer
    lastHeardTranscript = finalBuffer
    interimBuffer = ''
    interimTranscript = ''
  }

  const resolveDeliverableTranscript = () => {
    const fromBuffers = [finalBuffer, interimBuffer].filter(Boolean).join(' ').trim()
    if (fromBuffers) return fromBuffers
    return lastHeardTranscript.trim()
  }

  const sessionTranscript = () => resolveDeliverableTranscript()

  /**
   * Deliver a final transcript to the consumer, or FAILURE if none.
   * Never silently marks delivered without onResult or an error stage.
   */
  const deliverResult = (transcript: string, commitReason: string) => {
    if (delivered || cancelled) return

    const trimmed = (transcript || resolveDeliverableTranscript()).trim()
    if (!trimmed) {
      delivered = true
      // Never started listening — idle without pretending success.
      if (!sttStarted && !heardSpeech) {
        status = 'idle'
        emit()
        return
      }
      const reason =
        commitReason === 'stt_no_result_watchdog' || commitReason === 'stt_onstart_never_fired'
          ? commitReason
          : heardSpeech
            ? 'empty_transcript_after_final'
            : 'final_result_never_arrived'
      if (error == null) {
        failStage(
          reason,
          'retry_mic_speak_clearly_or_type',
          heardSpeech ? 'recognition-failure' : 'no-speech',
        )
      } else {
        voiceStage({
          stage: 'FAILURE',
          success: false,
          reason,
          previousState: 'LISTENING',
          currentState: 'ERROR',
          recoveryAction: 'retry_mic_speak_clearly_or_type',
          meta: {
            failedStage: 'FINAL_RESULT',
            priorError: error,
            commitReason,
            heardSpeech,
            sttStarted,
          },
        })
        if (status === 'listening' || status === 'idle') status = 'error'
      }
      emit()
      return
    }

    delivered = true
    finalTranscript = trimmed
    finalBuffer = trimmed
    const soft = !sawFinalChunk
    voiceStage({
      stage: 'FINAL_RESULT',
      transcriptLen: trimmed.length,
      preview: trimmed,
      previousState: 'LISTENING',
      currentState: 'FINAL_TRANSCRIPT',
      meta: {
        commitReason,
        isSoftFinal: soft,
        source: soft ? 'soft_final_interim_or_buffer' : 'recognition_final_or_buffer',
      },
    })
    onResult?.(trimmed)
    emit()
  }

  const endListeningSession = (opts?: {
    errorKind?: SpeechRecognitionErrorKind
    commitReason?: string
  }) => {
    listeningDesired = false
    clearTimers()
    commitInterimToFinal()
    const text = resolveDeliverableTranscript()
    if (!cancelled) {
      deliverResult(text, opts?.commitReason ?? 'end_listening_session')
    }
    recognition = null
    if (activeOwnerId === ownerId) {
      activeRecognition = null
      activeOwnerId = null
    }
    interimTranscript = ''
    interimBuffer = ''
    if (finalTranscript.trim() && delivered && error == null) {
      status = 'idle'
    } else if (opts?.errorKind && status !== 'error' && status !== 'permission-denied') {
      const mapped = mapError(
        opts.errorKind === 'timeout'
          ? 'timeout'
          : opts.errorKind === 'no-speech'
            ? 'no-speech'
            : 'network',
      )
      error = opts.errorKind
      errorMessage = mapped.message
      status = mapped.status === 'idle' ? 'error' : mapped.status
    } else if (status === 'listening' && error == null) {
      status = 'idle'
    }
    emit()
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

  /** Reset silence gate only when speech activity is observed (tolerates 2–3s pauses). */
  const bumpSilenceTimer = () => {
    if (!listeningDesired) return
    clearSilenceTimer()
    silenceTimer = setTimeout(() => {
      // Never stop before the user has spoken at least once.
      if (!heardSpeech) return
      // Longer silence → end session (do not restart).
      listeningDesired = false
      pendingCommitReason = 'silence_gate'
      try {
        recognition?.stop()
      } catch {
        /* ignore */
      }
      // If recognition already gone, finish now.
      if (!recognition) {
        endListeningSession({ commitReason: 'silence_gate' })
      }
    }, silenceMs)
  }

  const claimSingleton = () => {
    if (activeOwnerId && activeOwnerId !== ownerId) {
      try {
        activeRecognition?.abort()
      } catch {
        /* ignore */
      }
      activeRecognition = null
      activeOwnerId = null
    }
  }

  const attachAndStart = (): boolean => {
    if (disposed || cancelled || !listeningDesired) return false
    const Ctor = getCtor()
    if (!Ctor) {
      listeningDesired = false
      status = 'unsupported'
      error = 'unsupported'
      errorMessage = 'Voice input is not supported in this browser.'
      emit()
      return false
    }

    claimSingleton()
    if (recognition) {
      const prev = recognition
      recognition = null
      detachRecognition(prev)
      try {
        prev.abort()
      } catch {
        /* ignore */
      }
    }

    const next = new Ctor()
    next.lang = lang
    // Safari / iOS: continuous=false is more reliable; we restart while listeningDesired.
    next.continuous = false
    next.interimResults = true
    next.maxAlternatives = 1

    next.onstart = () => {
      if (!listeningDesired) return
      clearOnStartWatchdog()
      sttStarted = true
      status = 'listening'
      error = null
      errorMessage = null
      emit()
      voiceStage({
        stage: 'STT_START',
        previousState: 'LISTENING',
        currentState: 'LISTENING',
        meta: { lang, continuous: next.continuous },
      })
      // Watchdog: STT_START with no INTERIM/FINAL must not loop forever.
      clearNoResultTimer()
      if (!heardSpeech) {
        noResultTimer = setTimeout(() => {
          noResultTimer = null
          if (!listeningDesired || heardSpeech || delivered || cancelled) return
          listeningDesired = false
          pendingCommitReason = 'stt_no_result_watchdog'
          try {
            recognition?.stop()
          } catch {
            /* ignore */
          }
          if (!recognition) {
            endListeningSession({
              errorKind: 'no-speech',
              commitReason: 'stt_no_result_watchdog',
            })
          } else {
            setTimeout(() => {
              if (!delivered && !cancelled) {
                endListeningSession({
                  errorKind: 'no-speech',
                  commitReason: 'stt_no_result_watchdog',
                })
              }
            }, 350)
          }
        }, noResultWatchdogMs)
      }
      // Do NOT arm silence on start — waiting to begin speaking must not auto-stop.
    }

    next.onresult = (event) => {
      if (!listeningDesired) return
      let interim = ''
      let finalChunk = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalChunk += text
        else interim += text
      }
      if (finalChunk) {
        // Append — never replace prior finals in this session.
        sawFinalChunk = true
        finalBuffer = `${finalBuffer} ${finalChunk}`.trim()
        finalTranscript = finalBuffer
        lastHeardTranscript = finalBuffer
        // Engine-level final chunk (session deliver still happens on end/silence).
        voiceStage({
          stage: 'FINAL_RESULT',
          transcriptLen: finalBuffer.length,
          preview: finalBuffer,
          previousState: 'LISTENING',
          currentState: 'LISTENING',
          meta: {
            source: 'webkit_or_speech_recognition',
            isFinal: true,
            commitReason: 'recognition_is_final_chunk',
            sessionDeliverPending: true,
          },
        })
      }
      interimBuffer = interim
      interimTranscript = interim
      const live = [finalBuffer, interim].filter(Boolean).join(' ').trim()
      if (live) lastHeardTranscript = live
      onInterim?.(live)
      emit()
      if (finalChunk || interim) {
        heardSpeech = true
        clearNoResultTimer()
        bumpSilenceTimer()
        if (interim && !finalChunk) {
          voiceStage({
            stage: 'INTERIM_RESULT',
            transcriptLen: interim.length,
            preview: interim,
            previousState: 'LISTENING',
            currentState: 'LISTENING',
          })
        }
      }
    }

    next.onerror = (event) => {
      if (cancelled || event.error === 'aborted') {
        if (cancelled) {
          listeningDesired = false
          clearTimers()
          status = 'idle'
          error = 'user-cancelled'
          errorMessage = 'Voice input cancelled.'
          emit()
        }
        return
      }

      // Safari often ends a non-continuous turn with no-speech; keep listeningDesired
      // and let onend soft-final (interim) or restart (isFinal accumulation).
      if (event.error === 'no-speech' && listeningDesired) {
        return
      }

      listeningDesired = false
      clearSilenceTimer()
      clearRestartTimer()
      clearNoResultTimer()
      const mapped = mapError(event.error)
      error = mapped.kind
      errorMessage = mapped.message
      status = mapped.status === 'idle' ? 'idle' : mapped.status
      voiceStage({
        stage: 'FAILURE',
        success: false,
        reason: event.error || mapped.kind,
        previousState: 'LISTENING',
        currentState: 'ERROR',
        recoveryAction: 'retry_mic_or_type',
        meta: { mappedKind: mapped.kind, failedStage: 'STT_START' },
      })
      if (mapped.kind === 'timeout') {
        deliverResult(sessionTranscript(), 'error_timeout')
      } else if (mapped.kind === 'no-speech') {
        deliverResult(resolveDeliverableTranscript(), 'error_no_speech')
      }
      emit()
    }

    next.onend = () => {
      // Fold any leftover interim into the session transcript before restart/end.
      commitInterimToFinal()
      recognition = null
      if (activeOwnerId === ownerId) {
        activeRecognition = null
        activeOwnerId = null
      }

      if (disposed || cancelled) {
        emit()
        return
      }

      if (listeningDesired) {
        const text = resolveDeliverableTranscript()
        // Safari/WebKit often never sets isFinal — only interim — then ends the turn.
        // Restarting here drops the pipeline into limbo (STT_START, no CHAT_REQUEST).
        // Soft-final the utterance so FINAL_RESULT → onResult → submit can proceed.
        if (heardSpeech && text && !sawFinalChunk) {
          listeningDesired = false
          clearTimers()
          deliverResult(text, 'soft_final_webkit_interim_end')
          if (error == null) status = 'idle'
          interimTranscript = ''
          interimBuffer = ''
          emit()
          return
        }

        // Real isFinal chunks: keep listening across unexpected browser ends until silence/stop.
        // Ensure silence gate is armed so we cannot restart forever without a final deliver.
        if (heardSpeech && text && !silenceTimer) {
          bumpSilenceTimer()
        }
        status = 'listening'
        emit()
        clearRestartTimer()
        restartTimer = setTimeout(() => {
          restartTimer = null
          if (!listeningDesired || disposed || cancelled) return
          attachAndStart()
        }, RESTART_DELAY_MS)
        return
      }

      // Intentional end: Stop, silence, or hard timeout already cleared listeningDesired.
      const reason = pendingCommitReason ?? 'intentional_recognition_end'
      pendingCommitReason = null
      deliverResult(resolveDeliverableTranscript(), reason)
      if (status === 'listening' && error == null) {
        status = 'idle'
      }
      interimTranscript = ''
      interimBuffer = ''
      emit()
    }

    recognition = next
    activeOwnerId = ownerId
    activeRecognition = next

    // If onstart never fires (some WebKit builds), fail instead of hanging.
    clearOnStartWatchdog()
    onStartWatchdog = setTimeout(() => {
      onStartWatchdog = null
      if (!listeningDesired || sttStarted || delivered || cancelled) return
      listeningDesired = false
      try {
        recognition?.abort()
      } catch {
        /* ignore */
      }
      endListeningSession({
        errorKind: 'recognition-failure',
        commitReason: 'stt_onstart_never_fired',
      })
    }, 2_500)

    try {
      next.start()
      return true
    } catch {
      recognition = null
      detachRecognition(next)
      if (activeOwnerId === ownerId) {
        activeRecognition = null
        activeOwnerId = null
      }
      // One retry shortly after — WebKit sometimes rejects immediate restart.
      if (listeningDesired) {
        clearRestartTimer()
        restartTimer = setTimeout(() => {
          restartTimer = null
          if (!listeningDesired || disposed || cancelled) return
          attachAndStart()
        }, RESTART_DELAY_MS)
        return false
      }
      listeningDesired = false
      status = 'error'
      error = 'recognition-failure'
      errorMessage = 'Could not start speech recognition.'
      voiceStage({
        stage: 'FAILURE',
        success: false,
        reason: 'stt_start_threw',
        previousState: 'LISTENING',
        currentState: 'ERROR',
        recoveryAction: 'retry_mic_or_type',
        meta: { failedStage: 'STT_START' },
      })
      emit()
      return false
    }
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

    clearTimers()
    claimSingleton()
    if (recognition) {
      const prev = recognition
      recognition = null
      detachRecognition(prev)
      try {
        prev.abort()
      } catch {
        /* ignore */
      }
    }

    lang = detectLang()
    interimBuffer = ''
    finalBuffer = ''
    lastHeardTranscript = ''
    sawFinalChunk = false
    sttStarted = false
    pendingCommitReason = null
    delivered = false
    cancelled = false
    listeningDesired = true
    heardSpeech = false
    interimTranscript = ''
    finalTranscript = ''
    error = null
    errorMessage = null
    status = 'listening'
    emit()

    // Session-level max listen (not reset on each continuous restart).
    maxTimer = setTimeout(() => {
      listeningDesired = false
      const mapped = mapError('timeout')
      error = mapped.kind
      errorMessage = mapped.message
      status = mapped.status
      emit()
      try {
        recognition?.stop()
      } catch {
        /* ignore */
      }
      if (!recognition) {
        endListeningSession({ errorKind: 'timeout', commitReason: 'stt_max_listen_timeout' })
      }
    }, maxListenMs)

    attachAndStart()
  }

  const stop = () => {
    if (disposed) return
    // Manual Stop must work immediately — no restart.
    listeningDesired = false
    clearRestartTimer()
    clearSilenceTimer()
    clearMaxTimer()

    if (!recognition && status !== 'listening') {
      status = 'idle'
      emit()
      return
    }

    if (!recognition) {
      endListeningSession({ commitReason: 'manual_stop' })
      return
    }

    try {
      recognition.stop()
    } catch {
      endListeningSession({ commitReason: 'manual_stop' })
      return
    }

    // Fallback if onend is delayed (some WebKit builds).
    setTimeout(() => {
      if (status === 'listening' && !listeningDesired) {
        endListeningSession({ commitReason: 'manual_stop_onend_fallback' })
      }
    }, 300)
  }

  const cancel = () => {
    if (disposed) return
    cancelled = true
    listeningDesired = false
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
    if (status === 'listening' || listeningDesired) stop()
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
    listeningDesired = false
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
    noResultWatchdogMs?: number
  }) => {
    onResult = next.onResult
    onInterim = next.onInterim
    if (next.lang !== undefined) langOverride = next.lang
    if (next.silenceMs !== undefined) silenceMs = next.silenceMs
    if (next.maxListenMs !== undefined) maxListenMs = next.maxListenMs
    if (next.noResultWatchdogMs !== undefined) noResultWatchdogMs = next.noResultWatchdogMs
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
    silenceMs = DEFAULT_SILENCE_MS,
    maxListenMs = DEFAULT_MAX_LISTEN_MS,
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
