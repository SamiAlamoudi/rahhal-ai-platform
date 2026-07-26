import { memo, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { VoiceSessionStatus } from '../../lib/chat/voice/voiceTypes'
import {
  createVoiceAdapter,
  mapSessionStatusToPanelState,
  voicePanelStateLabel,
  type VoiceUiPanelState,
} from '../../lib/premiumExperience'
import VoiceWaveform from '../chat/VoiceWaveform'

export interface VoicePanelProps {
  status: VoiceSessionStatus
  level?: number
  partialTranscript?: string
  locale?: 'ar' | 'en'
  muted?: boolean
  online?: boolean
  visible?: boolean
  onInterrupt?: () => void
  onStopSpeaking?: () => void
  onRestartListening?: () => void
  onToggleMute?: () => void
}

/**
 * Floating bottom voice panel — ChatGPT Voice / Gemini Live style chrome.
 * Presentation only; session I/O remains on ChatPage + voiceSession.
 */
function VoicePanelComponent({
  status,
  level = 0,
  partialTranscript = '',
  locale = 'ar',
  muted = false,
  online = true,
  visible = true,
  onInterrupt,
  onStopSpeaking,
  onRestartListening,
  onToggleMute,
}: VoicePanelProps) {
  const adapter = useStableAdapter()
  const panelState = mapSessionStatusToPanelState(status, {
    muted,
    disconnected: !online || status === 'error',
  })
  const listening = panelState === 'listening'
  const thinking = panelState === 'thinking'
  const speaking = panelState === 'speaking'
  const idle = panelState === 'idle'

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.aside
        data-testid="voice-panel"
        data-state={panelState}
        data-provider={adapter.id}
        role="region"
        aria-label={locale === 'ar' ? 'لوحة الصوت' : 'Voice panel'}
        aria-live="polite"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="pointer-events-auto fixed inset-x-0 bottom-[12.5rem] z-40 mx-auto w-full max-w-xl px-3 sm:bottom-[13.5rem] sm:px-4"
      >
        <div
          className={`relative overflow-hidden rounded-[1.75rem] border border-white/40 bg-slate-950/92 px-4 py-4 text-white shadow-2xl shadow-slate-950/40 backdrop-blur-xl ${
            listening ? 'voice-panel-listening' : idle ? 'voice-panel-idle' : ''
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-0 opacity-60 ${
              listening
                ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(56,189,248,0.35),transparent_55%)]'
                : speaking
                  ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(28,128,240,0.35),transparent_55%)]'
                  : thinking
                    ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(148,163,184,0.25),transparent_55%)]'
                    : 'bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.08),transparent_55%)]'
            }`}
            aria-hidden
          />

          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-slate-300">
                {locale === 'ar' ? 'محادثة صوتية' : 'Voice conversation'}
              </p>
              <p
                className="truncate text-sm font-semibold text-white"
                data-testid="voice-panel-status"
                data-state={panelState}
              >
                {voicePanelStateLabel(panelState, locale)}
              </p>
            </div>
            <StateBadge state={panelState} locale={locale} />
          </div>

          <div className="relative z-10 mt-4 flex flex-col items-center gap-3">
            <motion.div
              layout
              animate={
                listening
                  ? { scale: [1, 1.08, 1] }
                  : speaking
                    ? { scale: [1, 1.04, 1] }
                    : idle
                      ? { scale: [1, 1.02, 1] }
                      : { scale: 1 }
              }
              transition={{
                duration: listening ? 1.2 : speaking ? 0.9 : 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className={`flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full ${
                listening
                  ? 'bg-sky-400 text-slate-950 shadow-[0_0_32px_rgba(56,189,248,0.55)]'
                  : speaking
                    ? 'bg-primary-500 text-white shadow-[0_0_28px_rgba(28,128,240,0.5)]'
                    : thinking
                      ? 'bg-slate-700 text-white'
                      : 'bg-white/10 text-white ring-1 ring-white/20'
              }`}
              aria-hidden
            >
              {thinking ? <ThinkingDots /> : <MicGlyph />}
            </motion.div>

            <VoiceWaveform
              active={listening || speaking}
              level={level}
              bars={28}
              className="w-full !bg-white/5"
              label={
                listening
                  ? locale === 'ar'
                    ? 'موجة الاستماع'
                    : 'Listening waveform'
                  : speaking
                    ? locale === 'ar'
                      ? 'موجة التحدث'
                      : 'Speaking waveform'
                    : locale === 'ar'
                      ? 'موجة خاملة'
                      : 'Idle waveform'
              }
            />

            <p className="min-h-5 max-w-full truncate text-center text-xs text-slate-300">
              {partialTranscript.trim()
                ? partialTranscript
                : listening
                  ? locale === 'ar'
                    ? 'تحدث بشكل طبيعي — يمكنك المقاطعة في أي وقت'
                    : 'Speak naturally — interrupt anytime'
                  : speaking
                    ? locale === 'ar'
                      ? 'اضغط مقاطعة أو Esc للإيقاف'
                      : 'Tap interrupt or Esc to stop'
                    : locale === 'ar'
                      ? 'Space: اضغط للتحدث · Esc: إيقاف'
                      : 'Space: push to talk · Esc: stop'}
            </p>
          </div>

          <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-2">
            {(speaking || thinking) && (
              <button
                type="button"
                onClick={onStopSpeaking ?? onInterrupt}
                className="min-h-11 rounded-2xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={locale === 'ar' ? 'إيقاف التحدث' : 'Stop speaking'}
              >
                {locale === 'ar' ? 'إيقاف' : 'Stop'}
              </button>
            )}
            {(speaking || thinking || listening) && (
              <button
                type="button"
                onClick={onInterrupt}
                className="min-h-11 rounded-2xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={locale === 'ar' ? 'مقاطعة' : 'Interrupt'}
              >
                {locale === 'ar' ? 'مقاطعة' : 'Interrupt'}
              </button>
            )}
            {!listening && !speaking && (
              <button
                type="button"
                onClick={onRestartListening}
                className="min-h-11 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label={locale === 'ar' ? 'إعادة الاستماع' : 'Restart listening'}
              >
                {locale === 'ar' ? 'استمع' : 'Listen'}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleMute}
              aria-pressed={muted}
              className="min-h-11 rounded-2xl border border-white/20 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={muted ? (locale === 'ar' ? 'إلغاء الكتم' : 'Unmute') : locale === 'ar' ? 'كتم' : 'Mute'}
            >
              {muted ? (locale === 'ar' ? 'إلغاء الكتم' : 'Unmute') : locale === 'ar' ? 'كتم' : 'Mute'}
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  )
}

function StateBadge({
  state,
  locale,
}: {
  state: VoiceUiPanelState
  locale: 'ar' | 'en'
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-100">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          state === 'listening'
            ? 'animate-pulse bg-sky-300'
            : state === 'speaking'
              ? 'animate-pulse bg-primary-300'
              : state === 'thinking'
                ? 'animate-pulse bg-slate-300'
                : 'bg-emerald-300'
        }`}
        aria-hidden
      />
      {voicePanelStateLabel(state, locale)}
    </span>
  )
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-white"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  )
}

function MicGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function useStableAdapter() {
  const [adapter] = useState(() => createVoiceAdapter())
  useEffect(() => {
    void adapter.connect()
    return () => {
      void adapter.disconnect()
    }
  }, [adapter])
  return adapter
}

export const VoicePanel = memo(VoicePanelComponent)
export default VoicePanel
