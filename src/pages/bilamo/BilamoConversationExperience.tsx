import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import {
  BilamoShell,
  Button,
  FlightCard,
  HotelCard,
  Logo,
  TripTimeline,
  VoiceOrb,
  bilamoHaptic,
  springs,
  type OrbState,
  type TripTimelineItem,
} from '../../design-system'
import { greetingForHour, resolveDisplayName } from '../../design-system/greeting'
import { useBilamoMic } from '../../hooks/useBilamoMic'
import { useBilamoSpeak } from '../../hooks/useBilamoSpeak'
import { useBilamoSpeech } from '../../hooks/useBilamoSpeech'
import { useAuth } from '../../lib/auth'
import { chatEngine } from '../../lib/chat/chatEngine'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import { validateUserMessage } from '../../lib/chat/chatHelpers'
import { isBenignChatError, logChatError } from '../../lib/chat/chatLogger'

export interface BilamoConversationExperienceProps {
  initialPrompt?: string | null
  autoListen?: boolean
}

type BilamoFlightCard = {
  id: string
  airline: string
  origin: string
  destination: string
  departTime: string
  arriveTime: string
  duration: string
  stopsLabel: string
  priceLabel: string
  reason?: string
  kindLabel?: string | null
  score?: number | null
  baggageSummary?: string | null
}

type BilamoHotelCard = {
  id: string
  name: string
  area: string
  rating: number
  nightsLabel: string
  priceLabel: string
  reason?: string
}

type BilamoFlightsStatus = {
  mode: 'demo' | 'live'
  error: string | null
  stale: boolean
  empty: boolean
  timedOut: boolean
}

type BilamoResultsView = {
  flights: BilamoFlightCard[]
  hotels: BilamoHotelCard[]
  timeline: TripTimelineItem[]
  flightsStatus: BilamoFlightsStatus | null
}

function moneyLabel(amount: unknown, currency: unknown): string {
  const cur = typeof currency === 'string' && currency.trim() ? currency : 'SAR'
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : null
  if (n == null) return cur
  return `${cur} ${n.toLocaleString('en-US')}`
}

function resultsFromAssistantMeta(meta: Record<string, unknown> | null | undefined): BilamoResultsView | null {
  if (!meta || typeof meta !== 'object') return null
  const bilamo = meta.bilamo as {
    search?: {
      flights?: Array<Record<string, unknown>>
      hotels?: Array<Record<string, unknown>>
      timeline?: Array<Record<string, unknown>>
      flightsMeta?: {
        mode?: string
        error?: string | null
        stale?: boolean
        bestScore?: number | null
      }
    } | null
  } | undefined
  const search = bilamo?.search
  const flightsMeta = search?.flightsMeta
  const errorStr = typeof flightsMeta?.error === 'string' ? flightsMeta.error : null
  const timedOut = /timeout/i.test(errorStr || '')
  const hasFlightIssue = Boolean(errorStr || flightsMeta?.stale)
  if (!search?.flights?.length && !search?.hotels?.length && !hasFlightIssue) return null

  const flights: BilamoFlightCard[] = (search?.flights || []).slice(0, 3).map((f, i) => ({
    id: String(f.id ?? `f-${i}`),
    airline: String(f.airline ?? 'Flight'),
    origin: String(f.origin ?? '—'),
    destination: String(f.destination ?? '—'),
    departTime: String(f.departTime ?? '—'),
    arriveTime: String(f.arriveTime ?? '—'),
    duration: String(f.duration ?? '—'),
    stopsLabel: String(f.stopsLabel ?? 'Nonstop'),
    priceLabel: moneyLabel(f.price, f.currency),
    reason: typeof f.reason === 'string' ? f.reason : undefined,
    kindLabel: typeof f.kindLabel === 'string' ? f.kindLabel : null,
    score: typeof f.score === 'number' ? f.score : null,
    baggageSummary: typeof f.baggageSummary === 'string' ? f.baggageSummary : null,
  }))

  const hotels: BilamoHotelCard[] = (search?.hotels || []).slice(0, 2).map((h, i) => ({
    id: String(h.id ?? `h-${i}`),
    name: String(h.name ?? 'Stay'),
    area: String(h.area ?? 'City center'),
    rating: typeof h.rating === 'number' ? h.rating : 4.6,
    nightsLabel: String(h.nightsLabel ?? 'Stay'),
    priceLabel: moneyLabel(h.price, h.currency),
    reason: typeof h.reason === 'string' ? h.reason : undefined,
  }))

  const timeline: TripTimelineItem[] = (search?.timeline || []).map((t, i) => ({
    id: String(t.id ?? `t-${i}`),
    time: String(t.time ?? ''),
    title: String(t.title ?? ''),
    detail: typeof t.detail === 'string' ? t.detail : undefined,
    kind: (t.kind as TripTimelineItem['kind']) || 'note',
  }))

  const flightsStatus: BilamoFlightsStatus | null = flightsMeta
    ? {
        mode: flightsMeta.mode === 'live' ? 'live' : 'demo',
        error: errorStr,
        stale: flightsMeta.stale === true,
        empty: flights.length === 0,
        timedOut,
      }
    : (flights.length === 0
      ? { mode: 'demo', error: null, stale: false, empty: true, timedOut: false }
      : null)

  return { flights, hotels, timeline, flightsStatus }
}

function makeLocalUserMessage(conversationId: string, content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `temp-${Date.now()}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content: content.trim(),
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

function presenceLine(state: OrbState, partial: string): string | null {
  if (state === 'listening' && partial.trim()) return partial.trim()
  return null
}

/**
 * Investor-demo living surface.
 * Recognizable by Orb + silence + typography — not by chat chrome.
 */
export function BilamoConversationExperience({
  initialPrompt = null,
  autoListen = false,
}: BilamoConversationExperienceProps) {
  const { user } = useAuth()
  const {
    level: micLevel,
    bands: micBands,
    error: micError,
    start: startMic,
    stop: stopMic,
  } = useBilamoMic()
  const abortRef = useRef<AbortController | null>(null)
  const silenceTimer = useRef<number | null>(null)
  const seededRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sendRef = useRef<(raw: string) => Promise<void>>(async () => {})
  const speakGenerationRef = useRef(0)

  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [results, setResults] = useState<BilamoResultsView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speakPulse, setSpeakPulse] = useState(0)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uiLocale, setUiLocale] = useState<'ar' | 'en'>(() =>
    typeof navigator !== 'undefined' && navigator.language?.startsWith('ar') ? 'ar' : 'en',
  )
  const voice = useBilamoSpeak()

  conversationIdRef.current = conversationId

  const displayName = useMemo(() => resolveDisplayName(user, uiLocale), [user, uiLocale])
  const greeting = useMemo(
    () => greetingForHour(new Date().getHours(), displayName, uiLocale),
    [displayName, uiLocale],
  )

  const inConversation = messages.length > 0 || busy || orbState !== 'idle'
  const copy = uiLocale === 'ar'
    ? {
        heroLead: 'هذا ما أختاره لك.',
        emptyFlights: 'لم أجد رحلة قوية بهذه التواريخ بعد.',
        emptySuggest: 'جرّب تواريخ أوسع، أو مدينة مغادرة أخرى، أو وجهة قريبة.',
        timeout: 'انتهت مهلة المزوّد — يمكننا إعادة المحاولة الآن.',
        tryAgain: 'أعد البحث',
        flexibleDates: 'تواريخ مرنة',
        nearbyIdeas: 'اقترح بدائل',
        stale: 'قد تكون الأسعار تحرّكت — قل لي إن أردت تحديثاً.',
        backup: 'استخدمت مخزوناً موثوقاً بعد تعثّر لحظي في التوفر.',
        providerError: 'تعذّر الوصول للمزوّد للحظة. يمكنك إعادة المحاولة.',
        compareTitle: 'مقارنة سريعة',
        compareSelect: 'اختيار',
        selectedStay: 'اختيارك محفوظ — الخيارات ما زالت ظاهرة.',
        micNeed: 'الميكروفون يحتاج إذناً',
        tapAgain: 'اضغط مجدداً عند الانتهاء من الكلام',
        somethingWrong: 'حدث خطأ ما',
        thinking: 'أفكّر…',
        type: 'اكتب',
        tip: 'اضغط على الكرة للتحدث، أو اكتب رسالتك.',
      }
    : {
        heroLead: 'Here is what I would choose for you.',
        emptyFlights: 'I could not find a strong flight match for those dates yet.',
        emptySuggest: 'Try more flexible dates, another departure city, or a nearby destination.',
        timeout: 'The provider timed out — we can retry right now.',
        tryAgain: 'Search again',
        flexibleDates: 'Flexible dates',
        nearbyIdeas: 'Suggest alternatives',
        stale: 'Prices may have shifted — say if you want me to refresh.',
        backup: 'I used a reliable backup inventory after a brief availability hiccup.',
        providerError: 'The provider paused for a moment. You can try again.',
        compareTitle: 'Quick compare',
        compareSelect: 'Select',
        selectedStay: 'Your choice is saved — recommendations stay visible.',
        micNeed: 'Microphone needs permission',
        tapAgain: 'Tap again when you finish speaking',
        somethingWrong: 'Something went wrong',
        thinking: 'Thinking…',
        type: 'Type',
        tip: 'Tap the orb to speak, or type your message.',
      }

  const stopListeningHard = useCallback(() => {
    stopMic()
    if (silenceTimer.current != null) {
      window.clearTimeout(silenceTimer.current)
      silenceTimer.current = null
    }
  }, [stopMic])

  const upsertMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === message.id)
      if (idx === -1) return [...prev, message]
      const next = [...prev]
      next[idx] = message
      return next
    })
  }, [])

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim()
      const validation = validateUserMessage(content)
      if (validation) {
        setError(validation)
        return
      }

      // Immediate barge-in: kill TTS + mic before the new turn starts.
      speakGenerationRef.current += 1
      voice.stop()
      stopListeningHard()

      setError(null)
      setBusy(true)
      setOrbState('thinking')
      setDraft('')
      // Sticky composer — stay open across turns once the traveler is typing.
      setComposerOpen(true)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const isSelectTurn = /^select\s+(flight|hotel)\s+/i.test(content)

      try {
        let id = conversationIdRef.current
        if (!id) {
          const created = await chatEngine.createConversation('Bilamo')
          id = created.id
          conversationIdRef.current = id
          setConversationId(id)
        }
        const temp = makeLocalUserMessage(id, content)
        setMessages((prev) => [...prev, temp])

        if (isSelectTurn) {
          const match = content.match(/^select\s+(flight|hotel)\s+(\S+)/i)
          if (match?.[2]) setSelectedId(match[2])
        }

        const result = await chatEngine.sendMessage(
          { conversationId: id, content, modality: 'text' },
          {
            signal: controller.signal,
            onAssistantCreate: (msg) => {
              // Text streaming uses thinking — speaking is reserved for audible TTS.
              setOrbState('thinking')
              upsertMessage(msg)
            },
            onDelta: upsertMessage,
            onComplete: (msg) => {
              upsertMessage(msg)
              setOrbState('completed')
              const next = resultsFromAssistantMeta(
                (msg.providerMeta as Record<string, unknown> | undefined) ?? null,
              )
              // Preserve prior recommendation cards on selection / non-search turns.
              if (next) {
                setResults(next)
                setCompareIds([])
                setDetailsId(null)
                if (!isSelectTurn) setSelectedId(null)
              }
              const meta = msg.providerMeta as {
                spokenText?: string
                memory?: { locale?: string }
                selectedBookingOptionId?: string | null
              } | undefined
              if (meta?.selectedBookingOptionId) {
                setSelectedId(meta.selectedBookingOptionId)
              }
              const locale = meta?.memory?.locale === 'ar' ? 'ar' : uiLocale
              setUiLocale(locale)
              const spoken = (meta?.spokenText || msg.content || '').trim()
              if (spoken) {
                const handle = voice.speak({ text: spoken, locale })
                speakGenerationRef.current = handle.generation
                void handle.done.finally(() => {
                  if (speakGenerationRef.current === handle.generation) {
                    window.setTimeout(() => setOrbState('idle'), 200)
                  }
                })
                setOrbState('speaking')
              } else {
                window.setTimeout(() => setOrbState('idle'), 500)
              }
            },
            onError: (msg, err) => {
              upsertMessage(msg)
              if (!isBenignChatError(err)) setError(err)
              voice.stop()
              setOrbState('idle')
            },
          },
        )

        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== temp.id && m.id !== result.assistant.id)
          return [...withoutTemp, result.user, result.assistant]
        })
      } catch (err) {
        if (!isBenignChatError(err)) {
          logChatError('bilamo.experience.send', err)
          setError(err instanceof Error ? err.message : copy.somethingWrong)
        }
        voice.stop()
        setOrbState('idle')
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setBusy(false)
      }
    },
    [copy.somethingWrong, stopListeningHard, uiLocale, upsertMessage, voice],
  )

  sendRef.current = send

  const handleSpeechFinal = useCallback(
    (transcript: string) => {
      stopListeningHard()
      void sendRef.current(transcript)
    },
    [stopListeningHard],
  )

  const {
    partial,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
  } = useBilamoSpeech(handleSpeechFinal)

  const stopListening = useCallback(() => {
    stopSpeech()
    stopListeningHard()
    setOrbState((prev) => (prev === 'listening' ? 'idle' : prev))
  }, [stopListeningHard, stopSpeech])

  // Ensure send() also stops speech recognition when barge-in happens mid-listen.
  const sendWithMicStop = useCallback(
    async (raw: string) => {
      stopSpeech()
      await send(raw)
    },
    [send, stopSpeech],
  )
  sendRef.current = sendWithMicStop

  const startListening = useCallback(async () => {
    setError(null)
    speakGenerationRef.current += 1
    voice.stop()
    // Keep prior recommendation cards visible while capturing the next utterance.
    const ok = await startMic()
    if (!ok) {
      setError(copy.micNeed)
      setComposerOpen(true)
      return
    }
    setOrbState('listening')
    bilamoHaptic(6)
    const lang = uiLocale === 'ar' || navigator.language?.startsWith('ar') ? 'ar-SA' : 'en-US'
    if (lang.startsWith('ar')) setUiLocale('ar')
    const started = startSpeech(lang)
    if (!started) {
      stopListeningHard()
      setOrbState('idle')
      setError(copy.tapAgain)
      setComposerOpen(true)
    }
  }, [
    copy.micNeed,
    copy.tapAgain,
    startMic,
    startSpeech,
    stopListeningHard,
    uiLocale,
    voice,
  ])

  const toggleOrb = useCallback(() => {
    bilamoHaptic(orbState === 'listening' ? 4 : 8)
    if (orbState === 'listening') {
      if (partial.trim()) {
        stopSpeech()
        stopListeningHard()
      } else {
        stopListening()
      }
      return
    }
    if (orbState === 'thinking' || orbState === 'speaking' || busy) {
      // Mic tap while speaking interrupts TTS only — no auto-relisten.
      if (orbState === 'speaking') {
        speakGenerationRef.current += 1
        voice.stop()
        setOrbState('idle')
      }
      return
    }
    void startListening()
  }, [
    busy,
    orbState,
    partial,
    startListening,
    stopListening,
    stopListeningHard,
    stopSpeech,
    voice,
  ])

  useEffect(() => {
    if (orbState !== 'listening') return
    if (silenceTimer.current != null) {
      window.clearTimeout(silenceTimer.current)
      silenceTimer.current = null
    }
    if (partial.trim() && micLevel < 0.025) {
      silenceTimer.current = window.setTimeout(() => {
        stopSpeech()
        stopListeningHard()
      }, 1100)
    }
    return () => {
      if (silenceTimer.current != null) {
        window.clearTimeout(silenceTimer.current)
        silenceTimer.current = null
      }
    }
  }, [micLevel, orbState, partial, stopListeningHard, stopSpeech])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, partial, results, busy, selectedId])

  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    if (initialPrompt) {
      setComposerOpen(true)
      void sendRef.current(initialPrompt)
      return
    }
    if (autoListen) void startListening()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (orbState !== 'speaking') {
      setSpeakPulse(0)
      return
    }
    const id = window.setInterval(() => setSpeakPulse((n) => n + 1), 90)
    return () => window.clearInterval(id)
  }, [orbState])

  const speakingBands = useMemo(() => {
    if (orbState !== 'speaking') return undefined
    return Array.from({ length: 32 }, (_, i) => {
      const t = speakPulse * 0.28 + i * 0.38
      return 0.18 + 0.48 * Math.abs(Math.sin(t)) * (0.6 + 0.4 * Math.abs(Math.cos(t * 0.65)))
    })
  }, [orbState, speakPulse])

  const level = orbState === 'listening' ? micLevel : orbState === 'speaking' ? 0.42 : 0
  const bands = orbState === 'listening' ? micBands : speakingBands
  const transcript = presenceLine(orbState, partial)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || busy) return
    bilamoHaptic(6)
    void sendWithMicStop(draft)
  }

  const selectFlight = (id: string) => {
    bilamoHaptic(6)
    setSelectedId(id)
    void sendWithMicStop(`select flight ${id}`)
  }

  const selectHotel = (id: string) => {
    bilamoHaptic(6)
    setSelectedId(id)
    void sendWithMicStop(`select hotel ${id}`)
  }

  const recoveryActions = (status: BilamoFlightsStatus) => {
    const actions: Array<{ label: string; prompt: string }> = [
      {
        label: copy.tryAgain,
        prompt: uiLocale === 'ar'
          ? 'أعد البحث عن الرحلات بنفس الوجهة'
          : 'Please search flights again for the same destination',
      },
      {
        label: copy.flexibleDates,
        prompt: uiLocale === 'ar'
          ? 'ابحث بتواريخ أكثر مرونة حول نفس الفترة'
          : 'Search again with more flexible dates around the same period',
      },
    ]
    if (status.timedOut || status.error) {
      actions.unshift({
        label: uiLocale === 'ar' ? 'أعد المحاولة الآن' : 'Retry now',
        prompt: uiLocale === 'ar'
          ? 'حاول مرة أخرى الآن بعد انتهاء المهلة'
          : 'Please retry the flight search now after the timeout',
      })
    }
    if (status.empty) {
      actions.push({
        label: copy.nearbyIdeas,
        prompt: uiLocale === 'ar'
          ? 'اقترح وجهات قريبة أو بدائل إن لم تتوفر رحلات'
          : 'Suggest nearby destinations or alternatives if flights are unavailable',
      })
    }
    return actions
  }

  return (
    <BilamoShell>
      <LayoutGroup>
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[24rem] flex-col px-8 pb-10 pt-14 sm:max-w-md">
          <header className="relative z-10 text-center">
            <Logo size={inConversation ? 'sm' : 'md'} className="justify-center" />
            <AnimatePresence mode="wait">
              {!inConversation ? (
                <motion.h1
                  key="greeting"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={springs.gentle}
                  className="mt-8 text-[1.9rem] font-medium leading-[1.12] tracking-[-0.045em] text-[var(--bilamo-text)] sm:text-[2.15rem]"
                >
                  {greeting}
                </motion.h1>
              ) : null}
            </AnimatePresence>
          </header>

          <section
            className={`relative z-10 flex flex-col items-center ${
              inConversation ? 'py-8' : 'flex-1 justify-center py-16'
            }`}
          >
            <motion.div layout transition={springs.soft}>
              <VoiceOrb
                state={orbState}
                level={level}
                bands={bands}
                size={inConversation ? 140 : 248}
                onClick={toggleOrb}
                label={orbState === 'listening' ? 'Stop' : 'Speak'}
              />
            </motion.div>

            <div className="mt-8 flex min-h-[1.4rem] items-center justify-center px-4">
              <AnimatePresence mode="wait">
                {transcript ? (
                  <motion.p
                    key={transcript.slice(0, 40)}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={springs.soft}
                    className="max-w-[18rem] text-center text-[14px] leading-relaxed tracking-[-0.01em] text-[var(--bilamo-muted)]"
                  >
                    {transcript}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {(micError || speechError || error) && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-5 max-w-[18rem] text-center text-[13px] leading-relaxed text-[var(--bilamo-danger)]/85"
                  role="alert"
                >
                  {error ?? micError ?? speechError}
                </motion.p>
              )}
            </AnimatePresence>
          </section>

          <AnimatePresence>
            {messages.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springs.soft}
                className="relative z-10 mb-2 flex-1 space-y-7 overflow-y-auto"
                aria-live="polite"
              >
                {messages.map((msg) => {
                  const isLastAssistant =
                    busy && msg.role === 'assistant' && msg === messages[messages.length - 1]
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={springs.soft}
                      className={msg.role === 'user' ? 'text-end' : 'text-start'}
                    >
                      {msg.role === 'user' ? (
                        <p className="inline-block max-w-[90%] text-[14px] leading-relaxed tracking-[-0.01em] text-[var(--bilamo-muted)]">
                          {msg.content}
                        </p>
                      ) : (
                        <p className="max-w-[98%] text-[16.5px] leading-[1.72] tracking-[-0.02em] whitespace-pre-wrap text-[var(--bilamo-text)]/93">
                          {msg.content || (isLastAssistant ? '' : '')}
                          {isLastAssistant ? (
                            <motion.span
                              aria-hidden
                              className="ml-1 inline-block h-1.5 w-1.5 translate-y-[-0.1em] rounded-full bg-[var(--bilamo-secondary)] align-middle"
                              animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.85, 1.05, 0.85] }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          ) : null}
                        </p>
                      )}
                    </motion.div>
                  )
                })}

                {busy && orbState === 'thinking' && !results ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={springs.soft}
                    className="space-y-2 pt-2"
                    aria-label={copy.thinking}
                  >
                    {[0, 1].map((i) => (
                      <motion.div
                        key={i}
                        className="bilamo-glass h-[4.5rem] rounded-[1.25rem]"
                        animate={{ opacity: [0.35, 0.7, 0.35] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </motion.div>
                ) : null}

                {selectedId && results ? (
                  <p className="px-1 text-[12.5px] text-[var(--bilamo-secondary)]/90">
                    {copy.selectedStay}
                  </p>
                ) : null}

                {results && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.soft, delay: 0.05 }}
                    className="space-y-2 pt-2"
                    layout
                  >
                    {results.flightsStatus?.empty && !results.flights.length ? (
                      <div className="space-y-3 px-1 py-2">
                        <p className="text-[13.5px] leading-relaxed text-[var(--bilamo-muted)]">
                          {results.flightsStatus.timedOut
                            ? copy.timeout
                            : results.flightsStatus.error
                              ? copy.providerError
                              : copy.emptyFlights}
                        </p>
                        <p className="text-[13px] leading-relaxed text-[var(--bilamo-text)]/75">
                          {copy.emptySuggest}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {recoveryActions(results.flightsStatus).map((action) => (
                            <button
                              key={action.label}
                              type="button"
                              onClick={() => void sendWithMicStop(action.prompt)}
                              className="text-[13px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <motion.p
                        layout
                        className="px-1 pb-2 text-[13.5px] leading-relaxed text-[var(--bilamo-muted)]"
                      >
                        {copy.heroLead}
                      </motion.p>
                    )}
                    {results.flightsStatus?.stale ? (
                      <div className="space-y-2 px-1">
                        <p className="text-[12.5px] text-[var(--bilamo-muted)]/90">
                          {copy.stale}
                        </p>
                        <button
                          type="button"
                          onClick={() => void sendWithMicStop(
                            uiLocale === 'ar'
                              ? 'حدّث نتائج الرحلات الآن'
                              : 'Please refresh the flight results now',
                          )}
                          className="text-[12.5px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline"
                        >
                          {copy.tryAgain}
                        </button>
                      </div>
                    ) : null}
                    {results.flightsStatus?.error && results.flights.length > 0 ? (
                      <p className="px-1 text-[12.5px] text-[var(--bilamo-muted)]/90">
                        {copy.backup}
                      </p>
                    ) : null}

                    <AnimatePresence initial={false}>
                      {compareIds.length >= 2 ? (
                        <motion.div
                          key="compare"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={springs.soft}
                          className="bilamo-glass mx-0 space-y-2 rounded-[1.25rem] px-5 py-4"
                        >
                          <p className="text-[12.5px] tracking-[-0.01em] text-[var(--bilamo-muted)]">
                            {copy.compareTitle}
                          </p>
                          {results.flights
                            .filter((f) => compareIds.includes(f.id))
                            .map((f) => (
                              <div
                                key={`cmp-${f.id}`}
                                className="flex items-baseline justify-between gap-3 border-t border-[var(--bilamo-border)] pt-2 first:border-0 first:pt-0"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-[13.5px] text-[var(--bilamo-text)]/90">
                                    {f.airline} · {f.stopsLabel}
                                  </p>
                                  <p className="text-[12px] text-[var(--bilamo-muted)]">
                                    {f.departTime} → {f.arriveTime}
                                    {f.score != null ? ` · ${f.score}` : ''}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <p className="tabular-nums text-[13px] text-[var(--bilamo-text)]">
                                    {f.priceLabel}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => selectFlight(f.id)}
                                    className="text-[12px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline"
                                  >
                                    {copy.compareSelect}
                                  </button>
                                </div>
                              </div>
                            ))}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    {results.flights.map((flight, i) => (
                      <motion.div
                        key={flight.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springs.soft, delay: 0.04 * i }}
                      >
                        <FlightCard
                          airline={flight.airline}
                          origin={flight.origin}
                          destination={flight.destination}
                          departTime={flight.departTime}
                          arriveTime={flight.arriveTime}
                          duration={flight.duration}
                          stopsLabel={flight.stopsLabel}
                          priceLabel={flight.priceLabel}
                          reason={flight.reason}
                          kindLabel={flight.kindLabel}
                          score={flight.score}
                          baggageSummary={flight.baggageSummary}
                          highlighted={i === 0 && selectedId == null}
                          selected={selectedId === flight.id}
                          locale={uiLocale}
                          onSelect={() => selectFlight(flight.id)}
                          onCompare={() => {
                            setCompareIds((prev) => {
                              if (prev.includes(flight.id)) return prev.filter((id) => id !== flight.id)
                              return [...prev, flight.id].slice(-3)
                            })
                            bilamoHaptic(4)
                          }}
                          onViewDetails={() => {
                            setDetailsId((prev) => (prev === flight.id ? null : flight.id))
                            bilamoHaptic(4)
                          }}
                        />
                        <AnimatePresence>
                          {detailsId === flight.id ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={springs.soft}
                              className="overflow-hidden px-5 pb-3"
                            >
                              <p className="text-[13px] leading-relaxed text-[var(--bilamo-text)]/75">
                                {flight.reason
                                  || (uiLocale === 'ar'
                                    ? 'تفاصيل هذه التوصية مرتبطة بتوازن السعر والراحة والتوقيت.'
                                    : 'This recommendation balances price, comfort, and schedule fit.')}
                              </p>
                              <p className="mt-1 text-[12px] text-[var(--bilamo-muted)]">
                                {[flight.duration, flight.stopsLabel, flight.baggageSummary]
                                  .filter(Boolean)
                                  .join(' · ')}
                                {flight.score != null ? ` · Score ${flight.score}` : ''}
                              </p>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                    {results.hotels.map((hotel, i) => (
                      <motion.div
                        key={hotel.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springs.soft, delay: 0.04 * (results.flights.length + i) }}
                      >
                        <HotelCard
                          {...hotel}
                          highlighted={i === 0 && selectedId == null}
                          selected={selectedId === hotel.id}
                          locale={uiLocale}
                          onSelect={() => selectHotel(hotel.id)}
                          onViewDetails={() => {
                            setDetailsId((prev) => (prev === hotel.id ? null : hotel.id))
                            bilamoHaptic(4)
                          }}
                        />
                        <AnimatePresence>
                          {detailsId === hotel.id ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={springs.soft}
                              className="overflow-hidden px-5 pb-3"
                            >
                              <p className="text-[13px] leading-relaxed text-[var(--bilamo-text)]/75">
                                {hotel.reason
                                  || (uiLocale === 'ar'
                                    ? 'اخترت هذا الفندق لتوازن الموقع والهدوء وجودة الإقامة.'
                                    : 'I chose this stay for location calm, fit, and overnight value.')}
                              </p>
                              <p className="mt-1 text-[12px] text-[var(--bilamo-muted)]">
                                {hotel.area} · {hotel.nightsLabel} · {hotel.rating.toFixed(1)}
                              </p>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                    {results.timeline.length > 0 ? (
                      <motion.div
                        layout
                        className="px-5 py-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ ...springs.gentle, delay: 0.12 }}
                      >
                        <TripTimeline items={results.timeline} />
                      </motion.div>
                    ) : null}
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </motion.section>
            )}
          </AnimatePresence>

          {!inConversation && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...springs.gentle, delay: 0.25 }}
              className="relative z-10 mt-auto px-1 text-center text-[12.5px] leading-relaxed text-[var(--bilamo-muted)]/70"
            >
              {copy.tip}
            </motion.p>
          )}

          <div className="relative z-10 mt-6 flex flex-col items-center">
            <AnimatePresence mode="wait">
              {!composerOpen ? (
                <motion.button
                  key="type"
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setComposerOpen(true)}
                  className="text-[12px] tracking-[-0.01em] text-[var(--bilamo-muted)]/40 transition-colors hover:text-[var(--bilamo-muted)]/75"
                >
                  {copy.type}
                </motion.button>
              ) : (
                <motion.form
                  key="composer"
                  onSubmit={onSubmit}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={springs.soft}
                  className="bilamo-glass flex w-full items-end gap-2 rounded-full p-1.5 pl-5"
                >
                  <textarea
                    autoFocus
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (draft.trim() && !busy) void sendWithMicStop(draft)
                      }
                      if (e.key === 'Escape' && !inConversation) setComposerOpen(false)
                    }}
                    placeholder=""
                    aria-label="Message"
                    disabled={busy}
                    className="max-h-28 min-h-[40px] min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-snug tracking-[-0.01em] text-[var(--bilamo-text)] outline-none"
                  />
                  <Button
                    type="submit"
                    size="iconSm"
                    variant="primary"
                    disabled={busy || !draft.trim()}
                    aria-label="Send"
                    className="shrink-0"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </LayoutGroup>
    </BilamoShell>
  )
}
