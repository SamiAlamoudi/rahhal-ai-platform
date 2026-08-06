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

const DEMO_RECENT = {
  id: 'recent-1',
  title: 'Weekend in Lisbon',
  preview: 'Quiet stay near Chiado',
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
  const hasFlightIssue = Boolean(flightsMeta?.error || flightsMeta?.stale)
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
        error: typeof flightsMeta.error === 'string' ? flightsMeta.error : null,
        stale: flightsMeta.stale === true,
        empty: flights.length === 0,
      }
    : (flights.length === 0 ? { mode: 'demo', error: null, stale: false, empty: true } : null)

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

  conversationIdRef.current = conversationId

  const displayName = useMemo(() => resolveDisplayName(user), [user])
  const greeting = useMemo(
    () => greetingForHour(new Date().getHours(), displayName),
    [displayName],
  )

  const inConversation = messages.length > 0 || busy || orbState !== 'idle'

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

      setError(null)
      setBusy(true)
      setOrbState('thinking')
      setDraft('')
      setComposerOpen(false)

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

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

        const result = await chatEngine.sendMessage(
          { conversationId: id, content, modality: 'text' },
          {
            signal: controller.signal,
            onAssistantCreate: (msg) => {
              setOrbState('speaking')
              upsertMessage(msg)
            },
            onDelta: upsertMessage,
            onComplete: (msg) => {
              upsertMessage(msg)
              setOrbState('completed')
              const next = resultsFromAssistantMeta(
                (msg.providerMeta as Record<string, unknown> | undefined) ?? null,
              )
              if (next) setResults(next)
              window.setTimeout(() => setOrbState('idle'), 900)
            },
            onError: (msg, err) => {
              upsertMessage(msg)
              if (!isBenignChatError(err)) setError(err)
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
          setError(err instanceof Error ? err.message : 'Something went wrong')
        }
        setOrbState('idle')
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setBusy(false)
      }
    },
    [upsertMessage],
  )

  sendRef.current = send

  const handleSpeechFinal = useCallback(
    (transcript: string) => {
      stopMic()
      if (silenceTimer.current != null) {
        window.clearTimeout(silenceTimer.current)
        silenceTimer.current = null
      }
      void sendRef.current(transcript)
    },
    [stopMic],
  )

  const {
    partial,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
  } = useBilamoSpeech(handleSpeechFinal)

  const stopListening = useCallback(() => {
    stopSpeech()
    stopMic()
    if (silenceTimer.current != null) {
      window.clearTimeout(silenceTimer.current)
      silenceTimer.current = null
    }
    setOrbState((prev) => (prev === 'listening' ? 'idle' : prev))
  }, [stopMic, stopSpeech])

  const startListening = useCallback(async () => {
    setError(null)
    setResults(null)
    const ok = await startMic()
    if (!ok) {
      setError('Microphone needs permission')
      setComposerOpen(true)
      return
    }
    setOrbState('listening')
    bilamoHaptic(6)
    const started = startSpeech(
      typeof navigator !== 'undefined' && navigator.language?.startsWith('ar')
        ? 'ar-SA'
        : 'en-US',
    )
    if (!started) {
      setError('Tap again when you finish speaking')
    }
  }, [startMic, startSpeech])

  const toggleOrb = useCallback(() => {
    bilamoHaptic(orbState === 'listening' ? 4 : 8)
    if (orbState === 'listening') {
      if (partial.trim()) {
        stopSpeech()
        stopMic()
      } else {
        stopListening()
      }
      return
    }
    if (orbState === 'thinking' || orbState === 'speaking' || busy) return
    void startListening()
  }, [
    busy,
    orbState,
    partial,
    startListening,
    stopListening,
    stopMic,
    stopSpeech,
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
        stopMic()
      }, 1100)
    }
    return () => {
      if (silenceTimer.current != null) {
        window.clearTimeout(silenceTimer.current)
        silenceTimer.current = null
      }
    }
  }, [micLevel, orbState, partial, stopMic, stopSpeech])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, partial, results, busy])

  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    if (initialPrompt) {
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
    void send(draft)
  }

  return (
    <BilamoShell>
      <LayoutGroup>
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[24rem] flex-col px-8 pb-10 pt-14 sm:max-w-md">
          {/* Wordmark — quiet. Orb carries identity. */}
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

          {/* Orb — the product */}
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

          {/* Dialogue — journal of intelligence, not a chat thread */}
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

                {results && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.soft, delay: 0.05 }}
                    className="space-y-2 pt-2"
                  >
                    {results.flightsStatus?.empty && !results.flights.length ? (
                      <div className="space-y-3 px-1 py-2">
                        <p className="text-[13.5px] leading-relaxed text-[var(--bilamo-muted)]">
                          I could not find a strong flight match for those dates yet.
                        </p>
                        <button
                          type="button"
                          onClick={() => void send('Please search flights again with flexible dates')}
                          className="text-[13px] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
                        >
                          Try again
                        </button>
                      </div>
                    ) : (
                      <p className="px-1 pb-2 text-[13.5px] leading-relaxed text-[var(--bilamo-muted)]">
                        Here is what I would choose for you.
                      </p>
                    )}
                    {results.flightsStatus?.stale ? (
                      <p className="px-1 text-[12.5px] text-[var(--bilamo-muted)]/90">
                        Prices may have shifted — say if you want me to refresh.
                      </p>
                    ) : null}
                    {results.flightsStatus?.error && results.flights.length > 0 ? (
                      <p className="px-1 text-[12.5px] text-[var(--bilamo-muted)]/90">
                        I used a reliable backup inventory after a brief availability hiccup.
                      </p>
                    ) : null}
                    {results.flights.map((flight, i) => (
                      <FlightCard
                        key={flight.id}
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
                        highlighted={i === 0}
                        onSelect={() => void send(`Select the ${flight.airline} flight at ${flight.departTime}`)}
                        onCompare={() => void send(`Compare these flight options for me`)}
                        onViewDetails={() => void send(`Tell me more about the ${flight.airline} option at ${flight.departTime}`)}
                      />
                    ))}
                    {results.hotels.map((hotel, i) => (
                      <HotelCard key={hotel.id} {...hotel} highlighted={i === 0} />
                    ))}
                    {results.timeline.length > 0 ? (
                      <div className="px-5 py-4">
                        <TripTimeline items={results.timeline} />
                      </div>
                    ) : null}
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </motion.section>
            )}
          </AnimatePresence>

          {/* Recent — a memory, not a widget */}
          {!inConversation && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...springs.gentle, delay: 0.25 }}
              className="relative z-10 mt-auto"
            >
              <motion.button
                type="button"
                onClick={() => {
                  bilamoHaptic(5)
                  void send(`Continue: ${DEMO_RECENT.title}`)
                }}
                whileTap={{ scale: 0.99 }}
                transition={springs.press}
                className="w-full border-t border-[var(--bilamo-border)] px-1 py-5 text-start"
              >
                <p className="text-[14px] font-medium tracking-[-0.02em] text-[var(--bilamo-text)]/88">
                  {DEMO_RECENT.title}
                </p>
                <p className="mt-1 text-[12.5px] text-[var(--bilamo-muted)]/80">
                  {DEMO_RECENT.preview}
                </p>
              </motion.button>
            </motion.section>
          )}

          {/* Type — almost invisible until needed */}
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
                  Type
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
                        if (draft.trim() && !busy) void send(draft)
                      }
                      if (e.key === 'Escape') setComposerOpen(false)
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
