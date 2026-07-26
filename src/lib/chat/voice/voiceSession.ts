/**
 * Voice session orchestrator.
 * Uses the shared chatEngine only — no separate conversation/message system.
 * Production stabilization: end-of-utterance silence tolerance, VAD hold,
 * ChatGPT-like listening/thinking/responding/speaking states.
 */

import { chatEngine, type StreamHandlers } from '../chatEngine'
import type { ChatMessage } from '../chatTypes'
import { isBenignChatError } from '../chatLogger'
import { logPipeline, diagnosePipelineError } from '../pipelineDiagnostics'
import { createSpeechToTextProvider, createTextToSpeechProvider } from './voiceProviderFactory'
import { queryMicrophonePermission, requestMicrophoneAccess } from './microphonePermission'
import { createVoiceActivityMonitor, type VoiceActivityMonitor } from './voiceActivityMonitor'
import type {
  MicrophonePermissionState,
  SpeechToTextProvider,
  TextToSpeechProvider,
  VoiceInputMode,
  VoiceLocale,
  VoiceSessionStatus,
} from './voiceTypes'
import {
  DEFAULT_HANDS_FREE_SILENCE_MS,
  MAX_HANDS_FREE_SILENCE_MS,
  MIN_HANDS_FREE_SILENCE_MS,
  normalizeVoiceLocale,
} from './voiceTypes'
import { extractSpokenAnswer, stripMarkdownForSpeech } from './spokenAnswer'
import { voiceStage, voiceTrace } from './voiceDebugTrace'
import { setThinkingEvidenceContext, thinkingEvidence } from './thinkingStuckEvidence'

export { stripMarkdownForSpeech } from './spokenAnswer'

/**
 * Sole authorized delay before the next hands-free STT session (WebKit settle).
 * Owned by VoiceSession — not by recognition.onend, React effects, or TTS callbacks.
 */
export const HANDS_FREE_LISTEN_RESTART_MS = 350

export interface VoiceSessionCallbacks {
  onStatus?: (status: VoiceSessionStatus) => void
  onPartialTranscript?: (text: string) => void
  onFinalTranscript?: (text: string) => void
  onPermission?: (state: MicrophonePermissionState) => void
  onError?: (error: string) => void
  onAssistantCreate?: (message: ChatMessage) => void
  onDelta?: (message: ChatMessage) => void
  onComplete?: (message: ChatMessage) => void
  onStreamError?: (message: ChatMessage, error: string) => void
  /** Live mic level 0–1 for waveform UI while listening. */
  onLevel?: (level: number) => void
}

export interface VoiceSession {
  getStatus: () => VoiceSessionStatus
  getMode: () => VoiceInputMode
  getLocale: () => VoiceLocale
  getPartialTranscript: () => string
  getLevel: () => number
  setMode: (mode: VoiceInputMode) => void
  setLocale: (locale: VoiceLocale) => void
  setSilenceTimeoutMs: (ms: number) => void
  ensureMicPermission: () => Promise<MicrophonePermissionState>
  startPushToTalk: () => Promise<void>
  stopPushToTalkAndSend: (conversationId: string) => Promise<ChatMessage | null>
  startHandsFree: (conversationId: string) => Promise<void>
  /**
   * Home → chat voice handoff: send the first transcript through the same
   * chatEngine path, speak the reply, then resume continuous listening.
   */
  beginContinuousWithSeed: (conversationId: string, content: string) => Promise<ChatMessage | null>
  stopListening: () => Promise<void>
  interrupt: (abortStream?: () => void, opts?: { resumeHandsFree?: boolean }) => void
  speakText: (text: string) => Promise<void>
  dispose: () => void
}

export interface CreateVoiceSessionOptions {
  stt?: SpeechToTextProvider
  tts?: TextToSpeechProvider
  locale?: VoiceLocale
  mode?: VoiceInputMode
  callbacks?: VoiceSessionCallbacks
  sendTurn?: typeof chatEngine.sendMessage
  requestPermission?: () => Promise<MicrophonePermissionState>
  /** Hands-free end-of-utterance silence (ms). Default 3500. */
  silenceTimeoutMs?: number
  /** Inject VAD monitor (tests). */
  activityMonitor?: VoiceActivityMonitor
}

function clampSilenceMs(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_HANDS_FREE_SILENCE_MS
  return Math.max(MIN_HANDS_FREE_SILENCE_MS, Math.min(MAX_HANDS_FREE_SILENCE_MS, Math.round(ms)))
}

export function createVoiceSession(options: CreateVoiceSessionOptions = {}): VoiceSession {
  const stt = options.stt ?? createSpeechToTextProvider()
  const tts = options.tts ?? createTextToSpeechProvider()
  const sendTurn = options.sendTurn ?? chatEngine.sendMessage.bind(chatEngine)
  const callbacks = options.callbacks ?? {}
  const requestPermission = options.requestPermission ?? (async () => {
    let state = await queryMicrophonePermission()
    if (state.state === 'prompt') state = await requestMicrophoneAccess()
    return state
  })

  let status: VoiceSessionStatus = 'idle'
  let mode: VoiceInputMode = options.mode ?? 'push_to_talk'
  let locale: VoiceLocale = normalizeVoiceLocale(options.locale)
  let partial = ''
  let level = 0
  let disposed = false
  let handsFreeConversationId: string | null = null
  let activeAbort: AbortController | null = null
  let listening = false
  let sending = false
  let intentionalAbort = false
  let resumeHandsFreeAfterInterrupt = false
  let silenceTimeoutMs = clampSilenceMs(
    options.silenceTimeoutMs ?? DEFAULT_HANDS_FREE_SILENCE_MS,
  )
  let utteranceBuffer = ''
  let utterancePrefix = ''
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let vadSpeaking = false
  let earlySpokenText = ''
  let earlySpeakPromise: Promise<boolean> | null = null
  let lastSubmittedKey = ''
  let lastSubmittedAt = 0
  let thinkingWatchdog: ReturnType<typeof setTimeout> | null = null
  const THINKING_WATCHDOG_MS = 20_000
  /** True while TTS is playing — blocks any listen restart. */
  let ttsActive = false
  /** Increments to cancel pending restart timers and ignore stale onend. */
  let restartToken = 0
  /** Bumped on each authorized STT start / invalidate; stale onend must not restart. */
  let listenGeneration = 0
  let activeListenGeneration = 0
  /** Only the session manager may honor recognition.onend → restart. */
  let onEndRestartAuthorized = false
  let restartTimer: ReturnType<typeof setTimeout> | null = null
  let emptyEndRestarts = 0
  let emptyEndWindowStartedAt = 0
  let sttStartCount = 0

  const clearThinkingWatchdog = () => {
    if (thinkingWatchdog) {
      clearTimeout(thinkingWatchdog)
      thinkingWatchdog = null
    }
  }

  const clearRestartTimer = () => {
    if (restartTimer) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  const invalidateListenRestarts = () => {
    restartToken += 1
    listenGeneration += 1
    onEndRestartAuthorized = false
    clearRestartTimer()
  }

  const activityMonitor =
    options.activityMonitor
    ?? createVoiceActivityMonitor({
      onLevel: (value) => {
        level = value
        callbacks.onLevel?.(value)
      },
      onSpeakingChange: (speakingNow) => {
        vadSpeaking = speakingNow
        // While energy is present, keep extending the end-of-utterance window.
        if (speakingNow && mode === 'hands_free' && status === 'listening') {
          bumpUtteranceSilenceTimer()
        }
      },
      log: (entry) => logPipeline({ stage: 'microphone', event: String(entry.event), meta: entry }),
    })

  const setStatus = (next: VoiceSessionStatus) => {
    if (disposed) return
    const previous = status
    if (next !== 'thinking') clearThinkingWatchdog()
    status = next
    setThinkingEvidenceContext({
      conversationId: handsFreeConversationId,
      reactState: {
        voiceStatus: next,
        waitingComponent: next === 'thinking' ? 'VoiceSession.setStatus(thinking)' : null,
      },
    })
    thinkingEvidence('STATE_CHANGED', {
      conversationId: handsFreeConversationId,
      reactState: {
        voiceStatus: next,
        waitingComponent:
          next === 'thinking'
            ? 'VoiceStateBadge/VoiceComposer (voiceStatus=thinking)'
            : null,
      },
      meta: { previousVoiceStatus: previous, source: 'VoiceSession.setStatus' },
    })
    callbacks.onStatus?.(next)
    if (next === 'thinking') {
      clearThinkingWatchdog()
      thinkingWatchdog = setTimeout(() => {
        thinkingWatchdog = null
        if (disposed || status !== 'thinking') return
        sending = false
        activeAbort?.abort()
        activeAbort = null
        voiceStage({
          stage: 'FAILURE',
          success: false,
          conversationId: handsFreeConversationId,
          reason: 'thinking_watchdog_timeout',
          previousState: 'THINKING',
          currentState: 'ERROR',
          recoveryAction: 'retry_voice_or_type',
          meta: { failedStage: 'CHAT_RESPONSE', watchdogMs: THINKING_WATCHDOG_MS },
        })
        thinkingEvidence('STATE_CHANGED', {
          conversationId: handsFreeConversationId,
          reactState: {
            voiceStatus: 'error',
            waitingComponent: 'thinking_watchdog_timeout',
          },
          meta: { previousVoiceStatus: 'thinking', source: 'thinking_watchdog' },
        })
        callbacks.onError?.('انتهت مهلة التفكير — أعد المحاولة')
        setStatus('error')
      }, THINKING_WATCHDOG_MS)
    }
  }

  const clearSilenceTimer = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  const clearSttHandlers = () => {
    stt.onPartial = undefined
    stt.onFinal = undefined
    stt.onError = undefined
    stt.onEnd = undefined
  }

  const stopVad = () => {
    activityMonitor.stop()
    level = 0
    vadSpeaking = false
  }

  const bumpUtteranceSilenceTimer = () => {
    if (mode !== 'hands_free' || !handsFreeConversationId || sending || disposed) return
    if (status !== 'listening') return
    clearSilenceTimer()
    silenceTimer = setTimeout(() => {
      // Never finalize while VAD still hears speech energy.
      if (vadSpeaking) {
        bumpUtteranceSilenceTimer()
        return
      }
      const transcript = utteranceBuffer.trim() || partial.trim()
      if (!transcript || !handsFreeConversationId) return
      logPipeline({
        stage: 'stt',
        event: 'utterance_committed',
        meta: { silenceTimeoutMs, length: transcript.length },
      })
      utteranceBuffer = ''
      utterancePrefix = ''
      void sendTranscript(handsFreeConversationId, transcript)
    }, silenceTimeoutMs)
  }

  const ensureMicPermission = async (): Promise<MicrophonePermissionState> => {
    const previousStatus = status
    // Live resume (READY / reconnecting / listening) must not thrash the session
    // through requesting_permission → idle — that fake IDLE was wiping READY and
    // appearing in traces immediately before the next STT_START.
    const liveResume =
      previousStatus === 'ready'
      || previousStatus === 'reconnecting'
      || previousStatus === 'listening'
    if (!liveResume) {
      setStatus('requesting_permission')
      logPipeline({ stage: 'microphone', event: 'permission_request' })
      voiceStage({
        stage: 'MIC_PERMISSION',
        previousState: previousStatus,
        currentState: 'requesting_permission',
        conversationId: handsFreeConversationId,
        meta: { phase: 'start' },
      })
    } else {
      logPipeline({
        stage: 'microphone',
        event: 'permission_recheck',
        meta: { previousStatus, phase: 'live_resume' },
      })
    }
    const state = await requestPermission()
    callbacks.onPermission?.(state)
    if (state.state !== 'granted') {
      setStatus('error')
      logPipeline({
        stage: 'microphone',
        event: 'permission_denied',
        message: state.error ?? 'denied',
      })
      voiceStage({
        stage: 'MIC_PERMISSION',
        success: false,
        previousState: liveResume ? previousStatus : 'requesting_permission',
        currentState: 'ERROR',
        conversationId: handsFreeConversationId,
        reason: state.error ?? state.state,
        recoveryAction: 'allow_microphone_in_safari_settings',
      })
      if (!isBenignChatError(state.error)) {
        callbacks.onError?.(state.error || 'يلزم إذن الميكروفون للمتابعة')
      }
    } else if (!liveResume && status === 'requesting_permission') {
      setStatus('idle')
      logPipeline({ stage: 'microphone', event: 'permission_granted' })
      voiceStage({
        stage: 'MIC_PERMISSION',
        previousState: 'requesting_permission',
        currentState: 'IDLE',
        conversationId: handsFreeConversationId,
        meta: { phase: 'granted' },
      })
    } else if (liveResume) {
      logPipeline({
        stage: 'microphone',
        event: 'permission_granted',
        meta: { previousStatus, phase: 'live_resume' },
      })
    }
    return state
  }

  const startListening = async (
    continuous: boolean,
    opts?: { preserveUtterance?: boolean; reason?: string },
  ) => {
    if (disposed) return
    if (sending || ttsActive) return
    if (!stt.isSupported()) {
      throw new Error('التعرف على الكلام غير متاح')
    }

    // Safari/WebKit: dispose any prior recognition before creating the next instance.
    listenGeneration += 1
    const generation = listenGeneration
    onEndRestartAuthorized = false
    intentionalAbort = true
    stt.abort()
    listening = false

    const permission = await ensureMicPermission()
    if (permission.state !== 'granted') return
    if (disposed || sending || ttsActive || generation !== listenGeneration) return

    if (opts?.preserveUtterance) {
      utterancePrefix = utteranceBuffer.trim()
    } else {
      partial = ''
      utteranceBuffer = ''
      utterancePrefix = ''
    }
    intentionalAbort = false
    listening = true
    activeListenGeneration = generation
    onEndRestartAuthorized = continuous && mode === 'hands_free' && !!handsFreeConversationId
    const keepSilence = !!(opts?.preserveUtterance && utteranceBuffer.trim())
    if (!keepSilence) clearSilenceTimer()
    setStatus('listening')
    sttStartCount += 1
    logPipeline({
      stage: 'stt',
      event: 'listening_started',
      meta: {
        continuous,
        silenceTimeoutMs,
        mode,
        preserveUtterance: !!opts?.preserveUtterance,
        keepSilence,
        reason: opts?.reason ?? 'start',
        listenGeneration: generation,
        sttStartCount,
      },
    })
    void activityMonitor.start()
    await stt.start({
      locale,
      continuous,
      interimResults: true,
    })
    if (disposed || generation !== listenGeneration) {
      intentionalAbort = true
      onEndRestartAuthorized = false
      stt.abort()
      listening = false
      return
    }
    // Browser STT often restarts after a final chunk — keep the end-of-utterance window alive.
    if (keepSilence && mode === 'hands_free' && handsFreeConversationId && !sending) {
      bumpUtteranceSilenceTimer()
    }
  }

  type ListenRestartReason = 'post_turn' | 'onend_recovery' | 'interrupt_resume'

  /**
   * Single authoritative owner for automatic STT restarts.
   * recognition.onend / TTS completion / React effects must not call stt.start directly.
   */
  const requestListenRestart = (opts: {
    reason: ListenRestartReason
    preserveUtterance?: boolean
    delayMs?: number
  }) => {
    if (disposed || mode !== 'hands_free' || !handsFreeConversationId) return
    // onend recovery requires an authorized live listen — unless we already settled READY.
    if (
      opts.reason === 'onend_recovery'
      && !onEndRestartAuthorized
      && status !== 'ready'
    ) {
      return
    }
    if (sending || ttsActive) return

    const token = ++restartToken
    clearRestartTimer()
    const delayMs = opts.delayMs ?? HANDS_FREE_LISTEN_RESTART_MS
    const preserveUtterance = opts.preserveUtterance ?? opts.reason !== 'post_turn'

    restartTimer = setTimeout(() => {
      restartTimer = null
      void (async () => {
        if (token !== restartToken || disposed) return
        if (mode !== 'hands_free' || !handsFreeConversationId) return
        if (sending || ttsActive || listening) return
        if (
          opts.reason === 'onend_recovery'
          && !onEndRestartAuthorized
          && status !== 'ready'
        ) {
          return
        }
        if (opts.reason === 'post_turn' && status !== 'ready') return

        try {
          // Post-turn: keep READY settled until LISTENING.
          // Interrupt / onend recovery may show reconnecting.
          if (opts.reason !== 'post_turn') {
            setStatus('reconnecting')
          }
          await startListening(true, {
            preserveUtterance,
            reason: opts.reason,
          })
          voiceTrace({
            event: 'listening_resumed',
            conversationId: handsFreeConversationId,
            meta: { reason: opts.reason, delayMs },
          })
        } catch (e) {
          diagnosePipelineError('stt', 'resume', e)
          callbacks.onError?.(e instanceof Error ? e.message : 'تعذر استئناف الاستماع')
          // Empty / failed auto-restart must not trap the UI in permanent ERROR.
          setStatus(handsFreeConversationId ? 'ready' : 'idle')
          voiceTrace({
            event: 'failure',
            conversationId: handsFreeConversationId,
            reason: e instanceof Error ? e.message : 'resume_failed',
            meta: { reason: opts.reason },
          })
        }
      })()
    }, delayMs)
  }

  const readSpokenText = (message: ChatMessage): string => {
    const meta = message.providerMeta ?? {}
    return extractSpokenAnswer({
      content: message.content,
      spokenText: typeof meta.spokenText === 'string' ? meta.spokenText : null,
    })
  }

  const speakAloud = async (text: string, phase: string): Promise<boolean> => {
    const spoken = text.trim()
    if (!spoken || disposed) return false
    const realTts = tts.providerId === 'web-speech-tts' && tts.isSupported()
    // Echo protection: never leave recognition running during TTS.
    onEndRestartAuthorized = false
    intentionalAbort = true
    stt.abort()
    listening = false
    stopVad()
    clearSilenceTimer()
    clearRestartTimer()
    ttsActive = true
    logPipeline({ stage: 'tts', event: 'speak_start', meta: { phase, realTts } })
    voiceTrace({
      event: 'tts_started',
      transcriptLen: spoken.length,
      meta: { phase, realTts },
    })
    let ttsOk = false
    try {
      if (!disposed && tts.isSupported()) setStatus('speaking')
      await tts.speak({
        locale,
        text: spoken,
        interrupt: true,
        onStart: () => {
          if (!disposed) setStatus('speaking')
        },
      })
      ttsOk = true
      logPipeline({ stage: 'tts', event: 'speak_done', meta: { phase, realTts } })
      voiceTrace({ event: 'tts_ended', transcriptLen: spoken.length, meta: { phase } })
    } catch (e) {
      if (!isBenignChatError(e) && !disposed) {
        diagnosePipelineError('tts', phase, e)
        // Surface the failure without trapping the session in ERROR —
        // written assistant response stays visible; caller moves to READY.
        callbacks.onError?.(e instanceof Error ? e.message : 'تعذر تشغيل الصوت')
        voiceTrace({
          event: 'failure',
          reason: e instanceof Error ? e.message : 'tts_failed',
          meta: { phase },
        })
      }
    } finally {
      ttsActive = false
    }
    return ttsOk
  }

  const sendTranscript = async (conversationId: string, transcript: string): Promise<ChatMessage | null> => {
    const content = transcript.trim()
    if (!content || sending || disposed) {
      const reason = !content
        ? 'chat_request_skipped_empty'
        : disposed
          ? 'chat_request_skipped_disposed'
          : 'chat_request_skipped_already_sending'
      voiceStage({
        stage: 'FAILURE',
        success: false,
        conversationId,
        reason,
        previousState: status.toUpperCase(),
        currentState: !content
          ? (mode === 'hands_free' && handsFreeConversationId ? 'LISTENING' : 'IDLE')
          : status.toUpperCase(),
        recoveryAction: !content ? 'retry_mic_or_type' : 'wait_then_retry',
        transcriptLen: content.length,
        preview: content || undefined,
        meta: { failedStage: 'CHAT_REQUEST', recoverable: Boolean(content) },
      })
      if (!content) setStatus(mode === 'hands_free' && handsFreeConversationId ? 'listening' : 'idle')
      return null
    }

    const submitKey = content.replace(/\s+/g, ' ')
    const now = Date.now()
    if (submitKey === lastSubmittedKey && now - lastSubmittedAt < 4000) {
      logPipeline({ stage: 'conversation', event: 'duplicate_transcript_ignored', meta: { length: content.length } })
      voiceStage({
        stage: 'FAILURE',
        success: false,
        conversationId,
        reason: 'chat_request_skipped_duplicate',
        previousState: status.toUpperCase(),
        currentState: status.toUpperCase(),
        recoveryAction: 'wait_or_rephrase',
        transcriptLen: content.length,
        preview: content,
        meta: { failedStage: 'CHAT_REQUEST', recoverable: true },
      })
      return null
    }
    lastSubmittedKey = submitKey
    lastSubmittedAt = now

    sending = true
    clearSilenceTimer()
    stopVad()
    setStatus('thinking')
    intentionalAbort = true
    stt.abort()
    listening = false
    utteranceBuffer = ''
    utterancePrefix = ''
    earlySpokenText = ''
    earlySpeakPromise = null
    // Echo protection — clear live caption so TTS is never treated as user speech.
    partial = ''
    callbacks.onPartialTranscript?.('')
    activeAbort?.abort()
    const controller = new AbortController()
    activeAbort = controller
    let sawDelta = false

    logPipeline({
      stage: 'conversation',
      event: 'turn_send_started',
      meta: { conversationId, modality: 'audio', length: content.length },
    })
    voiceStage({
      stage: 'CHAT_REQUEST',
      conversationId,
      transcriptLen: content.length,
      preview: content,
      previousState: 'THINKING',
      currentState: 'THINKING',
      meta: { modality: 'audio', path: 'sendTranscript' },
    })
    thinkingEvidence('CHAT_REQUEST', {
      conversationId,
      reactState: {
        voiceStatus: status,
        waitingComponent: 'VoiceSession.sendTranscript→chatEngine.sendMessage',
      },
      meta: { modality: 'audio', path: 'sendTranscript', contentLen: content.length },
    })
    voiceTrace({
      event: 'chat_engine_started',
      conversationId,
      transcriptLen: content.length,
      meta: { modality: 'audio' },
    })

    const handlers: StreamHandlers = {
      signal: controller.signal,
      onAssistantCreate: (message) => {
        setThinkingEvidenceContext({
          conversationId,
          assistantMessageId: message.id,
        })
        thinkingEvidence('MESSAGE_ADDED', {
          conversationId,
          assistantMessageId: message.id,
          reactState: {
            voiceStatus: status,
            waitingComponent: 'onAssistantCreate→ChatPage.upsertMessage',
          },
          meta: { role: message.role, status: message.status, phase: 'assistant_seed' },
        })
        if (!sawDelta) setStatus('thinking')
        callbacks.onAssistantCreate?.(message)
      },
      onDelta: (message) => {
        if (!sawDelta) {
          sawDelta = true
          setStatus('responding')
          logPipeline({ stage: 'streaming', event: 'first_delta' })
        }
        setThinkingEvidenceContext({ assistantMessageId: message.id })
        callbacks.onDelta?.(message)

        // Start speaking as soon as a spoken bridge/summary is available.
        const phase = message.providerMeta?.voicePhase
        const spoken = typeof message.providerMeta?.spokenText === 'string'
          ? message.providerMeta.spokenText.trim()
          : ''
        if (
          spoken
          && spoken !== earlySpokenText
          && !controller.signal.aborted
          && !disposed
          && !earlySpeakPromise
        ) {
          earlySpokenText = spoken
          earlySpeakPromise = speakAloud(spoken, String(phase ?? 'bridge'))
        }
      },
      onComplete: async (message) => {
        setThinkingEvidenceContext({
          conversationId,
          assistantMessageId: message.id,
        })
        thinkingEvidence('CHAT_RESPONSE', {
          conversationId,
          assistantMessageId: message.id,
          reactState: {
            voiceStatus: status,
            waitingComponent: 'VoiceSession.onComplete',
          },
          meta: {
            contentLen: message.content.length,
            status: message.status,
          },
        })
        thinkingEvidence('ASSISTANT_RENDERED', {
          conversationId,
          assistantMessageId: message.id,
          reactState: {
            voiceStatus: status,
            waitingComponent: 'VoiceSession.onComplete→callbacks.onComplete',
          },
          meta: {
            phase: 'session_onComplete_before_ui_callback',
            contentLen: message.content.length,
          },
        })
        callbacks.onComplete?.(message)
        logPipeline({
          stage: 'ai',
          event: 'turn_complete',
          meta: { length: message.content.length },
        })
        voiceTrace({
          event: 'assistant_message_committed',
          conversationId,
          transcriptLen: message.content.length,
        })
        voiceTrace({
          event: 'chat_engine_completed',
          conversationId,
          transcriptLen: message.content.length,
        })
        if (!controller.signal.aborted && !disposed) {
          const spoken = readSpokenText(message)
          if (spoken) {
            if (spoken !== earlySpokenText || !earlySpeakPromise) {
              await speakAloud(spoken, 'final')
            } else if (earlySpeakPromise) {
              await earlySpeakPromise
            }
          }
        }
        sending = false
        activeAbort = null
        earlySpokenText = ''
        earlySpeakPromise = null
        if (disposed) return
        // Deterministic post-turn settle: SPEAKING/TTS_END → READY, then one authorized restart.
        setStatus(mode === 'hands_free' && handsFreeConversationId ? 'ready' : 'idle')
        if (mode === 'hands_free' && handsFreeConversationId) {
          const interrupted = resumeHandsFreeAfterInterrupt
          resumeHandsFreeAfterInterrupt = false
          requestListenRestart({
            reason: interrupted ? 'interrupt_resume' : 'post_turn',
            preserveUtterance: false,
          })
        }
      },
      onError: (message, error) => {
        sending = false
        activeAbort = null
        earlySpokenText = ''
        earlySpeakPromise = null
        ttsActive = false
        callbacks.onStreamError?.(message, error)
        if (!isBenignChatError(error)) {
          diagnosePipelineError('streaming', 'assistant_stream', error)
          callbacks.onError?.(error)
          setStatus('error')
        } else {
          setStatus(handsFreeConversationId ? 'ready' : 'idle')
          if (resumeHandsFreeAfterInterrupt) {
            resumeHandsFreeAfterInterrupt = false
            requestListenRestart({ reason: 'interrupt_resume', preserveUtterance: false })
          }
        }
      },
    }

    try {
      voiceTrace({
        event: 'user_message_committed',
        conversationId,
        transcriptLen: content.length,
        preview: content,
      })
      const result = await sendTurn({
        conversationId,
        content,
        modality: 'audio',
        audioUrl: null,
      }, handlers)
      return result.assistant
    } catch (e) {
      sending = false
      activeAbort = null
      earlySpokenText = ''
      earlySpeakPromise = null
      ttsActive = false
      if (!isBenignChatError(e)) {
        const app = diagnosePipelineError('conversation', 'send_turn', e)
        callbacks.onError?.(app.userMessage)
        setStatus('error')
      } else {
        setStatus(handsFreeConversationId ? 'ready' : 'idle')
        if (resumeHandsFreeAfterInterrupt) {
          resumeHandsFreeAfterInterrupt = false
          requestListenRestart({ reason: 'interrupt_resume', preserveUtterance: false })
        }
      }
      return null
    }
  }

  stt.onPartial = (event) => {
    if (disposed) return
    const chunk = event.transcript
    partial = utterancePrefix ? `${utterancePrefix} ${chunk}`.trim() : chunk
    callbacks.onPartialTranscript?.(partial)
    // Live speech → reset end-of-utterance timer (tolerate short pauses).
    if (mode === 'hands_free' && status === 'listening') {
      bumpUtteranceSilenceTimer()
    }
  }
  stt.onFinal = (event) => {
    if (disposed) return
    const chunk = event.transcript.trim()
    if (!chunk) return
    // Accumulate across STT restarts; never auto-send mid-sentence.
    utteranceBuffer = utterancePrefix
      ? `${utterancePrefix} ${chunk}`.trim()
      : chunk
    partial = utteranceBuffer
    callbacks.onFinalTranscript?.(utteranceBuffer)
    callbacks.onPartialTranscript?.(utteranceBuffer)
    if (
      mode === 'hands_free'
      && handsFreeConversationId
      && !sending
      && status === 'listening'
    ) {
      bumpUtteranceSilenceTimer()
    }
  }
  stt.onError = (error) => {
    if (disposed || intentionalAbort || isBenignChatError(error) || error === 'aborted') {
      return
    }
    // Empty / no-speech during authorized listen: recover to READY, not permanent ERROR.
    if (
      mode === 'hands_free'
      && handsFreeConversationId
      && (error === 'no-speech' || error === 'stt_no_result_watchdog')
    ) {
      listening = false
      onEndRestartAuthorized = false
      callbacks.onError?.(mapSttError(error))
      setStatus('ready')
      requestListenRestart({ reason: 'onend_recovery', preserveUtterance: true })
      return
    }
    diagnosePipelineError('stt', 'recognition', new Error(error))
    callbacks.onError?.(mapSttError(error))
    setStatus('error')
  }

  stt.onEnd = () => {
    const endedGeneration = activeListenGeneration
    listening = false
    if (disposed) return
    // Intentional abort (send / TTS / stop / replace) must never auto-restart.
    if (intentionalAbort) return
    // Stale callback from a disposed prior recognition instance.
    if (endedGeneration !== listenGeneration) return
    if (!onEndRestartAuthorized) return
    if (sending || ttsActive) return

    if (mode === 'hands_free' && handsFreeConversationId) {
      // A final transcript is waiting on the silence timer — do not thrash-restart STT.
      if (utteranceBuffer.trim() && silenceTimer) {
        emptyEndRestarts = 0
        logPipeline({
          stage: 'stt',
          event: 'recognition_ended_awaiting_silence_commit',
          meta: { length: utteranceBuffer.trim().length },
        })
        return
      }
      // Empty recognition ends (no speech) — never treat as a user turn / Thinking.
      const now = Date.now()
      if (!emptyEndWindowStartedAt || now - emptyEndWindowStartedAt > 5000) {
        emptyEndWindowStartedAt = now
        emptyEndRestarts = 0
      }
      emptyEndRestarts += 1
      if (emptyEndRestarts > 4) {
        logPipeline({
          stage: 'stt',
          event: 'recognition_empty_end_backoff',
          meta: { emptyEndRestarts },
        })
        onEndRestartAuthorized = false
        setStatus('ready')
        requestListenRestart({
          reason: 'onend_recovery',
          preserveUtterance: true,
          delayMs: 1500,
        })
        return
      }
      // Sole path: session manager schedules the next listen (not immediate stt.start).
      requestListenRestart({ reason: 'onend_recovery', preserveUtterance: true })
      return
    }
    if (status === 'listening') setStatus('idle')
  }

  return {
    getStatus: () => status,
    getMode: () => mode,
    getLocale: () => locale,
    getPartialTranscript: () => partial,
    getLevel: () => level,
    setMode(next) {
      mode = next
      if (next !== 'hands_free') {
        handsFreeConversationId = null
        resumeHandsFreeAfterInterrupt = false
        invalidateListenRestarts()
        clearSilenceTimer()
        utteranceBuffer = ''
        utterancePrefix = ''
      }
    },
    setLocale(next) {
      locale = normalizeVoiceLocale(next)
    },
    setSilenceTimeoutMs(ms) {
      silenceTimeoutMs = clampSilenceMs(ms)
      logPipeline({
        stage: 'stt',
        event: 'silence_timeout_configured',
        meta: { silenceTimeoutMs },
      })
    },
    ensureMicPermission,
    async startPushToTalk() {
      if (disposed) return
      tts.stop()
      ttsActive = false
      invalidateListenRestarts()
      mode = 'push_to_talk'
      handsFreeConversationId = null
      resumeHandsFreeAfterInterrupt = false
      clearSilenceTimer()
      utteranceBuffer = ''
      utterancePrefix = ''
      await startListening(false, { reason: 'push_to_talk' })
    },
    async stopPushToTalkAndSend(conversationId) {
      if (disposed) return null
      invalidateListenRestarts()
      intentionalAbort = true
      clearSilenceTimer()
      stopVad()
      const transcript = ((await stt.stop()) || utteranceBuffer || partial).trim()
      listening = false
      utteranceBuffer = ''
      utterancePrefix = ''
      callbacks.onFinalTranscript?.(transcript)
      return sendTranscript(conversationId, transcript)
    },
    async startHandsFree(conversationId) {
      if (disposed) return
      tts.stop()
      ttsActive = false
      invalidateListenRestarts()
      mode = 'hands_free'
      handsFreeConversationId = conversationId
      resumeHandsFreeAfterInterrupt = false
      clearSilenceTimer()
      utteranceBuffer = ''
      utterancePrefix = ''
      await startListening(true, { reason: 'start_hands_free' })
    },
    async beginContinuousWithSeed(conversationId, content) {
      if (disposed) return null
      tts.stop()
      ttsActive = false
      invalidateListenRestarts()
      mode = 'hands_free'
      handsFreeConversationId = conversationId
      resumeHandsFreeAfterInterrupt = false
      clearSilenceTimer()
      utteranceBuffer = ''
      utterancePrefix = ''
      intentionalAbort = true
      stt.abort()
      listening = false
      stopVad()
      // Same pipeline as mic silence commit — no second CTA.
      return sendTranscript(conversationId, content)
    },
    async stopListening() {
      intentionalAbort = true
      resumeHandsFreeAfterInterrupt = false
      handsFreeConversationId = null
      invalidateListenRestarts()
      clearSilenceTimer()
      utteranceBuffer = ''
      utterancePrefix = ''
      stopVad()
      ttsActive = false
      if (listening) {
        try {
          await stt.stop()
        } catch {
          stt.abort()
        }
      } else {
        stt.abort()
      }
      listening = false
      if (
        status === 'listening'
        || status === 'reconnecting'
        || status === 'thinking'
        || status === 'responding'
        || status === 'speaking'
        || status === 'ready'
      ) {
        setStatus('idle')
      }
    },
    interrupt(abortStream, opts) {
      intentionalAbort = true
      ttsActive = false
      clearSilenceTimer()
      stopVad()
      const keepHandsFree = opts?.resumeHandsFree ?? (mode === 'hands_free' && !!handsFreeConversationId)
      const wasSending = sending
      invalidateListenRestarts()
      tts.stop()
      stt.abort()
      listening = false
      sending = false
      utteranceBuffer = ''
      utterancePrefix = ''
      activeAbort?.abort()
      activeAbort = null
      abortStream?.()
      logPipeline({ stage: 'voice', event: 'interrupted', meta: { keepHandsFree, wasSending } })
      if (keepHandsFree && wasSending) {
        resumeHandsFreeAfterInterrupt = true
        setStatus('ready')
      } else if (keepHandsFree) {
        resumeHandsFreeAfterInterrupt = false
        setStatus('ready')
        requestListenRestart({ reason: 'interrupt_resume', preserveUtterance: false })
      } else {
        resumeHandsFreeAfterInterrupt = false
        setStatus('idle')
      }
    },
    async speakText(text) {
      if (disposed) return
      try {
        await speakAloud(stripMarkdownForSpeech(text), 'speakText')
      } catch (e) {
        if (!isBenignChatError(e)) throw e
      }
      if (!disposed && (status === 'speaking' || status === 'ready')) {
        setStatus(handsFreeConversationId ? 'ready' : 'idle')
      }
    },
    dispose() {
      disposed = true
      intentionalAbort = true
      resumeHandsFreeAfterInterrupt = false
      handsFreeConversationId = null
      ttsActive = false
      invalidateListenRestarts()
      clearSilenceTimer()
      clearThinkingWatchdog()
      utteranceBuffer = ''
      utterancePrefix = ''
      stopVad()
      tts.stop()
      stt.abort()
      activeAbort?.abort()
      activeAbort = null
      clearSttHandlers()
      status = 'idle'
    },
  }
}

function mapSttError(error: string): string {
  if (error === 'not-allowed' || error === 'permission_denied') return 'تم رفض إذن الميكروفون'
  if (error === 'no-speech') return 'لم يتم التقاط كلام — حاول مجدداً'
  if (error === 'network') return 'مشكلة شبكة في التعرف على الكلام'
  if (error === 'aborted') return 'تم إيقاف الاستماع'
  return error || 'خطأ في التعرف على الكلام'
}
