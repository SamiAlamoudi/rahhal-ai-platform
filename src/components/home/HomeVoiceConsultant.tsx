import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { HomeLocale } from '../../lib/aiHome'
import { chatEngine } from '../../lib/chat/chatEngine'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import type { VoiceSession } from '../../lib/chat/voice/voiceSession'
import type { VoiceSessionStatus } from '../../lib/chat/voice/voiceTypes'
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

  const upsertAssistant = useCallback((message: ChatMessage) => {
    if (message.role !== 'assistant') return
    setAssistantMessage(message)
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
            if (!disposed) setVoiceStatus(status)
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
          onAssistantCreate: (message) => {
            if (!disposed) {
              setCards([])
              upsertAssistant(message)
            }
          },
          onDelta: (message) => {
            if (!disposed) upsertAssistant(message)
          },
          onComplete: (message) => {
            if (!disposed) upsertAssistant(message)
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
  }, [locale, onDraftChange, upsertAssistant])

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationIdRef.current) return conversationIdRef.current
    const created = await chatEngine.createConversation(
      locale === 'ar' ? 'محادثة صوتية' : 'Voice conversation',
    )
    conversationIdRef.current = created.id
    return created.id
  }, [locale])

  const startListening = useCallback(async () => {
    setError(null)
    setCards([])
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
  }, [ensureConversation, t])

  const stopListening = useCallback(async () => {
    await voiceRef.current?.stopListening()
  }, [])

  const interrupt = useCallback(() => {
    voiceRef.current?.interrupt(undefined, { resumeHandsFree: true })
  }, [])

  const onVoiceClick = useCallback(() => {
    if (voiceStatus === 'listening') {
      void stopListening()
      return
    }
    if (voiceStatus === 'speaking' || voiceStatus === 'responding' || voiceStatus === 'thinking') {
      interrupt()
      return
    }
    void startListening()
  }, [interrupt, startListening, stopListening, voiceStatus])

  const onSubmitText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setError(null)
    setCards([])
    setUserHeard(trimmed)
    setAssistantText('')
    setAssistantMessage(null)
    try {
      const id = await ensureConversation()
      const controller = new AbortController()
      // Text turn on the same Home surface — still speak the reply.
      await chatEngine.sendMessage(
        { conversationId: id, content: trimmed, modality: 'text' },
        {
          signal: controller.signal,
          onAssistantCreate: upsertAssistant,
          onDelta: upsertAssistant,
          onComplete: async (message) => {
            upsertAssistant(message)
            const spoken =
              (typeof message.providerMeta?.spokenText === 'string' && message.providerMeta.spokenText.trim())
              || message.content.slice(0, 320)
            if (spoken && voiceRef.current) {
              setVoiceStatus('speaking')
              try {
                await voiceRef.current.speakText(spoken)
              } finally {
                setVoiceStatus('idle')
              }
            }
          },
          onError: (_message, err) => {
            if (!isBenignChatError(err)) setError(err)
          },
        },
      )
      onDraftChange('')
    } catch (e) {
      if (!isBenignChatError(e)) {
        setError(e instanceof Error ? e.message : t('تعذر إرسال الرسالة', 'Could not send message'))
      }
    }
  }, [ensureConversation, onDraftChange, t, upsertAssistant])

  const statusLabel = (() => {
    switch (voiceStatus) {
      case 'listening':
        return t('يستمع…', 'Listening…')
      case 'thinking':
        return t('يفكر…', 'Thinking…')
      case 'responding':
        return t('يرد…', 'Responding…')
      case 'speaking':
        return t('يتحدث…', 'Speaking…')
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
        className="rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-4 shadow-lg shadow-slate-950/5"
        aria-live="polite"
      >
        <p className="text-xs font-medium text-slate-500">{statusLabel}</p>
        {partial || userHeard ? (
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">{t('أنت:', 'You:')}</span>{' '}
            {partial || userHeard}
          </p>
        ) : null}
        <AnimatePresence mode="wait">
          {assistantText ? (
            <motion.p
              key={assistantMessage?.id || 'assistant'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-base leading-relaxed text-slate-900"
            >
              <span className="font-semibold text-primary-700">{t('رحّال:', 'Rahhal:')}</span>{' '}
              {assistantText}
            </motion.p>
          ) : busy && voiceStatus !== 'listening' ? (
            <p className="mt-3 text-sm text-slate-500">{t('رحّال يرد…', 'Rahhal is answering…')}</p>
          ) : null}
        </AnimatePresence>

        {cards.length > 0 && voiceStatus !== 'responding' && voiceStatus !== 'thinking' ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="home-voice-cards">
            {cards.map((card) => (
              <div
                key={card.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5"
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
