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
import { unlockAudioPlayback } from './audioElementTextToSpeechProvider'
import { takeNewSpokenChunks, takeSpokenTail } from './progressiveSpeech'

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
  /** Fired when the first TTS chunk begins — UI should start revealing text. */
  onSpeechStarted?: () => void
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
  /** Mark session as hands-free for a conversation without starting the mic yet (pre-TTS). */
  armHandsFree: (conversationId: string) => void
  stopListening: () => Promise<void>
  interrupt: (abortStream?: () => void, opts?: { resumeHandsFree?: boolean }) => void
  speakText: (text: string, opts?: { resumeHandsFree?: boolean; interrupt?: boolean }) => Promise<void>
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

  /**
   * Commit buffered STT text into the shared chatEngine turn.
   * Returns true when sendTranscript was kicked off.
   */
  const commitUtterance = (reason: string): boolean => {
    if (disposed || sending || mode !== 'hands_free' || !handsFreeConversationId) return false
    const transcript = utteranceBuffer.trim() || partial.trim()
    if (!transcript) return false
    clearSilenceTimer()
    logPipeline({
      stage: 'stt',
      event: 'utterance_committed',
      meta: { reason, silenceTimeoutMs, length: transcript.length },
    })
    utteranceBuffer = ''
    utterancePrefix = ''
    partial = ''
    void sendTranscript(handsFreeConversationId, transcript)
    return true
  }

  const bumpUtteranceSilenceTimer = () => {
    if (mode !== 'hands_free' || !handsFreeConversationId || sending || disposed) return
    if (status !== 'listening' && status !== 'reconnecting') return
    clearSilenceTimer()
    silenceTimer = setTimeout(() => {
      // Never finalize while VAD still hears speech energy.
      if (vadSpeaking) {
        bumpUtteranceSilenceTimer()
        return
      }
      commitUtterance('silence_timeout')
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
    void unlockAudioPlayback()
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
    // If we resumed mid-utterance, the previous silence timer was cleared above.
    // Re-arm it so a completed transcript cannot sit forever without sendMessage.
    if (
      opts?.preserveUtterance
      && mode === 'hands_free'
      && handsFreeConversationId
      && (utteranceBuffer.trim() || utterancePrefix.trim() || partial.trim())
    ) {
      bumpUtteranceSilenceTimer()
    }
  }

  const maybeResumeHandsFree = async () => {
    if (disposed || mode !== 'hands_free' || !handsFreeConversationId) return
    // Brief gap after TTS so the mic isn't captured while speakers are still draining.
    await new Promise((r) => setTimeout(r, 80))
    if (disposed || mode !== 'hands_free' || !handsFreeConversationId) return
    try {
      setStatus('reconnecting')
      await startListening(true, { preserveUtterance: true })
    } catch (e) {
      // One retry — Chrome STT often fails if restarted immediately after TTS.
      try {
        await new Promise((r) => setTimeout(r, 180))
        if (disposed || mode !== 'hands_free' || !handsFreeConversationId) return
        setStatus('reconnecting')
        await startListening(true, { preserveUtterance: true })
        return
      } catch (retryError) {
        diagnosePipelineError('stt', 'resume', retryError)
        callbacks.onError?.(
          retryError instanceof Error ? retryError.message : 'تعذر استئناف الاستماع',
        )
        // Leave idle (not error) so the traveler can still type the next turn.
        setStatus('idle')
      }
      diagnosePipelineError('stt', 'resume', e)
      setStatus('idle')
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
    activeAbort?.abort()
    tts.stop()
    const controller = new AbortController()
    activeAbort = controller
    let sawDelta = false
    let spokenCursor = 0
    let speechStarted = false
    let speakChain: Promise<void> = Promise.resolve()

    const enqueueSpeak = (chunk: string, phase: string) => {
      const text = chunk.trim()
      if (!text) return
      // Overlap synth of this chunk with playback of the previous one.
      tts.prefetch?.({ locale, text })
      speakChain = speakChain.then(async () => {
        if (disposed || controller.signal.aborted) return
        const isFirst = !speechStarted
        if (isFirst) {
          speechStarted = true
          setStatus('speaking')
          callbacks.onSpeechStarted?.()
          logPipeline({ stage: 'tts', event: 'speak_start', meta: { phase } })
          await unlockAudioPlayback()
        } else {
          setStatus('speaking')
        }
        try {
          await tts.speak({ locale, text, interrupt: isFirst })
        } catch (e) {
          if (!isBenignChatError(e) && !disposed) {
            diagnosePipelineError('tts', 'speak', e)
            callbacks.onError?.(e instanceof Error ? e.message : 'تعذر تشغيل الرد الصوتي')
          }
        }
      }).catch(() => {
        // Keep the chain alive so later chunks / resume still run.
      })
    }

    const pumpSpoken = (fullSpoken: string, final = false) => {
      const normalized = (fullSpoken || '').replace(/\s+/g, ' ').trim()
      if (!normalized) return

      // ChatGPT-Voice: enqueue every newly completed sentence while tokens arrive.
      const { chunks, nextCursor } = takeNewSpokenChunks(normalized, spokenCursor)
      for (let i = 0; i < chunks.length; i += 1) {
        const phase = spokenCursor === 0 && i === 0 ? 'first' : 'mid'
        enqueueSpeak(chunks[i]!, phase)
      }
      if (chunks.length > 0) spokenCursor = nextCursor

      if (!final) return

      const tail = takeSpokenTail(normalized, spokenCursor)
      if (tail) {
        enqueueSpeak(tail, 'final')
        spokenCursor = normalized.length
      } else if (spokenCursor === 0 && normalized) {
        // No sentence punctuation — speak the whole reply once.
        enqueueSpeak(normalized, 'final')
        spokenCursor = normalized.length
      }
    }

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
        // ChatGPT-Voice: start speaking the first complete sentence ASAP.
        const spoken = readSpokenText(message)
        if (spoken) pumpSpoken(spoken, false)
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
            pumpSpoken(spoken, true)
            try {
              await speakChain
              logPipeline({ stage: 'tts', event: 'speak_done', meta: { phase: 'final' } })
            } catch {
              // errors already surfaced per-chunk
            }
          }
          // Always release UI text even if TTS produced no audio.
          if (!speechStarted) {
            speechStarted = true
            callbacks.onSpeechStarted?.()
          }
        }
        sending = false
        activeAbort = null
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
        tts.stop()
        callbacks.onStreamError?.(message, error)
        if (!isBenignChatError(error)) {
          diagnosePipelineError('streaming', 'assistant_stream', error)
          callbacks.onError?.(error)
        }
        setStatus('idle')
        // ChatGPT-Voice: never strand the session — resume listening after recoverable errors.
        if (mode === 'hands_free' && handsFreeConversationId) {
          resumeHandsFreeAfterInterrupt = false
          void maybeResumeHandsFree()
        } else if (resumeHandsFreeAfterInterrupt) {
          resumeHandsFreeAfterInterrupt = false
          void maybeResumeHandsFree()
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
      if (!isBenignChatError(e)) {
        const app = diagnosePipelineError('conversation', 'send_turn', e)
        callbacks.onError?.(app.userMessage)
      }
      setStatus('idle')
      if (mode === 'hands_free' && handsFreeConversationId) {
        resumeHandsFreeAfterInterrupt = false
        void maybeResumeHandsFree()
      } else if (resumeHandsFreeAfterInterrupt) {
        resumeHandsFreeAfterInterrupt = false
        void maybeResumeHandsFree()
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
    // Missing mic hardware: stay idle for text; never flash English browser errors.
    const softMissingMic = /device not found|notfounderror|audio capture/i.test(error)
    if (softMissingMic) {
      diagnosePipelineError('stt', 'recognition', new Error(error))
      setStatus('idle')
      return
    }
    diagnosePipelineError('stt', 'recognition', new Error(error))
    callbacks.onError?.(mapSttError(error))
    setStatus(mode === 'hands_free' ? 'idle' : 'error')
  }
  stt.onEnd = () => {
    listening = false
    if (disposed) return
    if (status === 'listening' && mode === 'hands_free' && handsFreeConversationId && !sending) {
      const transcript = utteranceBuffer.trim() || partial.trim()
      // Chrome/Safari often end recognition immediately after a final result.
      // Resuming hands-free used to clearSilenceTimer() and drop the pending
      // sendMessage forever (UI showed transcript, never Thinking/TTS).
      if (transcript && !vadSpeaking) {
        commitUtterance('recognition_ended')
        return
      }
      // Mid-thought browser restart — keep buffer and re-arm silence commit.
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
      const permission = await ensureMicPermission()
      if (permission.state !== 'granted') {
        // Still keep the conversation armed; UI must leave speaking/responding.
        setStatus('idle')
        return
      }
      await startListening(true)
    },
    armHandsFree(conversationId) {
      if (disposed) return
      mode = 'hands_free'
      handsFreeConversationId = conversationId
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
    async speakText(text, opts) {
      if (disposed) return
      setStatus('speaking')
      const cleaned = stripMarkdownForSpeech(text)
      tts.prefetch?.({ locale, text: cleaned })
      try {
        await unlockAudioPlayback()
        // Progressive mid-stream chunks must not interrupt the prior sentence.
        await tts.speak({
          locale,
          text: cleaned,
          interrupt: opts?.interrupt !== false,
        })
      } catch (e) {
        if (!isBenignChatError(e)) throw e
      }
      if (disposed) return
      const resume = opts?.resumeHandsFree !== false
      if (resume && mode === 'hands_free' && handsFreeConversationId) {
        await maybeResumeHandsFree()
      } else if (resume && !disposed) {
        setStatus('idle')
      }
      // When resumeHandsFree === false, stay in speaking for progressive chunks.
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
  if (/device not found|notfounderror|audio capture/i.test(error)) {
    return 'الميكروفون غير متاح — يمكنك الكتابة بدلًا من التحدث'
  }
  // Never leak raw English browser errors into the consultant surface.
  if (/^[A-Za-z][A-Za-z0-9 _:-]{2,80}$/.test(error.trim())) {
    return 'تعذر استخدام الميكروفون — جرّب الكتابة'
  }
  return error || 'خطأ في التعرف على الكلام'
}
