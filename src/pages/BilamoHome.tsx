import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Keyboard, Mic, Moon, Sun } from 'lucide-react'
import {
  BilamoShell,
  BottomNavigation,
  Button,
  Logo,
  Modal,
  Textarea,
  VoiceOrb,
  springs,
  useTheme,
  type OrbState,
} from '../design-system'
import { greetingForHour, resolveDisplayName } from '../design-system/greeting'
import { useAuth } from '../lib/auth'

interface RecentConversation {
  id: string
  title: string
  preview: string
}

const DEMO_RECENT: RecentConversation[] = [
  {
    id: 'recent-1',
    title: 'Weekend in Lisbon',
    preview: 'Flights + boutique stay near Chiado',
  },
]

/**
 * Bilamo Home — conversation-first.
 * Logo · Greeting · Orb · Voice / Keyboard · Recent.
 * Nothing else.
 */
export default function BilamoHome() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [level, setLevel] = useState(0)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const displayName = useMemo(() => resolveDisplayName(user), [user])
  const greeting = useMemo(
    () => greetingForHour(new Date().getHours(), displayName),
    [displayName],
  )

  useEffect(() => {
    if (orbState !== 'listening') {
      setLevel(0)
      return
    }
    const id = window.setInterval(() => {
      setLevel(0.25 + Math.random() * 0.65)
    }, 120)
    return () => window.clearInterval(id)
  }, [orbState])

  const startVoice = () => {
    setOrbState('listening')
    window.setTimeout(() => setOrbState('thinking'), 1600)
    window.setTimeout(() => setOrbState('speaking'), 3200)
    window.setTimeout(() => {
      setOrbState('completed')
      navigate('/chat', { state: { voiceStart: true } })
    }, 4800)
  }

  const openKeyboard = () => {
    setKeyboardOpen(true)
    setOrbState('idle')
  }

  const submitText = () => {
    const text = draft.trim()
    if (!text) return
    setKeyboardOpen(false)
    setOrbState('thinking')
    navigate('/chat', { state: { initialPrompt: text, tripText: text } })
  }

  return (
    <BilamoShell className="pb-28">
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-6 pt-8">
        <header className="flex items-start justify-between">
          <div className="space-y-6">
            <Logo size="lg" />
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springs.gentle}
              className="text-2xl font-medium tracking-tight text-[var(--bilamo-text)] sm:text-3xl"
            >
              {greeting}
            </motion.p>
          </div>
          <Button
            variant="ghost"
            size="iconSm"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-8">
          <VoiceOrb state={orbState} level={level} size={240} />
          <AnimatePresence mode="wait">
            <motion.p
              key={orbState}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={springs.soft}
              className="mt-6 text-sm font-medium tracking-wide text-[var(--bilamo-muted)]"
            >
              {orbState === 'idle' && 'Tap the mic. Speak naturally.'}
              {orbState === 'listening' && 'Listening…'}
              {orbState === 'thinking' && 'Thinking…'}
              {orbState === 'speaking' && 'Speaking…'}
              {orbState === 'completed' && 'Opening conversation…'}
            </motion.p>
          </AnimatePresence>
        </main>

        <section className="mb-6 space-y-5">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="voice"
              size="icon"
              onClick={startVoice}
              aria-label="Start voice"
              data-testid="bilamo-voice-button"
            >
              <Mic className="h-6 w-6" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={openKeyboard}
              aria-label="Open keyboard"
              data-testid="bilamo-keyboard-button"
            >
              <Keyboard className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-3">
            <p className="text-center text-xs font-medium uppercase tracking-[0.14em] text-[var(--bilamo-muted)]">
              Recent conversation
            </p>
            {DEMO_RECENT.map((item) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => navigate('/chat')}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                transition={springs.snappy}
                className="bilamo-glass-subtle w-full rounded-2xl px-4 py-3 text-start"
              >
                <p className="text-sm font-medium text-[var(--bilamo-text)]">{item.title}</p>
                <p className="mt-0.5 text-xs text-[var(--bilamo-muted)]">{item.preview}</p>
              </motion.button>
            ))}
          </div>
        </section>
      </div>

      <BottomNavigation />

      <Modal
        open={keyboardOpen}
        onClose={() => setKeyboardOpen(false)}
        title="Talk to Bilamo"
        ariaLabel="Keyboard conversation"
      >
        <div className="space-y-4">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tell Bilamo where you want to go…"
            aria-label="Message"
          />
          <Button className="w-full" size="lg" onClick={submitText} disabled={!draft.trim()}>
            Continue
          </Button>
        </div>
      </Modal>
    </BilamoShell>
  )
}
