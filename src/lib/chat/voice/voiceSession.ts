/**
 * Voice session orchestrator.
 * Uses the shared chatEngine only — no separate conversation/message system.
 */

import { chatEngine, type StreamHandlers } from '../chatEngine'
import type { ChatMessage } from '../chatTypes'
import { createSpeechToTextProvider, createTextToSpeechProvider } from './voiceProviderFactory'
import { queryMicrophonePermission, requestMicrophoneAccess } from './microphonePermission'
import type {
  MicrophonePermissionState,
  SpeechToTextProvider,
  TextToSpeechProvider,
  VoiceInputMode,
  VoiceLocale,
  VoiceSessionStatus,
} from './voiceTypes'
import { normalizeVoiceLocale } from './voiceTypes'

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
}

export interface VoiceSession {
  getStatus: () => VoiceSessionStatus
  getMode: () => VoiceInputMode
  getLocale: () => VoiceLocale
  getPartialTranscript: () => string
  setMode: (mode: VoiceInputMode) => void
  setLocale: (locale: VoiceLocale) => void
  ensureMicPermission: () => Promise<MicrophonePermissionState>
  startPushToTalk: () => Promise<void>
  stopPushToTalkAndSend: (conversationId: string) => Promise<ChatMessage | null>
  startHandsFree: (conversationId: string) => Promise<void>
  stopListening: () => Promise<void>
  interrupt: (abortStream?: () => void) => void
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
  /** Test seam — defaults to real browser permission helpers */
  requestPermission?: () => Promise<MicrophonePermissionState>
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
  let disposed = false
  let handsFreeConversationId: string | null = null
  let activeAbort: AbortController | null = null
  let listening = false
  let sending = false

  const setStatus = (next: VoiceSessionStatus) => {
    status = next
    callbacks.onStatus?.(next)
  }

  const ensureMicPermission = async (): Promise<MicrophonePermissionState> => {
    setStatus('requesting_permission')
    const state = await requestPermission()
    callbacks.onPermission?.(state)
    if (state.state !== 'granted') {
      setStatus('error')
      callbacks.onError?.(state.error || 'يلزم إذن الميكروفون للمتابعة')
    } else if (status === 'requesting_permission') {
      setStatus('idle')
    }
    return state
  }

  const startListening = async (continuous: boolean) => {
    if (!stt.isSupported()) {
      throw new Error('التعرف على الكلام غير متاح')
    }
    const permission = await ensureMicPermission()
    if (permission.state !== 'granted') return
    partial = ''
    listening = true
    setStatus('listening')
    await stt.start({
      locale,
      continuous,
      interimResults: true,
    })
  }

  const sendTranscript = async (conversationId: string, transcript: string): Promise<ChatMessage | null> => {
    const content = transcript.trim()
    if (!content || sending || disposed) {
      if (!content) setStatus(mode === 'hands_free' && handsFreeConversationId ? 'listening' : 'idle')
      return null
    }

    sending = true
    setStatus('processing')
    stt.abort()
    listening = false
    activeAbort?.abort()
    const controller = new AbortController()
    activeAbort = controller

    const handlers: StreamHandlers = {
      signal: controller.signal,
      onAssistantCreate: callbacks.onAssistantCreate,
      onDelta: (message) => {
        callbacks.onDelta?.(message)
      },
      onComplete: async (message) => {
        callbacks.onComplete?.(message)
        if (message.content.trim() && !controller.signal.aborted) {
          setStatus('speaking')
          try {
            await tts.speak({ locale, text: stripMarkdownForSpeech(message.content), interrupt: true })
          } catch (e) {
            callbacks.onError?.(e instanceof Error ? e.message : 'تعذر تشغيل الرد الصوتي')
          }
        }
        sending = false
        if (controller.signal.aborted) {
          setStatus('idle')
          return
        }
        setStatus('idle')
        if (mode === 'hands_free' && handsFreeConversationId && !disposed) {
          try {
            setStatus('reconnecting')
            await startListening(true)
          } catch (e) {
            callbacks.onError?.(e instanceof Error ? e.message : 'تعذر استئناف الاستماع')
            setStatus('error')
          }
        }
      },
      onError: (message, error) => {
        sending = false
        callbacks.onStreamError?.(message, error)
        if (error !== 'cancelled') {
          callbacks.onError?.(error)
          setStatus('error')
        } else {
          setStatus('idle')
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
      const err = e instanceof Error ? e.message : 'تعذر إرسال الرسالة الصوتية'
      callbacks.onError?.(err)
      setStatus('error')
      return null
    }
  }

  stt.onPartial = (event) => {
    partial = event.transcript
    callbacks.onPartialTranscript?.(partial)
  }
  stt.onFinal = (event) => {
    partial = event.transcript
    callbacks.onFinalTranscript?.(event.transcript)
    if (
      mode === 'hands_free'
      && handsFreeConversationId
      && event.transcript.trim()
      && !sending
      && status === 'listening'
    ) {
      void sendTranscript(handsFreeConversationId, event.transcript)
    }
  }
  stt.onError = (error) => {
    callbacks.onError?.(mapSttError(error))
    setStatus('error')
  }
  stt.onEnd = () => {
    listening = false
    if (status === 'listening' && mode !== 'hands_free') setStatus('idle')
  }

  return {
    getStatus: () => status,
    getMode: () => mode,
    getLocale: () => locale,
    getPartialTranscript: () => partial,
    setMode(next) {
      mode = next
      if (next !== 'hands_free') handsFreeConversationId = null
    },
    setLocale(next) {
      locale = normalizeVoiceLocale(next)
    },
    ensureMicPermission,
    async startPushToTalk() {
      if (disposed) return
      tts.stop()
      mode = 'push_to_talk'
      handsFreeConversationId = null
      await startListening(false)
    },
    async stopPushToTalkAndSend(conversationId) {
      if (disposed) return null
      const transcript = ((await stt.stop()) || partial).trim()
      listening = false
      callbacks.onFinalTranscript?.(transcript)
      return sendTranscript(conversationId, transcript)
    },
    async startHandsFree(conversationId) {
      if (disposed) return
      tts.stop()
      mode = 'hands_free'
      handsFreeConversationId = conversationId
      await startListening(true)
    },
    async stopListening() {
      handsFreeConversationId = null
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
      if (status === 'listening' || status === 'reconnecting') setStatus('idle')
    },
    interrupt(abortStream) {
      tts.stop()
      stt.abort()
      listening = false
      sending = false
      activeAbort?.abort()
      abortStream?.()
      setStatus('idle')
    },
    async speakText(text) {
      setStatus('speaking')
      await tts.speak({ locale, text: stripMarkdownForSpeech(text), interrupt: true })
      setStatus('idle')
    },
    dispose() {
      disposed = true
      handsFreeConversationId = null
      tts.stop()
      stt.abort()
      activeAbort?.abort()
      setStatus('idle')
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
