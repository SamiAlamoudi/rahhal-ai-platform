/**
 * Voice session orchestrator (shared chatEngine only).
 * Recovery Phase 2.3 — continuous conversation loop, READY/ENDED states,
 * speaking only when real TTS audio plays, speech cleanup before send.
 */

import { chatEngine, type StreamHandlers } from '../chatEngine'
import type { ChatMessage } from '../chatTypes'
import { isBenignChatError } from '../chatLogger'
import { logPipeline, diagnosePipelineError } from '../pipelineDiagnostics'
import { createSpeechToTextProvider, createTextToSpeechProvider } from './voiceProviderFactory'
import { queryMicrophonePermission, requestMicrophoneAccess } from './microphonePermission'
import { createVoiceActivityMonitor, type VoiceActivityMonitor } from './voiceActivityMonitor'
import { processSpeechTranscript } from './speechCleanup'
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
  DEFAULT_READY_HOLD_MS,
  DEFAULT_VOICE_INACTIVITY_MS,
  MAX_HANDS_FREE_SILENCE_MS,
  MIN_HANDS_FREE_SILENCE_MS,
  isRealTtsProvider,
  normalizeVoiceLocale,
} from './voiceTypes'

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
  onLevel?: (level: number) => void
  /**
   * Low-confidence recognition — never guess via Conversation Brain.
   */
  onNeedsClarification?: (prompt: string) => void
}

export interface VoiceSession {
  getStatus: () => VoiceSessionStatus
  getMode: () => VoiceInputMode
  getLocale: () => VoiceLocale
  getPartialTranscript: () => string
  getLevel: () => number
  isContinuousActive: () => boolean
  isRealTtsAvailable: () => boolean
  setMode: (mode: VoiceInputMode) => void
  setLocale: (locale: VoiceLocale) => void
  setSilenceTimeoutMs: (ms: number) => void
  setInactivityTimeoutMs: (ms: number) => void
  ensureMicPermission: () => Promise<MicrophonePermissionState>
  /** Continuous mode — one tap starts the persistent voice session. */
  startContinuous: (conversationId: string) => Promise<void>
  /** Explicit stop — prevents automatic restart. */
  stopSession: () => Promise<void>
  startPushToTalk: () => Promise<void>
  stopPushToTalkAndSend: (conversationId: string) => Promise<ChatMessage | null>
  startHandsFree: (conversationId: string) => Promise<void>
  stopListening: () => Promise<void>
  /**
   * Interrupt only when assistant TTS audio is actually playing.
   * Returns false when there is nothing to barge-in on.
   */
  interrupt: (abortStream?: () => void, opts?: { resumeHandsFree?: boolean }) => boolean
  /** Cancel an in-flight turn (processing) without ending the continuous session. */
  cancelInFlight: (abortStream?: () => void) => void
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
  silenceTimeoutMs?: number
  inactivityTimeoutMs?: number
  readyHoldMs?: number
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
  const realTts = isRealTtsProvider(tts)

  let status: VoiceSessionStatus = 'idle'
  let mode: VoiceInputMode = options.mode ?? 'hands_free'
  let locale: VoiceLocale = normalizeVoiceLocale(options.locale)
  let partial = ''
  let level = 0
  let disposed = false
  let continuousActive = false
  let handsFreeConversationId: string | null = null
  let activeAbort: AbortController | null = null
  let sending = false
  let intentionalAbort = false
  let resumeHandsFreeAfterInterrupt = false
  let silenceTimeoutMs = clampSilenceMs(
    options.silenceTimeoutMs ?? DEFAULT_HANDS_FREE_SILENCE_MS,
  )
  let inactivityTimeoutMs = Math.max(
    5_000,
    options.inactivityTimeoutMs ?? DEFAULT_VOICE_INACTIVITY_MS,
  )
  let readyHoldMs = Math.max(0, options.readyHoldMs ?? DEFAULT_READY_HOLD_MS)
  let utteranceBuffer = ''
  let utterancePrefix = ''
  let utteranceConfidenceSamples: number[] = []
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null
  let readyTimer: ReturnType<typeof setTimeout> | null = null
  let vadSpeaking = false
  let earlySpokenText = ''
  let earlySpeakPromise: Promise<void> | null = null
  let lastSubmittedKey = ''
  let lastSubmittedAt = 0
  let generation = 0

  const activityMonitor =
    options.activityMonitor
    ?? createVoiceActivityMonitor({
      onLevel: (value) => {
        level = value
        callbacks.onLevel?.(value)
      },
      onSpeakingChange: (speakingNow) => {
        vadSpeaking = speakingNow
        if (speakingNow && mode === 'hands_free' && status === 'listening') {
          bumpUtteranceSilenceTimer()
          bumpInactivityTimer()
        }
      },
      log: (entry) => logPipeline({ stage: 'microphone', event: String(entry.event), meta: entry }),
    })

  const setStatus = (next: VoiceSessionStatus) => {
    if (disposed) return
    status = next
    callbacks.onStatus?.(next)
  }

  const clearSilenceTimer = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  const clearInactivityTimer = () => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
      inactivityTimer = null
    }
  }

  const clearReadyTimer = () => {
    if (readyTimer) {
      clearTimeout(readyTimer)
      readyTimer = null
    }
  }

  const clearAllTimers = () => {
    clearSilenceTimer()
    clearInactivityTimer()
    clearReadyTimer()
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

  const clearLiveTranscript = () => {
    partial = ''
    callbacks.onPartialTranscript?.('')
    callbacks.onFinalTranscript?.('')
  }

  const bumpInactivityTimer = () => {
    clearInactivityTimer()
    if (!continuousActive || disposed || sending) return
    if (status !== 'listening' && status !== 'ready') return
    inactivityTimer = setTimeout(() => {
      if (disposed || !continuousActive || sending) return
      if (vadSpeaking || utteranceBuffer.trim() || partial.trim()) {
        bumpInactivityTimer()
        return
      }
      logPipeline({ stage: 'voice', event: 'inactivity_ended', meta: { inactivityTimeoutMs } })
      void endSession('inactivity')
    }, inactivityTimeoutMs)
  }

  const bumpUtteranceSilenceTimer = () => {
    if (mode !== 'hands_free' || !handsFreeConversationId || sending || disposed) return
    if (!continuousActive && mode === 'hands_free' && !handsFreeConversationId) return
    if (status !== 'listening') return
    clearSilenceTimer()
    bumpInactivityTimer()
    silenceTimer = setTimeout(() => {
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
    setStatus('requesting_permission')
    logPipeline({ stage: 'microphone', event: 'permission_request' })
    const state = await requestPermission()
    callbacks.onPermission?.(state)
    if (state.state !== 'granted') {
      setStatus('error')
      continuousActive = false
      logPipeline({
        stage: 'microphone',
        event: 'permission_denied',
        message: state.error ?? 'denied',
      })
      if (!isBenignChatError(state.error)) {
        callbacks.onError?.(state.error || 'يلزم إذن الميكروفون للمتابعة')
      }
    } else if (status === 'requesting_permission') {
      setStatus('idle')
      logPipeline({ stage: 'microphone', event: 'permission_granted' })
    }
    return state
  }

  const startListening = async (continuous: boolean, opts?: { preserveUtterance?: boolean }) => {
    if (disposed) return
    if (!stt.isSupported()) {
      throw new Error('التعرف على الكلام غير متاح في هذا المتصفح — يمكنك الكتابة بدلًا من ذلك')
    }
    const permission = await ensureMicPermission()
    if (permission.state !== 'granted') return
    if (opts?.preserveUtterance) {
      utterancePrefix = utteranceBuffer.trim()
    } else {
      partial = ''
      utteranceBuffer = ''
      utterancePrefix = ''
      utteranceConfidenceSamples = []
      callbacks.onPartialTranscript?.('')
    }
    intentionalAbort = false
    clearSilenceTimer()
    clearReadyTimer()
    setStatus('listening')
    bumpInactivityTimer()
    logPipeline({
      stage: 'stt',
      event: 'listening_started',
      meta: { continuous, silenceTimeoutMs, mode, preserveUtterance: !!opts?.preserveUtterance },
    })
    void activityMonitor.start()
    await stt.start({
      locale,
      continuous,
      interimResults: true,
    })
  }

  const maybeResumeHandsFree = async (token: number) => {
    if (disposed || token !== generation) return
    if (!continuousActive || mode !== 'hands_free' || !handsFreeConversationId) return
    try {
      setStatus('reconnecting')
      await startListening(true, { preserveUtterance: true })
    } catch (e) {
      if (token !== generation || disposed) return
      diagnosePipelineError('stt', 'resume', e)
      callbacks.onError?.(e instanceof Error ? e.message : 'تعذر استئناف الاستماع')
      setStatus('error')
      continuousActive = false
    }
  }

  const enterReadyThenListen = async (token: number) => {
    if (disposed || token !== generation) return
    if (!continuousActive || mode !== 'hands_free' || !handsFreeConversationId) {
      setStatus(continuousActive ? 'ready' : 'idle')
      return
    }
    setStatus('ready')
    bumpInactivityTimer()
    clearReadyTimer()
    if (readyHoldMs <= 0) {
      await maybeResumeHandsFree(token)
      return
    }
    await new Promise<void>((resolve) => {
      readyTimer = setTimeout(() => resolve(), readyHoldMs)
    })
    if (disposed || token !== generation || !continuousActive) return
    await maybeResumeHandsFree(token)
  }

  const readSpokenText = (message: ChatMessage): string => {
    const meta = message.providerMeta ?? {}
    const spoken = typeof meta.spokenText === 'string' ? meta.spokenText.trim() : ''
    if (spoken) return spoken
    return stripMarkdownForSpeech(message.content).slice(0, 320)
  }

  const averageUtteranceConfidence = (): number | null => {
    if (!utteranceConfidenceSamples.length) return null
    const sum = utteranceConfidenceSamples.reduce((a, b) => a + b, 0)
    return sum / utteranceConfidenceSamples.length
  }

  const presentClarification = async (prompt: string) => {
    const token = generation
    clearSilenceTimer()
    stopVad()
    intentionalAbort = true
    stt.abort()
    utteranceBuffer = ''
    utterancePrefix = ''
    utteranceConfidenceSamples = []
    clearLiveTranscript()
    if (realTts) {
      setStatus('speaking')
      callbacks.onNeedsClarification?.(prompt)
      try {
        await tts.speak({ locale, text: prompt, interrupt: true })
      } catch (e) {
        if (!isBenignChatError(e) && !disposed) {
          diagnosePipelineError('tts', 'clarify', e)
        }
      }
    } else {
      callbacks.onNeedsClarification?.(prompt)
    }
    if (disposed || token !== generation) return
    await enterReadyThenListen(token)
  }

  const isDuplicateSubmit = (content: string): boolean => {
    const key = content.replace(/\s+/g, ' ').trim()
    const now = Date.now()
    if (key && key === lastSubmittedKey && now - lastSubmittedAt < 4_000) {
      return true
    }
    return false
  }

  const markSubmitted = (content: string) => {
    lastSubmittedKey = content.replace(/\s+/g, ' ').trim()
    lastSubmittedAt = Date.now()
  }

  const sendTranscript = async (conversationId: string, transcript: string): Promise<ChatMessage | null> => {
    const raw = transcript.trim()
    if (!raw || sending || disposed) {
      if (!raw && continuousActive && handsFreeConversationId) setStatus('listening')
      else if (!raw) setStatus(continuousActive ? 'ready' : 'idle')
      return null
    }

    const cleaned = processSpeechTranscript(raw, {
      uiLocale: locale,
      confidence: averageUtteranceConfidence(),
    })
    utteranceConfidenceSamples = []

    if (cleaned.needsClarification && cleaned.clarificationPrompt) {
      await presentClarification(cleaned.clarificationPrompt)
      return null
    }

    const content = cleaned.text.trim()
    if (!content) {
      clearLiveTranscript()
      if (continuousActive && handsFreeConversationId) {
        await enterReadyThenListen(generation)
      } else {
        setStatus('idle')
      }
      return null
    }

    if (isDuplicateSubmit(content)) {
      logPipeline({ stage: 'conversation', event: 'duplicate_transcript_ignored', meta: { length: content.length } })
      clearLiveTranscript()
      if (continuousActive && handsFreeConversationId) {
        await enterReadyThenListen(generation)
      }
      return null
    }

    const token = generation
    sending = true
    markSubmitted(content)
    clearSilenceTimer()
    clearInactivityTimer()
    stopVad()
    setStatus('processing')
    intentionalAbort = true
    stt.abort()
    utteranceBuffer = ''
    utterancePrefix = ''
    clearLiveTranscript()
    earlySpokenText = ''
    earlySpeakPromise = null
    activeAbort?.abort()
    const controller = new AbortController()
    activeAbort = controller
    let sawDelta = false

    logPipeline({
      stage: 'conversation',
      event: 'turn_send_started',
      meta: {
        conversationId,
        modality: 'audio',
        length: content.length,
        speechLanguage: cleaned.language,
        confidence: cleaned.confidence,
      },
    })

    const handlers: StreamHandlers = {
      signal: controller.signal,
      onAssistantCreate: (message) => {
        if (!sawDelta) setStatus('processing')
        callbacks.onAssistantCreate?.(message)
      },
      onDelta: (message) => {
        if (!sawDelta) {
          sawDelta = true
          setStatus('processing')
          logPipeline({ stage: 'streaming', event: 'first_delta' })
        }
        callbacks.onDelta?.(message)

        const phase = message.providerMeta?.voicePhase
        const spoken = typeof message.providerMeta?.spokenText === 'string'
          ? message.providerMeta.spokenText.trim()
          : ''
        if (
          realTts
          && spoken
          && spoken !== earlySpokenText
          && !controller.signal.aborted
          && !disposed
          && !earlySpeakPromise
          && token === generation
        ) {
          earlySpokenText = spoken
          setStatus('speaking')
          logPipeline({ stage: 'tts', event: 'speak_start', meta: { phase: phase ?? 'final' } })
          earlySpeakPromise = tts.speak({ locale, text: spoken, interrupt: true })
            .catch((e) => {
              if (!isBenignChatError(e) && !disposed) {
                diagnosePipelineError('tts', 'speak_early', e)
              }
            })
            .then(() => {
              logPipeline({ stage: 'tts', event: 'speak_done', meta: { phase: phase ?? 'final' } })
            })
        }
      },
      onComplete: async (message) => {
        callbacks.onComplete?.(message)
        logPipeline({
          stage: 'ai',
          event: 'turn_complete',
          meta: { length: message.content.length },
        })
        if (!controller.signal.aborted && !disposed && token === generation) {
          const spoken = readSpokenText(message)
          if (spoken && realTts) {
            setStatus('speaking')
            try {
              if (spoken !== earlySpokenText || !earlySpeakPromise) {
                logPipeline({ stage: 'tts', event: 'speak_start', meta: { phase: 'final' } })
                await tts.speak({ locale, text: spoken, interrupt: true })
                logPipeline({ stage: 'tts', event: 'speak_done', meta: { phase: 'final' } })
              } else if (earlySpeakPromise) {
                await earlySpeakPromise
              }
            } catch (e) {
              if (!isBenignChatError(e) && !disposed) {
                diagnosePipelineError('tts', 'speak', e)
                callbacks.onError?.(e instanceof Error ? e.message : 'تعذر تشغيل الرد الصوتي')
              }
            }
          } else if (spoken && !realTts) {
            // Mock / unsupported TTS: never claim "Speaking".
            try {
              await tts.speak({ locale, text: spoken, interrupt: true })
            } catch {
              // ignore mock TTS failures
            }
          }
        }
        sending = false
        activeAbort = null
        earlySpokenText = ''
        earlySpeakPromise = null
        if (controller.signal.aborted || disposed || token !== generation) {
          if (!disposed && token === generation) {
            setStatus(continuousActive ? 'ready' : 'idle')
            if (resumeHandsFreeAfterInterrupt) {
              resumeHandsFreeAfterInterrupt = false
              await enterReadyThenListen(token)
            }
          }
          return
        }
        if (resumeHandsFreeAfterInterrupt) {
          resumeHandsFreeAfterInterrupt = false
        }
        await enterReadyThenListen(token)
      },
      onError: (message, error) => {
        sending = false
        activeAbort = null
        earlySpokenText = ''
        earlySpeakPromise = null
        callbacks.onStreamError?.(message, error)
        if (!isBenignChatError(error)) {
          diagnosePipelineError('streaming', 'assistant_stream', error)
          callbacks.onError?.(error)
          setStatus('error')
          // Recoverable — stay continuous-capable but stop mic until retry.
          continuousActive = false
          handsFreeConversationId = null
        } else if (token === generation) {
          if (resumeHandsFreeAfterInterrupt) {
            resumeHandsFreeAfterInterrupt = false
            void enterReadyThenListen(token)
          } else {
            void enterReadyThenListen(token)
          }
        }
      },
    }

    try {
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
      if (!isBenignChatError(e)) {
        const app = diagnosePipelineError('conversation', 'send_turn', e)
        callbacks.onError?.(app.userMessage)
        setStatus('error')
        continuousActive = false
        handsFreeConversationId = null
      } else if (token === generation) {
        if (resumeHandsFreeAfterInterrupt) {
          resumeHandsFreeAfterInterrupt = false
          void enterReadyThenListen(token)
        } else {
          void enterReadyThenListen(token)
        }
      }
      return null
    }
  }

  const endSession = async (reason: 'user' | 'inactivity' | 'dispose') => {
    generation += 1
    continuousActive = false
    intentionalAbort = true
    resumeHandsFreeAfterInterrupt = false
    handsFreeConversationId = null
    clearAllTimers()
    utteranceBuffer = ''
    utterancePrefix = ''
    utteranceConfidenceSamples = []
    stopVad()
    tts.stop()
    stt.abort()
    activeAbort?.abort()
    activeAbort = null
    sending = false
    clearLiveTranscript()
    if (reason === 'dispose' || disposed) {
      setStatus('idle')
      return
    }
    setStatus('ended')
    logPipeline({ stage: 'voice', event: 'session_ended', meta: { reason } })
  }

  stt.onPartial = (event) => {
    if (disposed) return
    const chunk = event.transcript
    if (typeof event.confidence === 'number' && event.confidence > 0) {
      utteranceConfidenceSamples.push(event.confidence)
    }
    partial = utterancePrefix ? `${utterancePrefix} ${chunk}`.trim() : chunk
    callbacks.onPartialTranscript?.(partial)
    if (mode === 'hands_free' && status === 'listening') {
      bumpUtteranceSilenceTimer()
    }
  }
  stt.onFinal = (event) => {
    if (disposed) return
    const chunk = event.transcript.trim()
    if (!chunk) return
    if (typeof event.confidence === 'number' && event.confidence > 0) {
      utteranceConfidenceSamples.push(event.confidence)
    }
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
      && continuousActive
    ) {
      bumpUtteranceSilenceTimer()
    }
  }
  stt.onError = (error) => {
    if (disposed || intentionalAbort || isBenignChatError(error) || error === 'aborted') {
      return
    }
    // no-speech: recover to listening in continuous mode instead of hard error
    if (error === 'no-speech' && continuousActive && handsFreeConversationId && !sending) {
      logPipeline({ stage: 'stt', event: 'no_speech_recover' })
      void maybeResumeHandsFree(generation)
      return
    }
    diagnosePipelineError('stt', 'recognition', new Error(error))
    callbacks.onError?.(mapSttError(error))
    setStatus('error')
    continuousActive = false
    clearAllTimers()
    stopVad()
    stt.abort()
  }
  stt.onEnd = () => {
    if (disposed) return
    if (status === 'listening' && continuousActive && mode === 'hands_free' && handsFreeConversationId && !sending) {
      void maybeResumeHandsFree(generation)
      return
    }
    if (status === 'listening' && mode !== 'hands_free') setStatus('idle')
  }

  return {
    getStatus: () => status,
    getMode: () => mode,
    getLocale: () => locale,
    getPartialTranscript: () => partial,
    getLevel: () => level,
    isContinuousActive: () => continuousActive,
    isRealTtsAvailable: () => realTts,
    setMode(next) {
      mode = next
      if (next !== 'hands_free') {
        continuousActive = false
        handsFreeConversationId = null
        resumeHandsFreeAfterInterrupt = false
        clearAllTimers()
        utteranceBuffer = ''
        utterancePrefix = ''
        utteranceConfidenceSamples = []
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
    setInactivityTimeoutMs(ms) {
      if (Number.isFinite(ms) && ms >= 5_000) inactivityTimeoutMs = Math.round(ms)
    },
    ensureMicPermission,
    async startContinuous(conversationId) {
      if (disposed) return
      if (!stt.isSupported()) {
        setStatus('error')
        callbacks.onError?.('التعرف على الكلام غير متاح في هذا المتصفح — يمكنك الكتابة بدلًا من ذلك')
        return
      }
      generation += 1
      tts.stop()
      mode = 'hands_free'
      continuousActive = true
      handsFreeConversationId = conversationId
      resumeHandsFreeAfterInterrupt = false
      clearAllTimers()
      utteranceBuffer = ''
      utterancePrefix = ''
      utteranceConfidenceSamples = []
      lastSubmittedKey = ''
      lastSubmittedAt = 0
      logPipeline({ stage: 'voice', event: 'continuous_started', meta: { conversationId } })
      await startListening(true)
    },
    async stopSession() {
      if (disposed) return
      await endSession('user')
    },
    async startPushToTalk() {
      if (disposed) return
      tts.stop()
      mode = 'push_to_talk'
      continuousActive = false
      handsFreeConversationId = null
      resumeHandsFreeAfterInterrupt = false
      clearAllTimers()
      utteranceBuffer = ''
      utterancePrefix = ''
      utteranceConfidenceSamples = []
      await startListening(false)
    },
    async stopPushToTalkAndSend(conversationId) {
      if (disposed) return null
      intentionalAbort = true
      clearSilenceTimer()
      stopVad()
      const transcript = ((await stt.stop()) || utteranceBuffer || partial).trim()
      utteranceBuffer = ''
      utterancePrefix = ''
      callbacks.onFinalTranscript?.(transcript)
      return sendTranscript(conversationId, transcript)
    },
    async startHandsFree(conversationId) {
      return this.startContinuous(conversationId)
    },
    async stopListening() {
      return this.stopSession()
    },
    interrupt(abortStream, opts) {
      // Only barge-in when assistant audio is genuinely playing.
      const audioPlaying = realTts && (tts.isSpeaking() || status === 'speaking')
      if (!audioPlaying) {
        logPipeline({ stage: 'voice', event: 'interrupt_ignored', meta: { status, realTts } })
        return false
      }
      const token = generation
      intentionalAbort = true
      clearSilenceTimer()
      stopVad()
      const keepHandsFree = opts?.resumeHandsFree ?? (continuousActive && mode === 'hands_free' && !!handsFreeConversationId)
      const wasSending = sending
      tts.stop()
      stt.abort()
      sending = false
      utteranceBuffer = ''
      utterancePrefix = ''
      utteranceConfidenceSamples = []
      clearLiveTranscript()
      activeAbort?.abort()
      activeAbort = null
      abortStream?.()
      setStatus('ready')
      logPipeline({ stage: 'voice', event: 'interrupted', meta: { keepHandsFree, wasSending } })
      if (keepHandsFree && continuousActive && token === generation) {
        if (wasSending) {
          resumeHandsFreeAfterInterrupt = true
        } else {
          resumeHandsFreeAfterInterrupt = false
          void enterReadyThenListen(token)
        }
      }
      return true
    },
    cancelInFlight(abortStream) {
      if (disposed) return
      if (!sending && status !== 'processing' && status !== 'thinking' && status !== 'responding') {
        return
      }
      const token = generation
      intentionalAbort = true
      clearSilenceTimer()
      stopVad()
      tts.stop()
      stt.abort()
      sending = false
      utteranceBuffer = ''
      utterancePrefix = ''
      utteranceConfidenceSamples = []
      clearLiveTranscript()
      activeAbort?.abort()
      activeAbort = null
      abortStream?.()
      resumeHandsFreeAfterInterrupt = false
      logPipeline({ stage: 'voice', event: 'turn_cancelled' })
      if (continuousActive && handsFreeConversationId) {
        void enterReadyThenListen(token)
      } else {
        setStatus('idle')
      }
    },
    async speakText(text) {
      if (disposed) return
      if (!realTts) {
        await tts.speak({ locale, text: stripMarkdownForSpeech(text), interrupt: true })
        return
      }
      setStatus('speaking')
      try {
        await tts.speak({ locale, text: stripMarkdownForSpeech(text), interrupt: true })
      } catch (e) {
        if (!isBenignChatError(e)) throw e
      }
      if (!disposed) setStatus(continuousActive ? 'ready' : 'idle')
    },
    dispose() {
      disposed = true
      intentionalAbort = true
      continuousActive = false
      resumeHandsFreeAfterInterrupt = false
      handsFreeConversationId = null
      generation += 1
      clearAllTimers()
      utteranceBuffer = ''
      utterancePrefix = ''
      utteranceConfidenceSamples = []
      stopVad()
      tts.stop()
      stt.abort()
      activeAbort?.abort()
      activeAbort = null
      clearSttHandlers()
      clearLiveTranscript()
      status = 'idle'
    },
  }
}

export function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/[#>*_~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function mapSttError(error: string): string {
  if (error === 'not-allowed' || error === 'permission_denied') return 'تم رفض إذن الميكروفون'
  if (error === 'no-speech') return 'لم يتم التقاط كلام — حاول مجدداً'
  if (error === 'network') return 'مشكلة شبكة في التعرف على الكلام'
  if (error === 'aborted') return 'تم إيقاف الاستماع'
  if (error === 'audio-capture') return 'الميكروفون غير متاح'
  return error || 'خطأ في التعرف على الكلام'
}
