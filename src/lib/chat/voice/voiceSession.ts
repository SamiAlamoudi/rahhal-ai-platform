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
  let earlySpeakPromise: Promise<void> | null = null

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
    status = next
    callbacks.onStatus?.(next)
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
    setStatus('requesting_permission')
    logPipeline({ stage: 'microphone', event: 'permission_request' })
    const state = await requestPermission()
    callbacks.onPermission?.(state)
    if (state.state !== 'granted') {
      setStatus('error')
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
      throw new Error('التعرف على الكلام غير متاح')
    }
    const permission = await ensureMicPermission()
    if (permission.state !== 'granted') return
    if (opts?.preserveUtterance) {
      utterancePrefix = utteranceBuffer.trim()
    } else {
      partial = ''
      utteranceBuffer = ''
      utterancePrefix = ''
    }
    intentionalAbort = false
    listening = true
    clearSilenceTimer()
    setStatus('listening')
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

  const maybeResumeHandsFree = async () => {
    if (disposed || mode !== 'hands_free' || !handsFreeConversationId) return
    try {
      setStatus('reconnecting')
      // Keep mid-thought speech across browser STT restarts (ChatGPT-like continuity).
      await startListening(true, { preserveUtterance: true })
    } catch (e) {
      diagnosePipelineError('stt', 'resume', e)
      callbacks.onError?.(e instanceof Error ? e.message : 'تعذر استئناف الاستماع')
      setStatus('error')
    }
  }

  const readSpokenText = (message: ChatMessage): string => {
    const meta = message.providerMeta ?? {}
    const spoken = typeof meta.spokenText === 'string' ? meta.spokenText.trim() : ''
    if (spoken) return spoken
    // Never read a long itinerary dump aloud.
    return stripMarkdownForSpeech(message.content).slice(0, 320)
  }

  const sendTranscript = async (conversationId: string, transcript: string): Promise<ChatMessage | null> => {
    const content = transcript.trim()
    if (!content || sending || disposed) {
      if (!content) setStatus(mode === 'hands_free' && handsFreeConversationId ? 'listening' : 'idle')
      return null
    }

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
    activeAbort?.abort()
    const controller = new AbortController()
    activeAbort = controller
    let sawDelta = false

    logPipeline({
      stage: 'conversation',
      event: 'turn_send_started',
      meta: { conversationId, modality: 'audio', length: content.length },
    })

    const handlers: StreamHandlers = {
      signal: controller.signal,
      onAssistantCreate: (message) => {
        if (!sawDelta) setStatus('thinking')
        callbacks.onAssistantCreate?.(message)
      },
      onDelta: (message) => {
        if (!sawDelta) {
          sawDelta = true
          setStatus('responding')
          logPipeline({ stage: 'streaming', event: 'first_delta' })
        }
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
        if (!controller.signal.aborted && !disposed) {
          const spoken = readSpokenText(message)
          if (spoken) {
            setStatus('speaking')
            try {
              // Interrupt bridge if still talking; speak the final short summary only.
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
          }
        }
        sending = false
        activeAbort = null
        earlySpokenText = ''
        earlySpeakPromise = null
        if (controller.signal.aborted || disposed) {
          setStatus('idle')
          if (resumeHandsFreeAfterInterrupt) {
            resumeHandsFreeAfterInterrupt = false
            await maybeResumeHandsFree()
          }
          return
        }
        setStatus('idle')
        if (mode === 'hands_free' && handsFreeConversationId) {
          await maybeResumeHandsFree()
        }
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
        } else {
          setStatus('idle')
          if (resumeHandsFreeAfterInterrupt) {
            resumeHandsFreeAfterInterrupt = false
            void maybeResumeHandsFree()
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
      } else {
        setStatus('idle')
        if (resumeHandsFreeAfterInterrupt) {
          resumeHandsFreeAfterInterrupt = false
          void maybeResumeHandsFree()
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
    diagnosePipelineError('stt', 'recognition', new Error(error))
    callbacks.onError?.(mapSttError(error))
    setStatus('error')
  }
  stt.onEnd = () => {
    listening = false
    if (disposed) return
    if (status === 'listening' && mode === 'hands_free' && handsFreeConversationId && !sending) {
      // Browser ended recognition mid-session — resume without flushing utterance early.
      void maybeResumeHandsFree()
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
    setMode(next) {
      mode = next
      if (next !== 'hands_free') {
        handsFreeConversationId = null
        resumeHandsFreeAfterInterrupt = false
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
      mode = 'push_to_talk'
      handsFreeConversationId = null
      resumeHandsFreeAfterInterrupt = false
      clearSilenceTimer()
      utteranceBuffer = ''
      utterancePrefix = ''
      await startListening(false)
    },
    async stopPushToTalkAndSend(conversationId) {
      if (disposed) return null
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
      mode = 'hands_free'
      handsFreeConversationId = conversationId
      resumeHandsFreeAfterInterrupt = false
      clearSilenceTimer()
      utteranceBuffer = ''
      utterancePrefix = ''
      await startListening(true)
    },
    async stopListening() {
      intentionalAbort = true
      resumeHandsFreeAfterInterrupt = false
      handsFreeConversationId = null
      clearSilenceTimer()
      utteranceBuffer = ''
      utterancePrefix = ''
      stopVad()
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
      ) {
        setStatus('idle')
      }
    },
    interrupt(abortStream, opts) {
      intentionalAbort = true
      clearSilenceTimer()
      stopVad()
      const keepHandsFree = opts?.resumeHandsFree ?? (mode === 'hands_free' && !!handsFreeConversationId)
      const wasSending = sending
      tts.stop()
      stt.abort()
      listening = false
      sending = false
      utteranceBuffer = ''
      utterancePrefix = ''
      activeAbort?.abort()
      activeAbort = null
      abortStream?.()
      setStatus('idle')
      logPipeline({ stage: 'voice', event: 'interrupted', meta: { keepHandsFree, wasSending } })
      if (keepHandsFree && wasSending) {
        resumeHandsFreeAfterInterrupt = true
      } else {
        resumeHandsFreeAfterInterrupt = false
        if (keepHandsFree) void maybeResumeHandsFree()
      }
    },
    async speakText(text) {
      if (disposed) return
      setStatus('speaking')
      try {
        await tts.speak({ locale, text: stripMarkdownForSpeech(text), interrupt: true })
      } catch (e) {
        if (!isBenignChatError(e)) throw e
      }
      if (!disposed) setStatus('idle')
    },
    dispose() {
      disposed = true
      intentionalAbort = true
      resumeHandsFreeAfterInterrupt = false
      handsFreeConversationId = null
      clearSilenceTimer()
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
  return error || 'خطأ في التعرف على الكلام'
}
