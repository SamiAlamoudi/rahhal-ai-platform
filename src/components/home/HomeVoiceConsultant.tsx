import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { HomeLocale } from '../../lib/aiHome'
import { chatEngine } from '../../lib/chat/chatEngine'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import type { VoiceSession } from '../../lib/chat/voice/voiceSession'
import type { VoiceSessionStatus } from '../../lib/chat/voice/voiceTypes'
import { unlockAudioPlayback } from '../../lib/chat/voice/audioElementTextToSpeechProvider'
import { isBenignChatError } from '../../lib/chat/chatLogger'
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
 * Mic → STT → ChatGPT → on-screen streaming reply → TTS → listen again.
 * Never navigates to /chat.
 */
export function HomeVoiceConsultant({
  locale,
  draft,
  onDraftChange,
}: HomeVoiceConsultantProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)
  const voiceRef = useRef<VoiceSession | null>(null)
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
    // ChatGPT-Voice lockstep: hold text until audio starts (unless forced / complete after speech).
    if (!opts?.force && !speechStartedRef.current && message.status !== 'complete') {
      pendingAssistantRef.current = message
      return
    }
    if (!opts?.force && !speechStartedRef.current && message.status === 'complete') {
      // Complete arrived before speech — keep buffered until onSpeechStarted, then force.
      pendingAssistantRef.current = message
      return
    }
    flushAssistant(message)
  }, [flushAssistant])

  useEffect(() => {
    let disposed = false
    let session: VoiceSession | null = null
    void (async () => {
      const [{ createSpeechToTextProvider, createTextToSpeechProvider }, { createVoiceSession }] =
        await Promise.all([
          import('../../lib/chat/voice/voiceProviderFactory'),
          import('../../lib/chat/voice/voiceSession'),
        ])
      if (disposed) return
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
            if (!disposed && !isBenignChatError(err)) setError(err)
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
            if (!disposed && !isBenignChatError(err)) setError(err)
          },
        },
      })
      voiceRef.current = session
      setSessionReady(true)
    })()
    return () => {
      disposed = true
      session?.dispose()
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

  const startListening = useCallback(async () => {
    // Continue the active trip conversation. Only wipe when there is no session yet.
    // (A full "new chat" is beginFreshConversation via looksLikeNewTrip on text, or reload.)
    if (!conversationIdRef.current) {
      beginFreshConversation()
    }
    setError(null)
    unlockAudioPlayback().catch(() => undefined)
    try {
      const id = await ensureConversation()
      const permission = await voiceRef.current?.ensureMicPermission()
      if (permission && permission.state !== 'granted') {
        setError(permission.error || t('يلزم إذن الميكروفون', 'Microphone permission required'))
        return
      }
      await voiceRef.current?.startHandsFree(id)
    } catch (e) {
      if (!isBenignChatError(e)) {
        setError(e instanceof Error ? e.message : t('تعذر بدء الصوت', 'Could not start voice'))
      }
    }
  }, [beginFreshConversation, ensureConversation, t])

  const stopListening = useCallback(async () => {
    await voiceRef.current?.stopListening()
  }, [])

  const interrupt = useCallback(() => {
    voiceRef.current?.interrupt(undefined, { resumeHandsFree: true })
  }, [])

  const onVoiceClick = useCallback(() => {
    unlockAudioPlayback().catch(() => undefined)
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
      voiceRef.current?.interrupt(undefined, { resumeHandsFree: false })
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
    await unlockAudioPlayback().catch(() => undefined)
    try {
      const looksLikeNewTrip = /(?:أريد السفر|ابغى أسافر|أبغى أسافر|ودي أسافر|trip to|i want to (?:go|travel))/i.test(trimmed)
      if (assistantMessage?.status === 'complete' && looksLikeNewTrip) {
        beginFreshConversation()
        setUserHeard(trimmed)
      }
      const id = await ensureConversation()
      const controller = new AbortController()
      const { takeNewSpokenChunks, takeSpokenTail } = await import('../../lib/chat/voice/progressiveSpeech')
      let spokenCursor = 0
      let speakChain: Promise<void> = Promise.resolve()

      const enqueueChunk = (chunk: string, isFirst: boolean) => {
        const piece = chunk.trim()
        if (!piece || !voiceRef.current) return
        speakChain = speakChain.then(async () => {
          if (controller.signal.aborted) return
          if (isFirst && !speechStartedRef.current) {
            speechStartedRef.current = true
            setVoiceStatus('speaking')
            setAudioPlaying(true)
            const pending = pendingAssistantRef.current
            pendingAssistantRef.current = null
            if (pending) flushAssistant(pending)
          }
          voiceRef.current?.armHandsFree?.(id)
          await voiceRef.current?.speakText(piece, { resumeHandsFree: false })
        }).catch(() => undefined)
      }

      const pump = (full: string, final = false) => {
        const normalized = (full || '').replace(/\s+/g, ' ').trim()
        if (!normalized) return
        if (spokenCursor === 0) {
          const { chunks } = takeNewSpokenChunks(normalized, 0)
          if (chunks.length > 0) {
            const first = chunks[0]!
            enqueueChunk(first, true)
            const idx = normalized.indexOf(first)
            spokenCursor = idx >= 0 ? idx + first.length : first.length
          } else if (!final) {
            return
          }
        }
        if (!final) return
        const tail = takeSpokenTail(normalized, spokenCursor)
        if (tail) {
          enqueueChunk(tail, spokenCursor === 0)
          spokenCursor = normalized.length
        } else if (spokenCursor === 0) {
          enqueueChunk(normalized, true)
          spokenCursor = normalized.length
        }
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
          },
          onDelta: (message) => {
            upsertAssistant(message)
            setVoiceStatus((s) => (s === 'speaking' ? s : 'responding'))
            const spoken =
              (typeof message.providerMeta?.spokenText === 'string' && message.providerMeta.spokenText.trim())
              || message.content
            if (spoken) pump(spoken, false)
          },
          onComplete: async (message) => {
            const spoken =
              (typeof message.providerMeta?.spokenText === 'string' && message.providerMeta.spokenText.trim())
              || message.content.slice(0, 360)
            if (spoken) pump(spoken, true)
            try {
              await speakChain
            } catch (e) {
              if (!isBenignChatError(e)) {
                setError(e instanceof Error ? e.message : t('تعذر تشغيل الصوت', 'Could not play audio'))
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
          onError: (_message, err) => {
            if (!isBenignChatError(err)) setError(err)
            setVoiceStatus('idle')
          },
        },
      )
      onDraftChange('')
    } catch (e) {
      if (!isBenignChatError(e)) {
        setError(e instanceof Error ? e.message : t('تعذر إرسال الرسالة', 'Could not send message'))
      }
      setVoiceStatus('idle')
    }
  }, [assistantMessage?.status, beginFreshConversation, ensureConversation, flushAssistant, onDraftChange, t, upsertAssistant, voiceStatus])

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
          ? t('اضغط الميكروفون للتحدث مع رحّال', 'Tap the mic to talk with Rahhal')
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
        {partial || userHeard ? (
          <p className="mt-3 text-sm leading-7 text-slate-600">
            <span className="font-medium text-slate-800">{t('أنت:', 'You:')}</span>{' '}
            {partial || userHeard}
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
          <p className="mt-3 text-xs text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
