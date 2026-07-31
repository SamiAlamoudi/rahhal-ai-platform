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
  formatBookingOptionPrice,
  formatClock,
  formatDuration,
  type BookingOptionCard,
} from '../../lib/agent/bookingOptionsFromSearch'
import { takeNewSpokenChunks, takeSpokenTail } from '../../lib/chat/voice/progressiveSpeech'
import { logMicSessionState, mapToMicSessionState } from '../../lib/chat/voice/micSessionState'
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
  const [bookingOptions, setBookingOptions] = useState<BookingOptionCard[]>([])
  const [selectedBookingOptionId, setSelectedBookingOptionId] = useState<string | null>(null)
  const [providerError, setProviderError] = useState<string | null>(null)
  const [audioPlaying, setAudioPlaying] = useState(false)
  /** Soft ASR retry cue — calm status, never red technical diagnostics. */
  const [asrHint, setAsrHint] = useState<string | null>(null)
  const speechStartedRef = useRef(false)
  /** Parser-only enrichment for the last committed ASR (display stays exact). */
  const asrExtractTextRef = useRef<string | null>(null)
  const pendingAssistantRef = useRef<ChatMessage | null>(null)
  const latencyRef = useRef<VoiceLatencyMarks | null>(null)
  const bookingSearchGenRef = useRef(0)
  const bookingSearchRef = useRef<(text: string) => void>(() => undefined)
  /** User pressed Stop — block every auto-listen / ensureListening / resume path. */
  const userStoppedRef = useRef(false)

  const ownedTurnAbortRef = useRef<AbortController | null>(null)

  const setMicStatus = useCallback((status: VoiceSessionStatus, detail?: Record<string, unknown>) => {
    setVoiceStatus(status)
    logMicSessionState(mapToMicSessionState(status, { hardStopped: userStoppedRef.current }), {
      source: 'home',
      rawStatus: status,
      ...detail,
    })
  }, [])

  const flushAssistant = useCallback((message: ChatMessage) => {
    if (message.role !== 'assistant') return
    setAssistantMessage(message)
    // OpenAI owns traveler-facing copy — render verbatim (no polish / rechunk).
    setAssistantText(message.content || '')
    if (message.status === 'complete') {
      const options = Array.isArray(message.providerMeta?.bookingOptions)
        ? (message.providerMeta.bookingOptions as BookingOptionCard[])
        : []
      setBookingOptions(options)
      const selectedId = typeof message.providerMeta?.selectedBookingOptionId === 'string'
        ? message.providerMeta.selectedBookingOptionId
        : null
      if (selectedId) setSelectedBookingOptionId(selectedId)
      const searchMeta = message.providerMeta?.bookingSearch as
        | { providerError?: string | null; providerFlightCount?: number }
        | undefined
      setProviderError(
        options.some((o) => o.kind === 'flight')
          ? null
          : (searchMeta?.providerError || null),
      )
      logPipeline({
        stage: 'conversation',
        event: 'booking_cards_rendered',
        meta: {
          cardsRenderedCount: options.length,
          flightCards: options.filter((o) => o.kind === 'flight').length,
          hotelCards: options.filter((o) => o.kind === 'hotel').length,
          providerError: searchMeta?.providerError ?? null,
          providerFlightCount: searchMeta?.providerFlightCount ?? null,
        },
      })
    } else {
      setBookingOptions([])
      setProviderError(null)
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
    if (userStoppedRef.current) {
      logPipeline({
        stage: 'voice',
        event: 'owned_turn_blocked_user_stopped',
        meta: { sample: text.slice(0, 40) },
      })
      return
    }
    const gen = ++bookingSearchGenRef.current
    ownedTurnAbortRef.current?.abort()
    const controller = new AbortController()
    ownedTurnAbortRef.current = controller

    setError(null)
    setAsrHint(null)
    // Processing — mic already released on ASR commit; never re-open until idle + user tap.
    setMicStatus('thinking', { phase: 'owned_turn_start' })
    setAudioPlaying(false)
    setAssistantText('')
    setAssistantMessage(null)
    speechStartedRef.current = false
    pendingAssistantRef.current = null
    let spokenCursor = 0
    latencyRef.current = createVoiceLatencyMarks()
    latencyRef.current.sttFinalAt = performance.now()
    latencyRef.current.requestSentAt = performance.now()

    const resolveSpeakLocale = (spokenRaw: string, message: ChatMessage): 'ar' | 'en' => {
      const memoryLocale = (message.providerMeta?.memory as { locale?: string } | undefined)?.locale
      if (memoryLocale === 'en' || memoryLocale === 'ar') return memoryLocale
      return /[\u0600-\u06FF]/.test(spokenRaw) ? 'ar' : (locale === 'en' ? 'en' : 'ar')
    }

    const speakRealtimeChunk = (chunk: string, speakLocale: 'ar' | 'en', phase: string) => {
      if (!chunk || userStoppedRef.current) return
      if (!preferRealtimeRef.current || !realtimeRef.current?.isConnected()) return
      const marks = latencyRef.current
      if (marks && marks.ttsStartedAt == null) marks.ttsStartedAt = performance.now()
      if (!speechStartedRef.current) {
        speechStartedRef.current = true
        setMicStatus('speaking', { phase })
        setAudioPlaying(true)
      }
      realtimeRef.current.speakWrittenDraft(chunk, { locale: speakLocale })
      logPipeline({
        stage: 'tts',
        event: 'realtime_speak_chunk',
        meta: {
          phase,
          chars: chunk.length,
          sample: chunk.slice(0, 60),
          latency: marks ? summarizeVoiceLatency(marks) : null,
        },
      })
    }

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
      if (
        preferRealtimeRef.current
        && realtimeRef.current
        && !realtimeRef.current.isConnected()
        && !userStoppedRef.current
      ) {
        await realtimeRef.current.connect()
      }

      // Committed message = exact ASR. Extraction enrichment is internal to extractRequirements.
      const messageContent = text
      logPipeline({
        stage: 'voice',
        event: 'asr_committed_to_planner',
        meta: {
          committedTranscript: messageContent.slice(0, 200),
          extractHint: (asrExtractTextRef.current || messageContent).slice(0, 200),
        },
      })

      await chatEngine.sendMessage(
        { conversationId: id, content: messageContent, modality: 'audio' },
        {
          signal: controller.signal,
            onAssistantCreate: (message) => {
            if (gen !== bookingSearchGenRef.current || userStoppedRef.current) return
            setBookingOptions([])
            setProviderError(null)
            setAssistantMessage(message)
            setAssistantText(message.content || '')
          },
          onDelta: (message) => {
            if (gen !== bookingSearchGenRef.current || userStoppedRef.current) return
            setAssistantMessage(message)
            if (message.content) setAssistantText(message.content)
            const marks = latencyRef.current
            if (marks && marks.firstTokenAt == null) {
              marks.firstTokenAt = performance.now()
              logPipeline({
                stage: 'ai',
                event: 'first_token',
                meta: summarizeVoiceLatency(marks) as unknown as Record<string, unknown>,
              })
            }
            // ChatGPT-like: start audio as soon as a speakable clause exists.
            if (
              preferRealtimeRef.current
              && realtimeRef.current?.isConnected()
              && !userStoppedRef.current
            ) {
              const content = (message.content || '').trim()
              if (!content) return
              const { chunks, nextCursor } = takeNewSpokenChunks(content, spokenCursor)
              if (chunks[0]) {
                spokenCursor = nextCursor
                speakRealtimeChunk(chunks[0], resolveSpeakLocale(chunks[0], message), 'realtime_early_chunk')
              }
            }
          },
          onComplete: (message) => {
            if (gen !== bookingSearchGenRef.current || userStoppedRef.current) return
            if (latencyRef.current) latencyRef.current.modelCompleteAt = performance.now()
            flushAssistant(message)
            const req = (message.providerMeta?.memory as {
              requirements?: {
                origin?: string | null
                destination?: string | null
                startDate?: string | null
                endDate?: string | null
                travelers?: number | null
                cabinPreference?: string | null
              }
            } | undefined)?.requirements
            logPipeline({
              stage: 'voice',
              event: 'asr_extraction_result',
              meta: {
                committedTranscript: text.slice(0, 200),
                extractedOrigin: req?.origin ?? null,
                extractedDestination: req?.destination ?? null,
                extractedDates: {
                  startDate: req?.startDate ?? null,
                  endDate: req?.endDate ?? null,
                },
                extractedPassengers: req?.travelers ?? null,
                extractedCabinClass: req?.cabinPreference ?? null,
                latency: latencyRef.current
                  ? summarizeVoiceLatency(latencyRef.current)
                  : null,
              },
            })
            // Spoken audio must match the full displayed text (one reply, one owner).
            const displayed = (message.content || '').trim()
            const spokenRaw = displayed
              || (typeof message.providerMeta?.spokenText === 'string'
                ? message.providerMeta.spokenText.trim()
                : '')
            if (!spokenRaw) {
              // No playback — release mic; do not auto-listen (stuck red mic on iPhone).
              if (!userStoppedRef.current) {
                realtimeRef.current?.releaseToIdle?.('empty_spoken')
                setMicStatus('idle', { phase: 'empty_spoken' })
                setAudioPlaying(false)
              }
              return
            }
            const speakLocale = resolveSpeakLocale(spokenRaw, message)
            // ONE streamed spoken reply — planTurn owns the words.
            if (
              preferRealtimeRef.current
              && realtimeRef.current?.isConnected()
              && !userStoppedRef.current
            ) {
              if (speechStartedRef.current) {
                const tail = takeSpokenTail(spokenRaw, spokenCursor)
                if (tail.length >= 8) {
                  speakRealtimeChunk(tail, speakLocale, 'realtime_tail')
                }
              } else {
                speakRealtimeChunk(spokenRaw, speakLocale, 'realtime_playback')
              }
              if (latencyRef.current) {
                logPipeline({
                  stage: 'tts',
                  event: 'latency_report',
                  meta: summarizeVoiceLatency(latencyRef.current) as unknown as Record<string, unknown>,
                })
              }
              // Mic reopen only on explicit user tap after playback → idle.
            } else if (voiceRef.current && !userStoppedRef.current) {
              setMicStatus('speaking', { phase: 'classic_tts' })
              setAudioPlaying(true)
              void voiceRef.current.speakText(spokenRaw, {
                resumeHandsFree: false,
                interrupt: true,
              }).finally(() => {
                if (gen !== bookingSearchGenRef.current || userStoppedRef.current) {
                  setAudioPlaying(false)
                  return
                }
                setAudioPlaying(false)
                void voiceRef.current?.stopListening()
                setMicStatus('idle', { phase: 'classic_tts_done' })
              })
            } else if (!userStoppedRef.current) {
              realtimeRef.current?.releaseToIdle?.('no_playback_path')
              setMicStatus('idle', { phase: 'no_playback_path' })
            }
          },
          onError: (_message, err) => {
            if (gen !== bookingSearchGenRef.current || userStoppedRef.current) return
            if (!isBenignChatError(err)) {
              const facing = toUserFacingVoiceError(err)
              if (facing) setError(facing)
            }
            // Errors must not leave the mic open.
            if (!userStoppedRef.current) {
              realtimeRef.current?.releaseToIdle?.('stream_error')
              setMicStatus('idle', { phase: 'stream_error' })
              setAudioPlaying(false)
            }
          },
        },
      )
    } catch (e) {
      if (controller.signal.aborted || userStoppedRef.current) return
      if (!isBenignChatError(e)) {
        const facing = toUserFacingVoiceError(e)
        if (facing) setError(facing)
      }
      if (!userStoppedRef.current) {
        realtimeRef.current?.releaseToIdle?.('owned_turn_catch')
        setMicStatus('idle', { phase: 'owned_turn_catch' })
        setAudioPlaying(false)
      }
    }
  }, [flushAssistant, locale, setMicStatus])

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
            if (userStoppedRef.current && status !== 'idle' && status !== 'error') {
              logPipeline({
                stage: 'voice',
                event: 'home_status_ignored_after_stop',
                meta: { attempted: status },
              })
              return
            }
            const mapped: VoiceSessionStatus =
              status === 'connecting' ? 'requesting_permission'
                : status === 'thinking' ? 'thinking'
                  : status === 'speaking' ? 'speaking'
                    : status === 'listening' ? 'listening'
                      : status === 'error' ? 'error'
                        : 'idle'
            setMicStatus(mapped, { phase: 'realtime_on_status' })
            setAudioPlaying(status === 'speaking' && !userStoppedRef.current)
          },
          onUserTranscript: (text, isFinal, meta) => {
            if (disposed || userStoppedRef.current) return
            if (isFinal) {
              // Exactly one committed user message per turn — locked final only.
              setAsrHint(null)
              setPartial('')
              setUserHeard(text)
              onDraftChange(text)
              asrExtractTextRef.current = meta?.normalizedForExtract || text
              logPipeline({
                stage: 'voice',
                event: 'home_asr_commit',
                meta: {
                  committedTranscript: text.slice(0, 200),
                  audioDurationMs: meta?.audioDurationMs ?? null,
                  completionReason: meta?.completionReason ?? null,
                  conversationLanguage: meta?.conversationLanguage ?? null,
                },
              })
              bookingSearchRef.current(text)
            } else {
              // Interim / assembled preview — visual feedback only.
              setPartial(text)
            }
          },
          onAsrRetry: (message) => {
            if (disposed || userStoppedRef.current) return
            // Calm retry cue — never red technical diagnostics.
            setAsrHint(message)
            setPartial('')
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
            if (disposed) return
            if (userStoppedRef.current && status !== 'idle' && status !== 'error') return
            setMicStatus(status, { phase: 'classic_on_status' })
            setAudioPlaying(status === 'speaking' && !userStoppedRef.current)
            if (status === 'thinking' || status === 'listening') {
              speechStartedRef.current = false
              pendingAssistantRef.current = null
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
              setBookingOptions([]); setProviderError(null)
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
    setBookingOptions([])
    setSelectedBookingOptionId(null)
    setProviderError(null)
    setError(null)
  }, [])

  // New page visit → completely clean conversation (no stale trip memory).
  useEffect(() => {
    beginFreshConversation()
  }, [beginFreshConversation])

  const startListening = useCallback(async () => {
    // Explicit user mic press — only way to begin a new listening session after Stop.
    userStoppedRef.current = false
    setAsrHint(null)
    asrExtractTextRef.current = null
    logMicSessionState('LISTENING', { source: 'home', reason: 'user_mic_press' })
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
        setMicStatus('listening', { phase: 'user_start' })
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
  }, [beginFreshConversation, ensureConversation, setMicStatus, t, voiceStatus])

  const stopListening = useCallback(async () => {
    // Hard session termination — cancel owned turns, timers, VAD, auto-listen.
    userStoppedRef.current = true
    ownedTurnAbortRef.current?.abort()
    ownedTurnAbortRef.current = null
    bookingSearchGenRef.current += 1
    setPartial('')
    setAsrHint(null)
    setAudioPlaying(false)
    asrExtractTextRef.current = null
    logMicSessionState('STOPPED', { source: 'home', reason: 'user_stop' })
    if (preferRealtimeRef.current && realtimeRef.current) {
      realtimeRef.current.hardStop()
      setMicStatus('idle', { phase: 'hard_stop' })
      return
    }
    await voiceRef.current?.stopListening()
    setMicStatus('idle', { phase: 'hard_stop_classic' })
  }, [setMicStatus])

  const onVoiceClick = useCallback(() => {
    unlockAudioPlayback().catch(() => undefined)
    const active =
      voiceStatus === 'listening'
      || voiceStatus === 'speaking'
      || voiceStatus === 'responding'
      || voiceStatus === 'thinking'
      || voiceStatus === 'processing'
      || voiceStatus === 'reconnecting'
    // Any active session + mic tap = hard Stop (never auto-reopen).
    if (active) {
      void stopListening()
      return
    }
    // Idle / error — explicit user start only.
    void startListening()
  }, [startListening, stopListening, voiceStatus])

  const onSubmitText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    // Text is an explicit user action — clear Stop latch for this turn's playback.
    userStoppedRef.current = false
    // Never silently drop follow-ups (e.g. عطلة قصيرة) if a prior turn left
    // status stuck in thinking/responding/speaking (common when mic is unavailable).
    if (
      voiceStatus === 'thinking'
      || voiceStatus === 'responding'
      || voiceStatus === 'speaking'
    ) {
      ownedTurnAbortRef.current?.abort()
      bookingSearchGenRef.current += 1
      if (preferRealtimeRef.current && realtimeRef.current) {
        realtimeRef.current.interrupt()
      } else {
        voiceRef.current?.interrupt(undefined, { resumeHandsFree: false })
      }
      setMicStatus('idle', { phase: 'text_preempt' })
      setAudioPlaying(false)
    }
    setError(null)
    setBookingOptions([]); setProviderError(null)
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
        if (!piece || !voiceRef.current || userStoppedRef.current) return
        speakChain = speakChain.then(async () => {
          if (controller.signal.aborted || userStoppedRef.current) return
          const marks = latencyRef.current
          if (marks) marks.ttsStartedAt = performance.now()
          if (!speechStartedRef.current) {
            speechStartedRef.current = true
            setMicStatus('speaking', { phase: 'text_tts' })
            setAudioPlaying(true)
            const pending = pendingAssistantRef.current
            pendingAssistantRef.current = null
            if (pending) flushAssistant(pending)
          }
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

      setMicStatus('thinking', { phase: 'text_turn' })
      await chatEngine.sendMessage(
        { conversationId: id, content: trimmed, modality: 'text' },
        {
          signal: controller.signal,
          onAssistantCreate: (message) => {
            if (userStoppedRef.current) return
            setBookingOptions([]); setProviderError(null)
            setAssistantMessage(message)
            setAssistantText('')
            setMicStatus('thinking', { phase: 'text_assistant_create' })
            // Warm audio path while the model thinks — does not speak yet.
            void unlockAudioPlayback().catch(() => undefined)
          },
          onDelta: (message) => {
            if (userStoppedRef.current) return
            // Stream text to the UI only — never invoke TTS on partial deltas.
            if (latencyRef.current && latencyRef.current.firstTokenAt == null) {
              latencyRef.current.firstTokenAt = performance.now()
            }
            upsertAssistant(message)
            setMicStatus(
              voiceStatus === 'speaking' ? 'speaking' : 'responding',
              { phase: 'text_delta' },
            )
          },
          onComplete: async (message) => {
            if (userStoppedRef.current) {
              flushAssistant(message)
              return
            }
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
            // Never auto-open the mic after text — only explicit mic press.
            setMicStatus('idle', { phase: 'text_complete' })
          },
          onError: async (_message, err) => {
            if (!isBenignChatError(err)) {
              const facing = toUserFacingVoiceError(err)
              if (facing) setError(facing)
            }
            setMicStatus('idle', { phase: 'text_error' })
          },
        },
      )
      onDraftChange('')
    } catch (e) {
      if (!isBenignChatError(e)) {
        setError(toUserFacingVoiceError(e) || VOICE_RECOVERABLE_ERROR_AR)
      }
      setMicStatus('idle', { phase: 'text_catch' })
    }
  }, [assistantMessage?.status, beginFreshConversation, ensureConversation, flushAssistant, locale, onDraftChange, setMicStatus, upsertAssistant, voiceStatus])

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
        listening={
          voiceStatus === 'listening'
          || voiceStatus === 'thinking'
          || voiceStatus === 'responding'
          || voiceStatus === 'speaking'
          || voiceStatus === 'processing'
          || voiceStatus === 'reconnecting'
        }
        disabled={!sessionReady && voiceStatus === 'idle'}
      />

      <div
        className="rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-5 shadow-lg shadow-slate-950/5"
        aria-live="polite"
      >
        <p className="text-xs font-medium tracking-wide text-slate-500">{statusLabel}</p>
        {asrHint ? (
          <p
            className="mt-2 text-sm leading-7 text-slate-600"
            data-testid="home-voice-asr-hint"
            role="status"
          >
            {asrHint}
          </p>
        ) : null}
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

        {providerError && replyComplete && bookingOptions.length === 0 ? (
          <div
            className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900"
            data-testid="home-voice-provider-error"
            role="status"
          >
            {t(
              'تعذّر جلب عروض الطيران من المزود. أعد المحاولة — بدون أسعار تقديرية.',
              'Could not load flight offers from the provider. Retry — no estimated totals.',
            )}
            <span className="mt-1 block text-xs text-amber-700/80">{providerError}</span>
          </div>
        ) : null}

        {bookingOptions.length > 0 && replyComplete && voiceStatus !== 'responding' && voiceStatus !== 'thinking' ? (
          <div className="mt-5 space-y-2" data-testid="home-voice-booking-options">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('خيارات قابلة للحجز', 'Selectable booking options')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {bookingOptions.map((card) => {
                const isFlight = card.kind === 'flight'
                const price = formatBookingOptionPrice(card.price, card.currency, locale)
                const selected = selectedBookingOptionId === card.id
                const selectionCommand = isFlight
                  ? `select flight ${card.id}`
                  : `select hotel ${card.id}`
                return (
                  <div
                    key={card.id}
                    className={`rounded-2xl border px-3 py-3 shadow-sm ${
                      selected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-slate-200 bg-white'
                    }`}
                    data-testid={isFlight ? 'booking-flight-card' : 'booking-hotel-card'}
                    data-selected={selected ? 'true' : 'false'}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {isFlight ? t('طيران', 'Flight') : t('فندق', 'Hotel')}
                      {card.provider ? ` · ${card.provider}` : ''}
                    </p>
                    {isFlight ? (
                      <>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {card.airline || t('رحلة', 'Flight')} · {card.from} → {card.to}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {formatClock(card.departureTime, locale)} → {formatClock(card.arrivalTime, locale)}
                          {' · '}
                          {card.stops == null ? '—' : (locale === 'ar' ? `${card.stops} توقف` : `${card.stops} stop(s)`)}
                          {' · '}
                          {formatDuration(card.durationMinutes, locale)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {t('الدرجة', 'Cabin')}: {card.cabin || '—'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{card.hotelName}</p>
                        <p className="text-xs text-slate-600">{card.area || '—'}</p>
                      </>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {price ? (
                        <p
                          className={`text-sm font-bold ${
                            card.price != null && card.price > 0
                              ? 'text-primary-700'
                              : 'text-slate-500 font-medium'
                          }`}
                          data-testid="booking-card-price"
                        >
                          {price}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                          selected
                            ? 'bg-primary-800'
                            : 'bg-primary-600 hover:bg-primary-700'
                        }`}
                        data-testid="booking-card-select"
                        onClick={() => {
                          setSelectedBookingOptionId(card.id)
                          logPipeline({
                            stage: 'conversation',
                            event: 'booking_card_clicked',
                            meta: { optionId: card.id, kind: card.kind },
                          })
                          // Selection is an explicit user turn — cancel any in-flight speech first.
                          if (preferRealtimeRef.current && realtimeRef.current) {
                            realtimeRef.current.interrupt()
                          } else {
                            voiceRef.current?.interrupt(undefined, { resumeHandsFree: false })
                          }
                          void runOwnedTurn(selectionCommand)
                        }}
                      >
                        {selected ? t('تم الاختيار', 'Selected') : t('اختيار', 'Select')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
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
