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
import { unlockAudioPlayback, preconnectOpenAiTtsRoute } from './audioElementTextToSpeechProvider'
import {
  createVoiceLatencyMarks,
  summarizeVoiceLatency,
} from './voiceLatency'
import {
  buildTtsSpeechInstructions,
  loadVoiceExperiencePrefs,
  speakingSpeedRate,
} from './voiceExperiencePrefs'
import { toSpokenDialogue } from './spokenDialoguePostProcessor'
import { logMicSessionState, mapToMicSessionState } from './micSessionState'

function performanceNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

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
  /** User pressed Stop — block auto-resume / VAD / silence timers until startHandsFree. */
  let hardStopped = false
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
    if (hardStopped && next !== 'idle' && next !== 'error') {
      logPipeline({
        stage: 'voice',
        event: 'classic_status_blocked_hard_stopped',
        meta: { attempted: next },
      })
      return
    }
    status = next
    logMicSessionState(mapToMicSessionState(next, { hardStopped }), {
      source: 'classic',
      rawStatus: next,
    })
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
    if (disposed || hardStopped || mode !== 'hands_free' || !handsFreeConversationId) {
      logPipeline({
        stage: 'voice',
        event: 'auto_resume_blocked',
        meta: {
          disposed,
          hardStopped,
          mode,
          hasConversation: Boolean(handsFreeConversationId),
        },
      })
      return
    }
    // Brief gap after TTS so the mic isn't captured while speakers are still draining.
    await new Promise((r) => setTimeout(r, 80))
    if (disposed || hardStopped || mode !== 'hands_free' || !handsFreeConversationId) return
    try {
      setStatus('reconnecting')
      await startListening(true, { preserveUtterance: true })
    } catch (e) {
      // One retry — Chrome STT often fails if restarted immediately after TTS.
      try {
        await new Promise((r) => setTimeout(r, 180))
        if (disposed || hardStopped || mode !== 'hands_free' || !handsFreeConversationId) return
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
    const raw = spoken || stripMarkdownForSpeech(message.content)
    // Transform long written replies into short spoken consultant dialogue.
    return toSpokenDialogue(raw, {
      locale: locale === 'en' ? 'en' : 'ar',
      maxChars: 220,
    })
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
    let speechStarted = false
    let speakChain: Promise<void> = Promise.resolve()
    const latency = createVoiceLatencyMarks()
    latency.sttFinalAt = latency.turnStartedAt
    latency.requestSentAt = performanceNow()

    /**
     * One assistant reply → one TTS synthesis → one continuous playback.
     * Progressive mid-stream chunk TTS caused overlapping text to be spoken
     * twice with different OpenAI intonation and stitched A/B volume changes.
     */
    const speakOnce = (fullSpoken: string) => {
      const text = (fullSpoken || '').replace(/\s+/g, ' ').trim()
      if (!text) return
      speakChain = speakChain.then(async () => {
        if (disposed || controller.signal.aborted) return
        if (!speechStarted) {
          speechStarted = true
          setStatus('speaking')
          callbacks.onSpeechStarted?.()
          logPipeline({ stage: 'tts', event: 'speak_start', meta: { phase: 'final', once: true } })
          preconnectOpenAiTtsRoute()
          await unlockAudioPlayback()
        } else {
          setStatus('speaking')
        }
        try {
          const prefs = loadVoiceExperiencePrefs()
          await tts.speak({
            locale,
            text,
            interrupt: true,
            voice: locale === 'ar' ? prefs.voiceId : 'nova',
            speed: speakingSpeedRate(prefs.speed),
            dialect: locale === 'ar' ? prefs.dialect : undefined,
            instructions: buildTtsSpeechInstructions({
              locale,
              dialect: prefs.dialect,
            }),
            format: 'wav',
            onTtsRequestStart: () => {
              latency.ttsStartedAt = performanceNow()
            },
            onTtsResponseComplete: () => {
              latency.ttsResponseAt = performanceNow()
            },
            onAudioDecodeComplete: () => {
              latency.audioDecodedAt = performanceNow()
            },
            onAudioPlaybackStart: () => {
              latency.audioStartedAt = performanceNow()
            },
          })
          latency.ttsDoneAt = performanceNow()
          logPipeline({
            stage: 'tts',
            event: 'latency_report',
            meta: {
              ...summarizeVoiceLatency(latency),
              voice: prefs.voiceId,
              dialect: prefs.dialect,
              speed: prefs.speed,
            } as unknown as Record<string, unknown>,
          })
        } catch (e) {
          if (!isBenignChatError(e) && !disposed) {
            diagnosePipelineError('tts', 'speak', e)
            callbacks.onError?.(e instanceof Error ? e.message : 'تعذر تشغيل الرد الصوتي')
          }
        }
      }).catch(() => {
        // Keep the chain alive so resume still runs.
      })
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
          latency.firstTokenAt = performanceNow()
          logPipeline({ stage: 'streaming', event: 'first_delta' })
        }
        // Stream text to the UI only — never invoke TTS on partial deltas.
        callbacks.onDelta?.(message)
      },
      onComplete: async (message) => {
        callbacks.onComplete?.(message)
        latency.modelCompleteAt = performanceNow()
        logPipeline({
          stage: 'ai',
          event: 'turn_complete',
          meta: { length: message.content.length },
        })
        // Warm audio path while we finalize spoken text — still one TTS call.
        void unlockAudioPlayback().catch(() => undefined)
        if (!controller.signal.aborted && !disposed) {
          const spoken = readSpokenText(message)
          if (spoken) {
            speakOnce(spoken)
            try {
              await speakChain
              logPipeline({ stage: 'tts', event: 'speak_done', meta: { phase: 'final', once: true } })
            } catch {
              // errors already surfaced
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
        // After assistant reply / playback → IDLE. Next listen = explicit mic press.
        setStatus('idle')
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
      // Explicit user mic press — clear hard Stop latch.
      hardStopped = false
      tts.stop()
      mode = 'hands_free'
      handsFreeConversationId = conversationId
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
      if (disposed || hardStopped) return
      mode = 'hands_free'
      handsFreeConversationId = conversationId
    },
    async stopListening() {
      intentionalAbort = true
      hardStopped = true
      handsFreeConversationId = null
      clearSilenceTimer()
      utteranceBuffer = ''
      utterancePrefix = ''
      stopVad()
      tts.stop()
      activeAbort?.abort()
      activeAbort = null
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
      sending = false
      logMicSessionState('STOPPED', { source: 'classic', reason: 'user_stop' })
      status = 'idle'
      logMicSessionState('IDLE', { source: 'classic', reason: 'after_hard_stop' })
      callbacks.onStatus?.('idle')
    },
    interrupt(abortStream, opts) {
      intentionalAbort = true
      clearSilenceTimer()
      stopVad()
      // Accepted mic contract: after interrupt → IDLE. Reopen only when the
      // caller explicitly opts into resumeHandsFree:true (never by default).
      const keepHandsFree = !hardStopped && opts?.resumeHandsFree === true
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
      logPipeline({ stage: 'voice', event: 'interrupted', meta: { keepHandsFree, wasSending, hardStopped } })
      // Explicit opt-in only — never latch auto-relisten across an in-flight send.
      if (keepHandsFree) void maybeResumeHandsFree()
    },
    async speakText(text, opts) {
      if (disposed || hardStopped) return
      setStatus('speaking')
      const cleaned = stripMarkdownForSpeech(text)
      try {
        preconnectOpenAiTtsRoute()
        await unlockAudioPlayback()
        const prefs = loadVoiceExperiencePrefs()
        // One continuous utterance per call (interrupt replaces any prior clip).
        await tts.speak({
          locale,
          text: cleaned,
          interrupt: opts?.interrupt !== false,
          voice: locale === 'ar' ? prefs.voiceId : 'nova',
          speed: speakingSpeedRate(prefs.speed),
          dialect: locale === 'ar' ? prefs.dialect : undefined,
          instructions: buildTtsSpeechInstructions({
            locale,
            dialect: prefs.dialect,
          }),
          format: 'wav',
        })
      } catch (e) {
        if (!isBenignChatError(e)) throw e
      }
      if (disposed || hardStopped) return
      // Default: release to IDLE. Continuous conversation must opt in explicitly.
      const resume = opts?.resumeHandsFree === true && !hardStopped
      if (resume && mode === 'hands_free' && handsFreeConversationId) {
        await maybeResumeHandsFree()
      } else if (!disposed) {
        setStatus('idle')
      }
    },
    dispose() {
      disposed = true
      hardStopped = true
      intentionalAbort = true
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
