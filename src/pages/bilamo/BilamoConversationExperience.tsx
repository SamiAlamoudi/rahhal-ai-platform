import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Keyboard, X } from 'lucide-react'
import {
  BilamoShell,
  Button,
  FlightCard,
  HotelCard,
  Logo,
  Textarea,
  TripTimeline,
  VoiceOrb,
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
  /** Optional seed prompt from navigation */
  initialPrompt?: string | null
  autoListen?: boolean
}

interface RecentConversation {
  id: string
  title: string
  preview: string
}

const DEMO_RECENT: RecentConversation[] = [
  {
    id: 'recent-1',
    title: 'Weekend in Lisbon',
    preview: 'Quiet stay near Chiado · flexible Friday',
  },
]

const DEMO_FLIGHTS = [
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
]

const DEMO_HOTELS = [
  {
    id: 'h1',
    name: 'Edition Istanbul',
    area: 'Karaköy',
    rating: 4.8,
    nightsLabel: '4 nights',
    priceLabel: 'SAR 3,200',
    reason: 'Quiet luxury near the water — calm evenings.',
  },
]

const DEMO_TIMELINE: TripTimelineItem[] = [
  {
    id: 't1',
    time: 'Day 1 · Morning',
    title: 'Arrive Istanbul',
    detail: 'Soft landing. Transfer to Karaköy.',
    kind: 'flight',
  },
  {
    id: 't2',
    time: 'Day 1 · Evening',
    title: 'Edition Istanbul',
    detail: 'Corner suite with Bosphorus light.',
    kind: 'hotel',
  },
]

function looksLikeSearchIntent(text: string): boolean {
  return /istanbul|lisbon|paris|flight|hotel|trip|travel|إسطنبول|باريس|رحلة|فندق|طيران/i.test(
    text,
  )
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

function statusLabel(state: OrbState, partial: string): string {
  if (state === 'listening') {
    return partial ? partial : 'Listening…'
  }
  if (state === 'thinking') return 'Thinking…'
  if (state === 'speaking') return 'Bilamo is speaking…'
  if (state === 'completed') return 'Done'
  return 'Tap the orb to speak'
}

/**
 * Single living Bilamo surface.
 * Brand · Greeting · Orb · Conversation · Recent.
 * No dashboard. No chrome.
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
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
              if (looksLikeSearchIntent(content)) setShowResults(true)
              window.setTimeout(() => setOrbState('idle'), 1100)
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

  const handleSpeechFinal = useCallback((transcript: string) => {
    stopMic()
    if (silenceTimer.current != null) {
      window.clearTimeout(silenceTimer.current)
      silenceTimer.current = null
    }
    void sendRef.current(transcript)
  }, [stopMic])

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
    setShowResults(false)
    const ok = await startMic()
    if (!ok) {
      setError('Microphone unavailable')
      setComposerOpen(true)
      return
    }
    setOrbState('listening')
    const started = startSpeech(
      typeof navigator !== 'undefined' && navigator.language?.startsWith('ar')
        ? 'ar-SA'
        : 'en-US',
    )
    if (!started) {
      setError('Speak, then tap the orb again to finish')
    }
  }, [startMic, startSpeech])

  const toggleOrb = useCallback(() => {
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

  // Auto-end listen after sustained silence once speech was detected.
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
  }, [messages, partial, showResults, busy])

  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    if (initialPrompt) {
      void sendRef.current(initialPrompt)
      return
    }
    if (autoListen) {
      void startListening()
    }
    // Intentionally once on mount for navigation seeds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || busy) return
    void send(draft)
  }

  const [speakPulse, setSpeakPulse] = useState(0)
  useEffect(() => {
    if (orbState !== 'speaking') {
      setSpeakPulse(0)
      return
    }
    const id = window.setInterval(() => {
      setSpeakPulse((n) => n + 1)
    }, 80)
    return () => window.clearInterval(id)
  }, [orbState])

  const speakingBands = useMemo(() => {
    if (orbState !== 'speaking') return undefined
    return Array.from({ length: 32 }, (_, i) => {
      const t = speakPulse * 0.35 + i * 0.4
      return 0.22 + 0.55 * Math.abs(Math.sin(t)) * (0.55 + 0.45 * Math.abs(Math.cos(t * 0.7)))
    })
  }, [orbState, speakPulse])

  const level = orbState === 'listening' ? micLevel : orbState === 'speaking' ? 0.55 : 0
  const bands = orbState === 'listening' ? micBands : speakingBands

  return (
    <BilamoShell>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-6 pb-10 pt-10 sm:px-8">
        {/* Brand + greeting — generous Apple-level air */}
        <header className="relative z-10 space-y-5 text-center">
          <Logo size="md" className="justify-center" />
          <AnimatePresence mode="wait">
            {!inConversation ? (
              <motion.h1
                key="greeting"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={springs.gentle}
                className="text-[1.75rem] font-medium tracking-[-0.03em] text-[var(--bilamo-text)] sm:text-[2.15rem]"
              >
                {greeting}
              </motion.h1>
            ) : (
              <motion.p
                key="presence"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={springs.soft}
                className="text-sm font-medium tracking-wide text-[var(--bilamo-muted)]"
              >
                Bilamo
              </motion.p>
            )}
          </AnimatePresence>
        </header>

        {/* Orb — identity */}
        <section
          className={`relative z-10 flex flex-col items-center ${
            inConversation ? 'py-8' : 'flex-1 justify-center py-12'
          }`}
        >
          <VoiceOrb
            state={orbState}
            level={level}
            bands={bands}
            size={inConversation ? 168 : 248}
            onClick={toggleOrb}
            label={orbState === 'listening' ? 'Stop listening' : 'Start talking'}
          />

          <AnimatePresence mode="wait">
            <motion.p
              key={`${orbState}-${partial.slice(0, 24)}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={springs.soft}
              className="mt-8 max-w-sm px-4 text-center text-[15px] leading-relaxed text-[var(--bilamo-muted)]"
            >
              {statusLabel(orbState, partial)}
            </motion.p>
          </AnimatePresence>

          {(micError || speechError || error) && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 max-w-sm text-center text-sm text-[var(--bilamo-danger)]"
              role="alert"
            >
              {error ?? micError ?? speechError}
            </motion.p>
          )}
        </section>

        {/* Conversation stream */}
        <AnimatePresence>
          {messages.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springs.soft}
              className="relative z-10 mb-6 flex-1 space-y-5 overflow-y-auto"
              aria-live="polite"
            >
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={springs.soft}
                  className={
                    msg.role === 'user'
                      ? 'ml-auto max-w-[88%] rounded-[1.35rem] rounded-br-md bg-[color-mix(in_srgb,var(--bilamo-primary)_24%,transparent)] px-5 py-3.5 shadow-[0_10px_40px_rgba(0,0,0,0.18)]'
                      : 'mr-auto max-w-[94%]'
                  }
                >
                  {msg.content ? (
                    <p className="text-[15.5px] leading-[1.65] tracking-[-0.01em] whitespace-pre-wrap text-[var(--bilamo-text)]">
                      {msg.content}
                    </p>
                  ) : busy && msg.role === 'assistant' ? (
                    <span className="inline-flex gap-1 px-1 py-2" aria-label="Streaming">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--bilamo-muted)]"
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{
                            duration: 0.9,
                            repeat: Infinity,
                            delay: i * 0.12,
                          }}
                        />
                      ))}
                    </span>
                  ) : null}
                </motion.div>
              ))}

              {showResults && (
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.soft, delay: 0.08 }}
                  className="space-y-4 pt-2"
                >
                  {DEMO_FLIGHTS.map((flight, i) => (
                    <FlightCard key={flight.id} {...flight} highlighted={i === 0} />
                  ))}
                  {DEMO_HOTELS.map((hotel, i) => (
                    <HotelCard key={hotel.id} {...hotel} highlighted={i === 0} />
                  ))}
                  <div className="bilamo-glass rounded-[1.75rem] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                    <TripTimeline items={DEMO_TIMELINE} />
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </motion.section>
          )}
        </AnimatePresence>

        {/* Recent — only when idle and empty */}
        {!inConversation && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.gentle, delay: 0.12 }}
            className="relative z-10 mt-auto space-y-3 pb-2"
          >
            <p className="text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--bilamo-muted)]">
              Recent conversation
            </p>
            {DEMO_RECENT.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => void send(`Continue: ${item.title}`)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                transition={springs.snappy}
                className="bilamo-glass w-full rounded-[1.35rem] px-5 py-4 text-start shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
              >
                <p className="text-[15px] font-medium tracking-tight text-[var(--bilamo-text)]">
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-[var(--bilamo-muted)]">{item.preview}</p>
              </motion.button>
            ))}
          </motion.section>
        )}

        {/* Minimal composer affordance — not a toolbar */}
        <div className="relative z-10 mt-6 flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={composerOpen ? 'Close keyboard' : 'Type a message'}
            onClick={() => setComposerOpen((v) => !v)}
          >
            {composerOpen ? <X className="h-5 w-5" /> : <Keyboard className="h-5 w-5" />}
          </Button>
        </div>

        <AnimatePresence>
          {composerOpen && (
            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
              transition={springs.soft}
              className="bilamo-glass relative z-10 mt-3 space-y-3 rounded-[1.75rem] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)]"
            >
              <Textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Speak with Bilamo…"
                aria-label="Message Bilamo"
                className="min-h-[96px] border-0 bg-transparent shadow-none focus:shadow-none"
              />
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={busy || !draft.trim()}
              >
                Send
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </BilamoShell>
  )
}
