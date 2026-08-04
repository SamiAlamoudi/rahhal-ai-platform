import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Mic, Plus } from 'lucide-react'
import {
  BilamoShell,
  BottomNavigation,
  Button,
  FlightCard,
  HotelCard,
  Logo,
  TripTimeline,
  VoiceOrb,
  springs,
  type OrbState,
  type TripTimelineItem,
} from '../design-system'
import { chatEngine } from '../lib/chat/chatEngine'
import type { ChatMessage } from '../lib/chat/chatTypes'
import { validateUserMessage } from '../lib/chat/chatHelpers'
import { isBenignChatError, logChatError } from '../lib/chat/chatLogger'

interface LocationSeed {
  initialPrompt?: string
  tripText?: string
  voiceStart?: boolean
}

interface DemoResultBundle {
  flights: Array<{
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
  }>
  hotels: Array<{
    id: string
    name: string
    area: string
    rating: number
    nightsLabel: string
    priceLabel: string
    reason?: string
  }>
  timeline: TripTimelineItem[]
}

const DEMO_RESULTS: DemoResultBundle = {
  flights: [
    {
      id: 'f1',
      airline: 'Saudia',
      origin: 'RUH',
      destination: 'IST',
      departTime: '08:40',
      arriveTime: '12:55',
      duration: '4h 15m',
      stopsLabel: 'Nonstop',
      priceLabel: 'SAR 1,890',
      reason: 'Best balance of schedule, comfort, and total cost.',
    },
    {
      id: 'f2',
      airline: 'Turkish Airlines',
      origin: 'RUH',
      destination: 'IST',
      departTime: '14:10',
      arriveTime: '18:35',
      duration: '4h 25m',
      stopsLabel: 'Nonstop',
      priceLabel: 'SAR 2,140',
    },
  ],
  hotels: [
    {
      id: 'h1',
      name: 'Edition Istanbul',
      area: 'Karaköy',
      rating: 4.8,
      nightsLabel: '4 nights',
      priceLabel: 'SAR 3,200',
      reason: 'Quiet luxury near the water — matches your preference for calm evenings.',
    },
    {
      id: 'h2',
      name: 'The Peninsula',
      area: 'Karaköy',
      rating: 4.9,
      nightsLabel: '4 nights',
      priceLabel: 'SAR 4,850',
    },
  ],
  timeline: [
    {
      id: 't1',
      time: 'Day 1 · Morning',
      title: 'Arrive Istanbul',
      detail: 'Private transfer to Karaköy. Soft landing afternoon.',
      kind: 'flight',
    },
    {
      id: 't2',
      time: 'Day 1 · Evening',
      title: 'Check-in · Edition Istanbul',
      detail: 'Corner suite with Bosphorus light.',
      kind: 'hotel',
    },
    {
      id: 't3',
      time: 'Day 2',
      title: 'Slow morning in Galata',
      detail: 'Coffee, bookstore, waterfront walk — no rush.',
      kind: 'activity',
    },
  ],
}

function looksLikeSearchIntent(text: string): boolean {
  const t = text.toLowerCase()
  return /istanbul|lisbon|paris|flight|hotel|trip|travel|إسطنبول|باريس|رحلة|فندق|طيران/.test(t)
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

/**
 * Bilamo conversation surface — minimal, intelligent, alive.
 * Uses the same chatEngine spine as the legacy chat route.
 */
export default function BilamoChat() {
  const navigate = useNavigate()
  const location = useLocation()
  const seed = (location.state as LocationSeed | null) ?? null
  const seededRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showResults, busy])

  const upsertMessage = (message: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === message.id)
      if (idx === -1) return [...prev, message]
      const next = [...prev]
      next[idx] = message
      return next
    })
  }

  const ensureConversation = async () => {
    if (conversationId) return conversationId
    const created = await chatEngine.createConversation('Bilamo')
    setConversationId(created.id)
    return created.id
  }

  const send = async (raw: string) => {
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

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let id = conversationId
    try {
      id = await ensureConversation()
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
            if (looksLikeSearchIntent(content)) setShowResults(true)
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
        logChatError('bilamo.chat.send', err)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
      setOrbState('idle')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
    }
  }

  useEffect(() => {
    if (seededRef.current) return
    const prompt = seed?.initialPrompt ?? seed?.tripText
    if (prompt) {
      seededRef.current = true
      void send(prompt)
      navigate(location.pathname, { replace: true, state: null })
      return
    }
    if (seed?.voiceStart) {
      seededRef.current = true
      setOrbState('listening')
      window.setTimeout(() => setOrbState('idle'), 1200)
      navigate(location.pathname, { replace: true, state: null })
    }
    // Seed once from navigation state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || busy) return
    void send(draft)
  }

  return (
    <BilamoShell className="pb-28">
      <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-4 pt-6 sm:px-6">
        <header className="mb-4 flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="text-start">
            <Logo size="sm" />
          </button>
          <div className="flex items-center gap-2">
            <VoiceOrb state={orbState} size={56} className="shrink-0" />
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="New conversation"
              onClick={() => {
                abortRef.current?.abort()
                setConversationId(null)
                setMessages([])
                setShowResults(false)
                setError(null)
                setOrbState('idle')
              }}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 pb-36">
          {messages.length === 0 && !busy ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springs.gentle}
              className="flex flex-1 flex-col items-center justify-center px-6 text-center"
            >
              <VoiceOrb state="idle" size={160} />
              <h1 className="mt-8 text-3xl font-semibold tracking-tight text-[var(--bilamo-text)]">
                What do you need?
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--bilamo-muted)]">
                Speak naturally. Bilamo extracts what matters — no forms, no clutter.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.soft}
                  className={
                    msg.role === 'user'
                      ? 'ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-[color-mix(in_srgb,var(--bilamo-primary)_28%,transparent)] px-4 py-3 text-[var(--bilamo-text)]'
                      : 'mr-auto max-w-[92%] space-y-2'
                  }
                >
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--bilamo-text)]">
                    {msg.content || (busy && msg.role === 'assistant' ? '…' : '')}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {showResults ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springs.soft}
              className="mt-4 space-y-6"
              aria-label="Recommendations"
            >
              <div className="space-y-3">
                <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--bilamo-muted)]">
                  Flights
                </h2>
                {DEMO_RESULTS.flights.map((flight, i) => (
                  <FlightCard key={flight.id} {...flight} highlighted={i === 0} />
                ))}
              </div>
              <div className="space-y-3">
                <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--bilamo-muted)]">
                  Stays
                </h2>
                {DEMO_RESULTS.hotels.map((hotel, i) => (
                  <HotelCard key={hotel.id} {...hotel} highlighted={i === 0} />
                ))}
              </div>
              <div className="bilamo-glass rounded-3xl p-5">
                <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-[var(--bilamo-muted)]">
                  Trip timeline
                </h2>
                <TripTimeline items={DEMO_RESULTS.timeline} />
              </div>
            </motion.section>
          ) : null}

          {error ? (
            <p className="text-center text-sm text-[var(--bilamo-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <div ref={bottomRef} />
        </main>
      </div>

      <form
        onSubmit={onSubmit}
        className="fixed inset-x-0 bottom-[4.75rem] z-40 mx-auto w-full max-w-2xl px-4"
      >
        <div className="bilamo-glass flex items-end gap-2 rounded-full p-2 pl-4">
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            aria-label="Voice"
            onClick={() => {
              setOrbState('listening')
              window.setTimeout(() => setOrbState('idle'), 1500)
            }}
          >
            <Mic className="h-5 w-5" />
          </Button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message Bilamo…"
            aria-label="Message Bilamo"
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--bilamo-text)] outline-none placeholder:text-[var(--bilamo-muted)]"
          />
          <Button
            type="submit"
            size="iconSm"
            variant="primary"
            disabled={busy || !draft.trim()}
            aria-label="Send"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>
      </form>

      <BottomNavigation />
    </BilamoShell>
  )
}
