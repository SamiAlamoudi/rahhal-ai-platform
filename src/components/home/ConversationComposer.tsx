import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import type { HomeLocale } from '../../lib/aiHome'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { consultantLine } from '../../lib/premiumExperience'
import { HomeButton } from './HomeButton'

export type ComposerSubmitSource = 'text' | 'voice'

export interface ConversationComposerProps {
  locale: HomeLocale
  value: string
  onChange: (value: string) => void
  /**
   * Same handler for typed CTA and voice auto-submit.
   * Voice source must not require a second “ابدأ المحادثة” click.
   */
  onSubmit: (value: string, meta?: { source: ComposerSubmitSource }) => void
  /** Optional override; when omitted, built-in speech recognition is used. */
  onVoiceClick?: () => void
  disabled?: boolean
}

type VoiceUiStatus = 'idle' | 'listening' | 'processing' | 'error'

const VOICE_STATUS_AR: Record<VoiceUiStatus, string> = {
  idle: 'جاهز',
  listening: 'أستمع إليك…',
  processing: 'أفكر…',
  error: 'تعذر تشغيل الصوت',
}

export function ConversationComposer({
  locale,
  value,
  onChange,
  onSubmit,
  onVoiceClick,
  disabled,
}: ConversationComposerProps) {
  const [focused, setFocused] = useState(false)
  const [voiceUi, setVoiceUi] = useState<VoiceUiStatus>('idle')
  const [liveCaption, setLiveCaption] = useState('')
  const valueRef = useRef(value)
  valueRef.current = value
  const submittedRef = useRef(false)
  const lastVoiceKeyRef = useRef('')
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  const submitFrom = (raw: string, source: ComposerSubmitSource) => {
    const trimmed = raw.trim()
    if (!trimmed || disabled || submittedRef.current) return false
    const key = `${source}:${trimmed}`
    if (source === 'voice' && key === lastVoiceKeyRef.current) return false
    submittedRef.current = true
    if (source === 'voice') lastVoiceKeyRef.current = key
    onChange(trimmed)
    onSubmit(trimmed, { source })
    return true
  }

  const speech = useSpeechRecognition({
    lang: locale === 'ar' ? 'ar-SA' : 'en-US',
    silenceMs: 2200,
    onInterim: (interim) => {
      setLiveCaption(interim)
      if (interim.trim()) setVoiceUi('listening')
    },
    onResult: (transcript) => {
      const trimmed = transcript.trim()
      setLiveCaption('')
      if (!trimmed) {
        setVoiceUi('idle')
        return
      }
      // Temporary caption only — do not leave a permanent editable draft requiring CTA.
      setVoiceUi('processing')
      const ok = submitFrom(trimmed, 'voice')
      if (!ok) setVoiceUi('idle')
    },
  })

  useEffect(() => {
    // After voice auto-submit, ensure the home STT session cannot restart and steal
    // the next transcript intended for the /chat continuous loop.
    if (voiceUi === 'processing') {
      speech.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cancel on processing edge only
  }, [voiceUi])

  useEffect(() => {
    if (speech.isListening) {
      setVoiceUi('listening')
      submittedRef.current = false
    } else if (voiceUi === 'listening' && !submittedRef.current) {
      setVoiceUi((prev) => (prev === 'processing' ? prev : 'idle'))
    }
  }, [speech.isListening, voiceUi])

  useEffect(() => {
    if (
      speech.error === 'unsupported'
      || speech.error === 'permission-denied'
      || speech.status === 'error'
    ) {
      setVoiceUi('error')
    }
  }, [speech.error, speech.status])

  const submit = () => {
    submitFrom(value, 'text')
  }

  const onForm = (e: FormEvent) => {
    e.preventDefault()
    if (speech.isListening) return
    submit()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (speech.isListening) return
      submit()
    }
  }

  const onMicClick = () => {
    if (onVoiceClick) {
      onVoiceClick()
      return
    }
    if (!speech.isSupported) {
      setVoiceUi('error')
      speech.start()
      return
    }
    if (speech.isListening) {
      // Explicit stop — end listening; onResult may still fire with final buffer.
      speech.stop()
      return
    }
    submittedRef.current = false
    lastVoiceKeyRef.current = ''
    setLiveCaption('')
    setVoiceUi('listening')
    onChange('')
    speech.clearError()
    speech.start()
  }

  const listening = !onVoiceClick && speech.isListening
  const voiceSessionActive = listening || voiceUi === 'processing'
  const showVoiceError =
    !onVoiceClick &&
    (voiceUi === 'error' ||
      (!!speech.errorMessage &&
        speech.error !== 'user-cancelled' &&
        (speech.status === 'error' ||
          speech.status === 'permission-denied' ||
          speech.status === 'unsupported')))

  const micLabel = listening
    ? t('إيقاف الجلسة الصوتية', 'Stop voice session')
    : t('بدء الجلسة الصوتية', 'Start voice session')

  const statusLabel =
    locale === 'ar'
      ? VOICE_STATUS_AR[voiceUi === 'error' || showVoiceError ? 'error' : voiceUi]
      : voiceUi === 'listening'
        ? 'Listening…'
        : voiceUi === 'processing'
          ? 'Thinking…'
          : voiceUi === 'error' || showVoiceError
            ? 'Voice unavailable'
            : 'Ready'

  return (
    <motion.form
      onSubmit={onForm}
      data-testid="ai-home-composer"
      data-voice-ui={voiceUi}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: 'easeOut' }}
      className={`rounded-[1.75rem] border bg-white/95 p-3 shadow-2xl shadow-slate-950/15 backdrop-blur-xl transition-all duration-200 sm:p-4 ${
        focused || listening
          ? 'border-primary-400 ring-4 ring-primary-500/15'
          : 'border-white/80'
      }`}
    >
      <label className="sr-only" htmlFor="ai-home-input">
        {t('اكتب طلب سفرك', 'Describe your trip')}
      </label>
      {!voiceSessionActive ? (
        <textarea
          id="ai-home-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={disabled}
          placeholder={t(
            'مثال: أريد السفر إلى طوكيو لمدة أسبوع…',
            'e.g. I want a week in Tokyo…',
          )}
          className="w-full resize-none bg-transparent px-2 py-2 text-base leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none sm:text-[1.05rem]"
        />
      ) : (
        <div
          className="min-h-[4.5rem] px-2 py-2 text-base leading-relaxed text-slate-700"
          aria-live="polite"
          data-testid="ai-home-voice-caption"
        >
          <p
            className="text-sm font-medium text-rose-600"
            role="status"
            data-testid="ai-home-voice-status"
            data-state={voiceUi}
          >
            {statusLabel}
          </p>
          <p className="mt-1 text-slate-500">
            {liveCaption || speech.interimTranscript || (voiceUi === 'processing'
              ? t('جاري بدء المحادثة…', 'Starting conversation…')
              : t('…تحدث الآن', '…speak now'))}
          </p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMicClick}
            disabled={disabled || voiceUi === 'processing'}
            data-testid="ai-home-voice"
            data-listening={listening ? 'true' : 'false'}
            aria-label={micLabel}
            aria-pressed={listening}
            title={micLabel}
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-40 ${
              listening
                ? 'voice-mic-pulse scale-105 bg-rose-500 text-white shadow-lg shadow-rose-500/35'
                : 'bg-slate-900 text-white shadow-lg shadow-slate-900/25 hover:scale-[1.03] hover:bg-slate-800'
            }`}
          >
            {listening ? (
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
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
            )}
          </button>
          {!voiceSessionActive ? (
            <span className="hidden text-xs text-slate-400 sm:inline">
              {t('تحدث أو اكتب — رحّال يستمع', 'Speak or type — Rahhal is ready')}
            </span>
          ) : null}
        </div>
        {!voiceSessionActive ? (
          <HomeButton
            type="submit"
            size="md"
            disabled={disabled || !value.trim()}
            data-testid="ai-home-send"
            className="min-h-11 rounded-2xl px-5"
          >
            {consultantLine(locale, 'startChat')}
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 rtl:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </HomeButton>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (listening) speech.stop()
              else {
                speech.cancel()
                setVoiceUi('idle')
                setLiveCaption('')
                submittedRef.current = false
              }
            }}
            data-testid="ai-home-voice-stop"
            className="min-h-11 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 hover:bg-rose-100"
          >
            {t('إيقاف', 'Stop')}
          </button>
        )}
      </div>
      {showVoiceError ? (
        <p
          className="mt-2 px-1 text-[11px] text-rose-600"
          role="alert"
          data-testid="ai-home-voice-error"
        >
          {speech.error === 'unsupported'
            ? t(
                'الإدخال الصوتي غير مدعوم في هذا المتصفح — استخدم الكتابة.',
                'Voice input is not supported in this browser — use typing.',
              )
            : speech.error === 'permission-denied'
              ? t(
                  'تم رفض إذن الميكروفون. اسمح بالوصول وحاول مرة أخرى.',
                  speech.errorMessage ?? 'Microphone permission denied.',
                )
              : speech.error === 'no-speech'
                ? t(
                    'لم يتم رصد كلام. اضغط الميكروفون وحاول مرة أخرى.',
                    speech.errorMessage ?? 'No speech detected.',
                  )
                : t(
                    'تعذر تشغيل الصوت. يمكنك الكتابة بدلًا من ذلك.',
                    speech.errorMessage ?? 'Voice failed — you can type instead.',
                  )}
        </p>
      ) : null}
    </motion.form>
  )
}
