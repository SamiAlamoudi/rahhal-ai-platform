import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { HomeLocale } from '../../lib/aiHome'
import { chatEngine } from '../../lib/chat/chatEngine'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import type { VoiceSession } from '../../lib/chat/voice/voiceSession'
import type { VoiceSessionStatus } from '../../lib/chat/voice/voiceTypes'
import { unlockAudioPlayback, preconnectOpenAiTtsRoute } from '../../lib/chat/voice/audioElementTextToSpeechProvider'
import { isBenignChatError } from '../../lib/chat/chatLogger'
import {
  toUserFacingVoiceError,
  VOICE_RECOVERABLE_ERROR_AR,
} from '../../lib/chat/voice/voiceUserFacingError'
import { isGreetingOnly } from '../../lib/agent/conversationBrain/greetingGuard'
import {
  createVoiceLatencyMarks,
  summarizeVoiceLatency,
  type VoiceLatencyMarks,
} from '../../lib/chat/voice/voiceLatency'
import { logPipeline } from '../../lib/chat/pipelineDiagnostics'
import {
  buildResultCardsFromTripPlan,
  resultCardKindLabel,
  resultCardMeta,
  resultCardSubtitle,
  resultCardTitle,
  type DynamicResultCard,
} from '../../lib/premiumExperience'
import { tripPlanFromMeta } from '../../lib/agent/memory'
import { ConversationComposer } from './ConversationComposer'

export interface HomeVoiceConsultantProps {
  locale: HomeLocale
  draft: string
  onDraftChange: (value: string) => void
}

/**
 * Voice-first consultant surface on Home.
 * Prefers OpenAI Realtime speech-to-speech (gpt-realtime-2.1) when available.
 * Falls back to classic STT → Chat → TTS if Realtime is unavailable.
 * Never navigates to /chat.
 */
export function HomeVoiceConsultant({
  locale,
  draft,
  onDraftChange,
}: HomeVoiceConsultantProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)
  const voiceRef = useRef<VoiceSession | null>(null)
  const realtimeRef = useRef<import('../../lib/chat/voice/realtimeWebRtcSession').RealtimeWebRtcSession | null>(null)
  const preferRealtimeRef = useRef(false)
  const conversationIdRef = useRef<string | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<VoiceSessionStatus>('idle')
  const [partial, setPartial] = useState('')
  const [userHeard, setUserHeard] = useState('')
  const [assistantText, setAssistantText] = useState('')
  const [assistantMessage, setAssistantMessage] = useState<ChatMessage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [cards, setCards] = useState<DynamicResultCard[]>([])
  const [audioPlaying, setAudioPlaying] = useState(false)
  const speechStartedRef = useRef(false)
  const pendingAssistantRef = useRef<ChatMessage | null>(null)
  const latencyRef = useRef<VoiceLatencyMarks | null>(null)
  const bookingSearchGenRef = useRef(0)
  const bookingSearchRef = useRef<(text: string) => void>(() => undefined)

  const ownedTurnAbortRef = useRef<AbortController | null>(null)

  const flushAssistant = useCallback((message: ChatMessage) => {
    if (message.role !== 'assistant') return
    setAssistantMessage(message)
    // OpenAI owns traveler-facing copy — render verbatim (no polish / rechunk).
    setAssistantText(message.content || '')
    if (message.status === 'complete') {
      const memory = message.providerMeta?.memory as
        | { requirements?: { destination?: string | null; destinations?: string[] } }
        | undefined
      const destinationHint =
        memory?.requirements?.destination
        || memory?.requirements?.destinations?.[0]
        || null
      const plan = tripPlanFromMeta(message.providerMeta)
      setCards(
        buildResultCardsFromTripPlan(plan, {
          destinationHint: destinationHint || plan?.destinations?.[0] || null,
          limit: 6,
        }),
      )
    } else {
      setCards([])
    }
  }, [])

  const upsertAssistant = useCallback((message: ChatMessage, opts?: { force?: boolean }) => {
    if (message.role !== 'assistant') return
    // ChatGPT Voice shows words as they arrive — never leave a blank screen
    // while audio is still synthesizing. Speech still progresses separately.
    if (opts?.force || message.status === 'complete' || speechStartedRef.current) {
      flushAssistant(message)
      return
    }
    pendingAssistantRef.current = message
    // Reveal streaming text immediately so the traveler never stares at silence.
    setAssistantMessage(message)
    if (message.content) setAssistantText(message.content)
  }, [flushAssistant])

  /**
   * Sole conversation turn owner on the Realtime mic path:
   * Final ASR/text → chatEngine/planTurn (intent + search) → stream text →
   * ONE speakWrittenDraft (Realtime playback only).
   * Realtime must never invent a parallel reply.
   */
  const runOwnedTurn = useCallback(async (transcript: string) => {
    const text = transcript.trim()
    if (!text) return
    const gen = ++bookingSearchGenRef.current
    ownedTurnAbortRef.current?.abort()
    const controller = new AbortController()
    ownedTurnAbortRef.current = controller

    setError(null)
    setVoiceStatus('thinking')
    setAudioPlaying(false)
    setAssistantText('')
    setAssistantMessage(null)
    speechStartedRef.current = false
    pendingAssistantRef.current = null

    try {
      let id = conversationIdRef.current
      if (!id) {
        const created = await chatEngine.createConversation(
          locale === 'ar' ? 'محادثة صوتية' : 'Voice conversation',
        )
        id = created.id
        conversationIdRef.current = id
      }

      // Ensure Realtime is up for mic continuity + sole playback path.
      if (preferRealtimeRef.current && realtimeRef.current && !realtimeRef.current.isConnected()) {
        await realtimeRef.current.connect()
      }

      await chatEngine.sendMessage(
        { conversationId: id, content: text, modality: 'audio' },
        {
          signal: controller.signal,
          onAssistantCreate: (message) => {
            if (gen !== bookingSearchGenRef.current) return
            setCards([])
            setAssistantMessage(message)
            setAssistantText(message.content || '')
          },
          onDelta: (message) => {
            if (gen !== bookingSearchGenRef.current) return
            setAssistantMessage(message)
            if (message.content) setAssistantText(message.content)
          },
          onComplete: (message) => {
            if (gen !== bookingSearchGenRef.current) return
            flushAssistant(message)
            // Spoken audio must match the full displayed text (one reply, one owner).
            const displayed = (message.content || '').trim()
            const spokenRaw = displayed
              || (typeof message.providerMeta?.spokenText === 'string'
                ? message.providerMeta.spokenText.trim()
                : '')
            if (!spokenRaw) {
              setVoiceStatus('listening')
              realtimeRef.current?.ensureListening()
              return
            }
            const memoryLocale = (message.providerMeta?.memory as { locale?: string } | undefined)?.locale
            const speakLocale: 'ar' | 'en' =
              memoryLocale === 'en' || memoryLocale === 'ar'
                ? memoryLocale
                : (/[\u0600-\u06FF]/.test(spokenRaw) ? 'ar' : (locale === 'en' ? 'en' : 'ar'))
            // ONE streamed spoken reply — planTurn owns the words.
            if (preferRealtimeRef.current && realtimeRef.current?.isConnected()) {
              setVoiceStatus('speaking')
              setAudioPlaying(true)
              realtimeRef.current.speakWrittenDraft(spokenRaw, { locale: speakLocale })
            } else if (voiceRef.current) {
              setVoiceStatus('speaking')
              setAudioPlaying(true)
              void voiceRef.current.speakText(spokenRaw, {
                resumeHandsFree: true,
                interrupt: true,
              }).finally(() => {
                if (gen === bookingSearchGenRef.current) {
                  setAudioPlaying(false)
                  setVoiceStatus('listening')
                }
              })
            } else {
              setVoiceStatus('listening')
            }
          },
          onError: (_message, err) => {
            if (gen !== bookingSearchGenRef.current) return
            if (!isBenignChatError(err)) {
              const facing = toUserFacingVoiceError(err)
              if (facing) setError(facing)
            }
            setVoiceStatus('listening')
            realtimeRef.current?.ensureListening()
          },
        },
      )
    } catch (e) {
      if (controller.signal.aborted) return
      if (!isBenignChatError(e)) {
        const facing = toUserFacingVoiceError(e)
        if (facing) setError(facing)
      }
      setVoiceStatus('listening')
      realtimeRef.current?.ensureListening()
    }
  }, [flushAssistant, locale])

  useEffect(() => {
    bookingSearchRef.current = (text: string) => {
      void runOwnedTurn(text)
    }
  }, [runOwnedTurn])

  useEffect(() => {
    let disposed = false
    let session: VoiceSession | null = null
    void (async () => {
      const [
        { createSpeechToTextProvider, createTextToSpeechProvider },
        { createVoiceSession },
        { probeRealtimeCapability, resolvePreferredVoiceArchitecture },
        { createRealtimeWebRtcSession },
      ] = await Promise.all([
        import('../../lib/chat/voice/voiceProviderFactory'),
        import('../../lib/chat/voice/voiceSession'),
        import('../../lib/chat/voice/voiceArchitecture'),
        import('../../lib/chat/voice/realtimeWebRtcSession'),
      ])
      if (disposed) return

      const preferred = resolvePreferredVoiceArchitecture(
        (import.meta.env.VITE_VOICE_ARCHITECTURE as string | undefined) ?? 'realtime',
      )
      const capability = preferred === 'realtime_speech_to_speech'
        ? await probeRealtimeCapability()
        : null
      preferRealtimeRef.current = Boolean(
        preferred === 'realtime_speech_to_speech'
        && capability?.configured,
      )
      logPipeline({
        stage: 'voice',
        event: 'architecture_selected',
        meta: {
          preferred,
          realtimeConfigured: Boolean(capability?.configured),
          model: capability?.model ?? null,
          usingRealtime: preferRealtimeRef.current,
        },
      })

      if (preferRealtimeRef.current) {
        realtimeRef.current = createRealtimeWebRtcSession({
          onStatus: (status) => {
            if (disposed) return
            const mapped: VoiceSessionStatus =
              status === 'connecting' ? 'requesting_permission'
                : status === 'thinking' ? 'thinking'
                  : status === 'speaking' ? 'speaking'
                    : status === 'listening' ? 'listening'
                      : status === 'error' ? 'error'
                        : 'idle'
            setVoiceStatus(mapped)
            setAudioPlaying(status === 'speaking')
          },
          onUserTranscript: (text, isFinal) => {
            if (disposed) return
            if (isFinal) {
              // Final ASR only → sole turn owner (planTurn). Realtime does not reply here.
              setPartial('')
              setUserHeard(text)
              onDraftChange(text)
              bookingSearchRef.current(text)
            } else {
              setPartial(text)
            }
          },
          onAssistantTranscript: (text, isFinal) => {
            if (disposed) return
            // Playback transcript from speakWrittenDraft only — do not invent a second reply.
            setAssistantText(text)
            setAssistantMessage((prev) => prev ? {
              ...prev,
              content: text,
              status: isFinal ? 'complete' : 'streaming',
              providerMeta: {
                ...prev.providerMeta,
                spokenText: text,
                voiceArchitecture: 'realtime_speech_to_speech',
              },
              updatedAt: new Date().toISOString(),
            } : {
              id: 'realtime-playback',
              conversationId: conversationIdRef.current || 'realtime',
              role: 'assistant',
              modality: 'audio',
              content: text,
              audioUrl: null,
              imageUrl: null,
              attachments: [],
              status: isFinal ? 'complete' : 'streaming',
              error: null,
              providerMeta: {
                spokenText: text,
                voiceArchitecture: 'realtime_speech_to_speech',
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          },
          onError: (err) => {
            if (disposed || isBenignChatError(err)) return
            const facing = toUserFacingVoiceError(err)
            if (facing) setError(facing)
          },
        })
        setSessionReady(true)
        return
      }

      session = createVoiceSession({
        stt: createSpeechToTextProvider(),
        tts: createTextToSpeechProvider(),
        locale,
        mode: 'hands_free',
        callbacks: {
          onStatus: (status) => {
            if (!disposed) {
              setVoiceStatus(status)
              setAudioPlaying(status === 'speaking')
              if (status === 'thinking' || status === 'listening') {
                speechStartedRef.current = false
                pendingAssistantRef.current = null
              }
            }
          },
          onPartialTranscript: (text) => {
            if (!disposed) setPartial(text)
          },
          onFinalTranscript: (text) => {
            if (!disposed) {
              setPartial('')
              setUserHeard(text)
              onDraftChange(text)
            }
          },
          onError: (err) => {
            if (disposed || isBenignChatError(err)) return
            const facing = toUserFacingVoiceError(err)
            if (facing) setError(facing)
          },
          onSpeechStarted: () => {
            if (disposed) return
            speechStartedRef.current = true
            const pending = pendingAssistantRef.current
            pendingAssistantRef.current = null
            if (pending) flushAssistant(pending)
          },
          onAssistantCreate: (message) => {
            if (!disposed) {
              setCards([])
              speechStartedRef.current = false
              pendingAssistantRef.current = null
              setAssistantMessage(message)
              setAssistantText('')
            }
          },
          onDelta: (message) => {
            if (!disposed) upsertAssistant(message)
          },
          onComplete: (message) => {
            if (!disposed) {
              if (speechStartedRef.current) flushAssistant(message)
              else pendingAssistantRef.current = message
            }
          },
          onStreamError: (_message, err) => {
            if (disposed || isBenignChatError(err)) return
            const facing = toUserFacingVoiceError(err)
            if (facing) setError(facing)
          },
        },
      })
      voiceRef.current = session
      setSessionReady(true)
    })()
    return () => {
      disposed = true
      session?.dispose()
      // Permanent teardown on unmount — disconnect alone must remain reconnectable.
      realtimeRef.current?.dispose()
      realtimeRef.current = null
      if (voiceRef.current === session) voiceRef.current = null
    }
  }, [flushAssistant, locale, onDraftChange, upsertAssistant])

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationIdRef.current) return conversationIdRef.current
    const created = await chatEngine.createConversation(
      locale === 'ar' ? 'محادثة صوتية' : 'Voice conversation',
    )
    conversationIdRef.current = created.id
    return created.id
  }, [locale])

  const beginFreshConversation = useCallback(() => {
    conversationIdRef.current = null
    setPartial('')
    setUserHeard('')
    setAssistantText('')
    setAssistantMessage(null)
    setCards([])
    setError(null)
  }, [])

  // New page visit → completely clean conversation (no stale trip memory).
  useEffect(() => {
    beginFreshConversation()
  }, [beginFreshConversation])

  const startListening = useCallback(async () => {
    // New voice session from idle → blank trip memory (no Jordan/Dubai leftovers).
    if (voiceStatus === 'idle' || voiceStatus === 'error' || !conversationIdRef.current) {
      beginFreshConversation()
      ownedTurnAbortRef.current?.abort()
      bookingSearchGenRef.current += 1
    }
    setError(null)
    unlockAudioPlayback().catch(() => undefined)
    try {
      await ensureConversation()
      if (preferRealtimeRef.current && realtimeRef.current) {
        if (!realtimeRef.current.isConnected()) {
          await realtimeRef.current.connect()
        } else {
          // Same live session — re-arm mic/VAD for the next turn (no refresh).
          realtimeRef.current.ensureListening()
        }
        return
      }
      const permission = await voiceRef.current?.ensureMicPermission()
      if (permission && permission.state !== 'granted') {
        setError(permission.error || t('يلزم إذن الميكروفون', 'Microphone permission required'))
        return
      }
      const id = conversationIdRef.current
      if (!id) return
      await voiceRef.current?.startHandsFree(id)
    } catch (e) {
      if (!isBenignChatError(e)) {
        setError(toUserFacingVoiceError(e) || VOICE_RECOVERABLE_ERROR_AR)
      }
    }
  }, [beginFreshConversation, ensureConversation, t, voiceStatus])

  const stopListening = useCallback(async () => {
    if (preferRealtimeRef.current && realtimeRef.current) {
      realtimeRef.current.disconnect()
      setVoiceStatus('idle')
      setAudioPlaying(false)
      return
    }
    await voiceRef.current?.stopListening()
  }, [])

  const interrupt = useCallback(() => {
    ownedTurnAbortRef.current?.abort()
    bookingSearchGenRef.current += 1
    if (preferRealtimeRef.current && realtimeRef.current) {
      realtimeRef.current.interrupt()
      setAudioPlaying(false)
      setVoiceStatus('listening')
      return
    }
    voiceRef.current?.interrupt(undefined, { resumeHandsFree: true })
  }, [])

  const onVoiceClick = useCallback(() => {
    unlockAudioPlayback().catch(() => undefined)
    // Realtime is continuous: while listening, keep the session alive.
    // A second tap must NOT permanently kill reconnect (iPhone multi-turn bug).
    if (preferRealtimeRef.current && realtimeRef.current) {
      if (voiceStatus === 'speaking' || voiceStatus === 'responding' || voiceStatus === 'thinking') {
        interrupt()
        return
      }
      if (voiceStatus === 'listening') {
        // Soft hang-up — disconnect() is reconnectable; dispose() is only for unmount.
        void stopListening()
        return
      }
      void startListening()
      return
    }
    if (voiceStatus === 'listening') {
      void stopListening()
      return
    }
    if (voiceStatus === 'speaking' || voiceStatus === 'responding' || voiceStatus === 'thinking') {
      interrupt()
      return
    }
    // idle / error / reconnecting — (re)enter hands-free on the same conversation.
    void startListening()
  }, [interrupt, startListening, stopListening, voiceStatus])

  const onSubmitText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    // Never silently drop follow-ups (e.g. عطلة قصيرة) if a prior turn left
    // status stuck in thinking/responding/speaking (common when mic is unavailable).
    if (
      voiceStatus === 'thinking'
      || voiceStatus === 'responding'
      || voiceStatus === 'speaking'
    ) {
      if (preferRealtimeRef.current && realtimeRef.current) {
        realtimeRef.current.interrupt()
      } else {
        voiceRef.current?.interrupt(undefined, { resumeHandsFree: false })
      }
      setVoiceStatus('idle')
      setAudioPlaying(false)
    }
    setError(null)
    setCards([])
    setUserHeard(trimmed)
    setAssistantText('')
    setAssistantMessage(null)
    speechStartedRef.current = false
    pendingAssistantRef.current = null
    // Greeting-only → wipe prior trip conversation so we never continue Istanbul/budget state.
    if (isGreetingOnly(trimmed)) {
      beginFreshConversation()
      setUserHeard(trimmed)
      if (preferRealtimeRef.current && realtimeRef.current?.isConnected()) {
        realtimeRef.current.disconnect()
      }
    }
    latencyRef.current = createVoiceLatencyMarks()
    latencyRef.current.requestSentAt = performance.now()
    await unlockAudioPlayback().catch(() => undefined)

    // Sole turn owner: planTurn → one streamed reply → Realtime playback only.
    if (preferRealtimeRef.current && realtimeRef.current) {
      try {
        await ensureConversation()
        if (!realtimeRef.current.isConnected()) {
          await realtimeRef.current.connect()
        }
        bookingSearchRef.current(trimmed)
        onDraftChange('')
        return
      } catch (e) {
        if (!isBenignChatError(e)) {
          logPipeline({
            stage: 'voice',
            event: 'realtime_text_fallback_classic',
            meta: { message: e instanceof Error ? e.message : String(e) },
          })
        }
        // Fall through to classic STT/Chat/TTS path.
      }
    }

    try {
      // Only start a fresh trip on explicit reset — never wipe mid-answer
      // phrases like "أبغى أسافر أسبوع" that continue the same trip.
      const looksLikeNewTrip = /(?:^|\s)(?:رحلة جديدة|ابدأ من جديد|محادثة جديدة|new trip|start over)(?:\s|$|[.!?؟])/i.test(trimmed)
      if (assistantMessage?.status === 'complete' && looksLikeNewTrip) {
        beginFreshConversation()
        setUserHeard(trimmed)
      }
      const id = await ensureConversation()
      const controller = new AbortController()
      let speakChain: Promise<void> = Promise.resolve()

      /**
       * Classic fallback: one assistant reply → one TTS call → one continuous playback.
       * Start TTS immediately when the final turn is complete (no mid-stream clips).
       */
      const speakOnce = (fullSpoken: string) => {
        const piece = (fullSpoken || '').replace(/\s+/g, ' ').trim()
        if (!piece || !voiceRef.current) return
        speakChain = speakChain.then(async () => {
          if (controller.signal.aborted) return
          const marks = latencyRef.current
          if (marks) marks.ttsStartedAt = performance.now()
          if (!speechStartedRef.current) {
            speechStartedRef.current = true
            setVoiceStatus('speaking')
            setAudioPlaying(true)
            const pending = pendingAssistantRef.current
            pendingAssistantRef.current = null
            if (pending) flushAssistant(pending)
          }
          voiceRef.current?.armHandsFree?.(id)
          preconnectOpenAiTtsRoute()
          const { toSpokenDialogue } = await import('../../lib/chat/voice/spokenDialoguePostProcessor')
          const spokenDialogue = toSpokenDialogue(piece, {
            locale: locale === 'en' ? 'en' : 'ar',
            maxChars: 220,
          })
          await voiceRef.current?.speakText(spokenDialogue || piece, {
            resumeHandsFree: false,
            interrupt: true,
          })
          if (marks) {
            marks.ttsDoneAt = performance.now()
            if (marks.audioStartedAt == null) marks.audioStartedAt = marks.ttsDoneAt
            logPipeline({
              stage: 'tts',
              event: 'latency_report',
              meta: summarizeVoiceLatency(marks) as unknown as Record<string, unknown>,
            })
          }
        }).catch(() => undefined)
      }

      setVoiceStatus('thinking')
      await chatEngine.sendMessage(
        { conversationId: id, content: trimmed, modality: 'text' },
        {
          signal: controller.signal,
          onAssistantCreate: (message) => {
            setCards([])
            setAssistantMessage(message)
            setAssistantText('')
            setVoiceStatus('thinking')
            // Warm audio path while the model thinks — does not speak yet.
            void unlockAudioPlayback().catch(() => undefined)
          },
          onDelta: (message) => {
            // Stream text to the UI only — never invoke TTS on partial deltas.
            if (latencyRef.current && latencyRef.current.firstTokenAt == null) {
              latencyRef.current.firstTokenAt = performance.now()
            }
            upsertAssistant(message)
            setVoiceStatus((s) => (s === 'speaking' ? s : 'responding'))
          },
          onComplete: async (message) => {
            if (latencyRef.current) latencyRef.current.modelCompleteAt = performance.now()
            const spoken =
              (typeof message.providerMeta?.spokenText === 'string' && message.providerMeta.spokenText.trim())
              || message.content.slice(0, 360)
            if (spoken) speakOnce(spoken)
            try {
              await speakChain
            } catch (e) {
              if (!isBenignChatError(e)) {
                setError(toUserFacingVoiceError(e) || VOICE_RECOVERABLE_ERROR_AR)
              }
            }
            speechStartedRef.current = true
            flushAssistant(message)
            setAudioPlaying(false)
            try {
              await voiceRef.current?.startHandsFree(id)
            } catch {
              setVoiceStatus('idle')
            }
            // Guarantee the composer can accept the next answer even if mic fails.
            setVoiceStatus((s) => (
              s === 'listening' || s === 'reconnecting' ? s : 'idle'
            ))
          },
          onError: async (_message, err) => {
            if (!isBenignChatError(err)) {
              const facing = toUserFacingVoiceError(err)
              if (facing) setError(facing)
            }
            setVoiceStatus('idle')
            try {
              await voiceRef.current?.startHandsFree(id)
            } catch {
              setVoiceStatus('idle')
            }
          },
        },
      )
      onDraftChange('')
    } catch (e) {
      if (!isBenignChatError(e)) {
        setError(toUserFacingVoiceError(e) || VOICE_RECOVERABLE_ERROR_AR)
      }
      setVoiceStatus('idle')
      try {
        const id = conversationIdRef.current
        if (id) await voiceRef.current?.startHandsFree(id)
      } catch {
        // leave idle — composer still accepts text
      }
    }
  }, [assistantMessage?.status, beginFreshConversation, ensureConversation, flushAssistant, locale, onDraftChange, t, upsertAssistant, voiceStatus])

  const statusLabel = (() => {
    switch (voiceStatus) {
      case 'listening':
        return t('يستمع…', 'Listening…')
      case 'thinking':
        return t('يفكر…', 'Thinking…')
      case 'responding':
        return t('يرد…', 'Responding…')
      case 'speaking':
        return audioPlaying
          ? t('يتحدث…', 'Speaking…')
          : t('يتحدث…', 'Speaking…')
      default:
        return sessionReady
          ? (preferRealtimeRef.current
            ? t('اضغط الميكروفون — صوت مباشر (Realtime)', 'Tap the mic — live Realtime voice')
            : t('اضغط الميكروفون للتحدث مع رحّال', 'Tap the mic to talk with Rahhal'))
          : t('تجهيز الصوت…', 'Preparing voice…')
    }
  })()

  const busy =
    voiceStatus === 'thinking'
    || voiceStatus === 'responding'
    || voiceStatus === 'speaking'
    || voiceStatus === 'listening'

  const replyComplete = assistantMessage?.status === 'complete'

  return (
    <div className="space-y-4" data-testid="home-voice-consultant">
      <ConversationComposer
        locale={locale}
        value={draft}
        onChange={onDraftChange}
        onSubmit={(value) => {
          void onSubmitText(value)
        }}
        onVoiceClick={onVoiceClick}
        listening={voiceStatus === 'listening'}
        disabled={!sessionReady && voiceStatus === 'idle'}
      />

      <div
        className="rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-5 shadow-lg shadow-slate-950/5"
        aria-live="polite"
      >
        <p className="text-xs font-medium tracking-wide text-slate-500">{statusLabel}</p>
        {userHeard ? (
          <p className="mt-3 text-sm leading-7 text-slate-600">
            <span className="font-medium text-slate-800">{t('أنت:', 'You:')}</span>{' '}
            {userHeard}
          </p>
        ) : partial ? (
          <p className="mt-3 text-sm leading-7 text-slate-500">
            <span className="font-medium text-slate-700">{t('أنت:', 'You:')}</span>{' '}
            {partial}
          </p>
        ) : null}
        <AnimatePresence mode="wait">
          {assistantText ? (
            <motion.div
              key={assistantMessage?.id || 'assistant'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
              data-testid="home-voice-reply"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">
                {t('رحّال', 'Rahhal')}
              </p>
              <div className="mt-2 space-y-3 text-[1.05rem] leading-8 text-slate-900">
                {assistantText.split(/\n\s*\n/).map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 12)}`} className="whitespace-pre-wrap">
                    {paragraph.trim()}
                  </p>
                ))}
              </div>
            </motion.div>
          ) : busy && voiceStatus !== 'listening' ? (
            <p className="mt-4 text-sm text-slate-500">{t('رحّال يرد…', 'Rahhal is answering…')}</p>
          ) : null}
        </AnimatePresence>

        {cards.length > 0 && replyComplete && voiceStatus !== 'responding' && voiceStatus !== 'thinking' ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2" data-testid="home-voice-cards">
            {cards.map((card) => (
              <div
                key={card.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {resultCardKindLabel(card.kind, locale)}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {resultCardTitle(card, locale)}
                </p>
                <p className="text-xs text-slate-600">{resultCardSubtitle(card, locale)}</p>
                {resultCardMeta(card, locale) ? (
                  <p className="mt-1 text-xs font-medium text-primary-700">
                    {resultCardMeta(card, locale)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="alert">
            <p className="text-xs text-rose-600">
              {toUserFacingVoiceError(error) || VOICE_RECOVERABLE_ERROR_AR}
            </p>
            <button
              type="button"
              className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
              onClick={() => {
                setError(null)
                void startListening()
              }}
            >
              {t('إعادة المحاولة', 'Retry')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
