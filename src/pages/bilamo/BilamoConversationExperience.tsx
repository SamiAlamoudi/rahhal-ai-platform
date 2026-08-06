import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ArrowUp, Keyboard } from 'lucide-react'
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

/** Presence copy — never instruct, never narrate software. */
function presenceLine(state: OrbState, partial: string): string | null {
  if (state === 'listening' && partial.trim()) return partial.trim()
  return null
}

function StreamingCaret() {
  return (
    <motion.span
      aria-hidden
      className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.12em] rounded-full bg-[var(--bilamo-text)]/70 align-middle"
      animate={{ opacity: [0.15, 0.85, 0.15] }}
      transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

/**
 * Living Bilamo surface — polish pass.
 * Brand · Greeting · Orb · Conversation · Recent.
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
    setShowResults(false)
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
  }, [messages, partial, showResults, busy])

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
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[26rem] flex-col px-7 pb-8 pt-12 sm:max-w-md sm:px-8">
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
                  className="mt-7 text-[1.85rem] font-medium leading-[1.15] tracking-[-0.04em] text-[var(--bilamo-text)] sm:text-[2.05rem]"
                >
                  {greeting}
                </motion.h1>
              ) : null}
            </AnimatePresence>
          </header>

          <section
            className={`relative z-10 flex flex-col items-center ${
              inConversation ? 'py-7' : 'flex-1 justify-center py-14'
            }`}
          >
            <motion.div layout transition={springs.soft}>
              <VoiceOrb
                state={orbState}
                level={level}
                bands={bands}
                size={inConversation ? 152 : 236}
                onClick={toggleOrb}
                label={orbState === 'listening' ? 'Stop' : 'Speak'}
              />
            </motion.div>

            <div className="mt-7 flex min-h-[1.5rem] items-center justify-center px-5">
              <AnimatePresence mode="wait">
                {transcript ? (
                  <motion.p
                    key={transcript.slice(0, 48)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={springs.soft}
                    className="max-w-xs text-center text-[14.5px] leading-relaxed tracking-[-0.01em] text-[var(--bilamo-muted)]"
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
                  className="mt-4 max-w-xs text-center text-[13px] leading-relaxed text-[var(--bilamo-danger)]/90"
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springs.soft}
                className="relative z-10 mb-4 flex-1 space-y-6 overflow-y-auto"
                aria-live="polite"
              >
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springs.soft}
                    className={
                      msg.role === 'user'
                        ? 'ml-auto max-w-[86%] rounded-[1.25rem] bg-white/[0.06] px-4 py-3'
                        : 'mr-auto max-w-[96%]'
                    }
                  >
                    {msg.content ? (
                      <p
                        className={
                          msg.role === 'assistant'
                            ? 'text-[16px] leading-[1.7] tracking-[-0.015em] whitespace-pre-wrap text-[var(--bilamo-text)]/92'
                            : 'text-[15px] leading-[1.55] tracking-[-0.01em] whitespace-pre-wrap text-[var(--bilamo-text)]/90'
                        }
                      >
                        {msg.content}
                        {busy && msg.role === 'assistant' && msg === messages[messages.length - 1] ? (
                          <StreamingCaret />
                        ) : null}
                      </p>
                    ) : busy && msg.role === 'assistant' ? (
                      <StreamingCaret />
                    ) : null}
                  </motion.div>
                ))}

                {showResults && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.soft, delay: 0.06 }}
                    className="space-y-3 pt-1"
                  >
                    {DEMO_FLIGHTS.map((flight, i) => (
                      <FlightCard key={flight.id} {...flight} highlighted={i === 0} />
                    ))}
                    {DEMO_HOTELS.map((hotel, i) => (
                      <HotelCard key={hotel.id} {...hotel} highlighted={i === 0} />
                    ))}
                    <div className="bilamo-glass rounded-[1.5rem] px-6 py-5">
                      <TripTimeline items={DEMO_TIMELINE} />
                    </div>
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </motion.section>
            )}
          </AnimatePresence>

          {!inConversation && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...springs.gentle, delay: 0.2 }}
              className="relative z-10 mt-auto pb-1"
            >
              {DEMO_RECENT.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    bilamoHaptic(5)
                    void send(`Continue: ${item.title}`)
                  }}
                  whileTap={{ scale: 0.99 }}
                  transition={springs.press}
                  className="bilamo-glass-subtle w-full rounded-[1.25rem] px-5 py-4 text-start"
                >
                  <p className="text-[14.5px] font-medium tracking-[-0.02em] text-[var(--bilamo-text)]/90">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--bilamo-muted)]/85">{item.preview}</p>
                </motion.button>
              ))}
            </motion.section>
          )}

          <div className="relative z-10 mt-8 flex flex-col items-center">
            <AnimatePresence mode="wait">
              {!composerOpen ? (
                <motion.div
                  key="affordance"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Button
                    variant="ghost"
                    size="iconSm"
                    aria-label="Type"
                    onClick={() => setComposerOpen(true)}
                    className="opacity-45 hover:opacity-80"
                  >
                    <Keyboard className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  </Button>
                </motion.div>
              ) : (
                <motion.form
                  key="composer"
                  onSubmit={onSubmit}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={springs.soft}
                  className="bilamo-glass flex w-full items-end gap-2 rounded-full p-2 pl-5"
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
                    placeholder="Message"
                    aria-label="Message"
                    disabled={busy}
                    className="max-h-28 min-h-[40px] min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-snug tracking-[-0.01em] text-[var(--bilamo-text)] outline-none placeholder:text-[var(--bilamo-muted)]/45"
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
