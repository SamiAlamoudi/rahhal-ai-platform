import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import type { HomeLocale } from '../../lib/aiHome'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { consultantLine } from '../../lib/premiumExperience'
import { HomeButton } from './HomeButton'

export interface ConversationComposerProps {
  locale: HomeLocale
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  /** Optional override; when omitted, built-in speech recognition is used. */
  onVoiceClick?: () => void
  disabled?: boolean
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
  const valueRef = useRef(value)
  valueRef.current = value
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  const speech = useSpeechRecognition({
    lang: locale === 'ar' ? 'ar-SA' : 'en-US',
    silenceMs: 3000,
    onResult: (transcript) => {
      const current = valueRef.current.trim()
      onChange(current ? `${current} ${transcript}` : transcript)
    },
  })

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
  }

  const onForm = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const onMicClick = () => {
    if (onVoiceClick) {
      onVoiceClick()
      return
    }
    if (!speech.isSupported) {
      speech.start()
      return
    }
    speech.clearError()
    speech.toggle()
  }

  const listening = !onVoiceClick && speech.isListening
  const showVoiceError =
    !onVoiceClick &&
    !!speech.errorMessage &&
    speech.error !== 'user-cancelled' &&
    (speech.status === 'error' ||
      speech.status === 'permission-denied' ||
      speech.status === 'unsupported')

  const micLabel = listening
    ? t('إيقاف الاستماع', 'Stop listening')
    : t('إدخال صوتي', 'Voice input')

  return (
    <motion.form
      onSubmit={onForm}
      data-testid="ai-home-composer"
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
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMicClick}
            disabled={disabled}
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
          {listening ? (
            <span
              className="flex items-center gap-1.5 text-sm font-medium text-rose-600"
              role="status"
              aria-live="polite"
              data-testid="ai-home-voice-listening"
            >
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500"
                aria-hidden="true"
              />
              {consultantLine(locale, 'listening')}
              {speech.interimTranscript ? (
                <span className="max-w-[10rem] truncate text-slate-500 sm:max-w-[16rem]">
                  {speech.interimTranscript}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="hidden text-xs text-slate-400 sm:inline">
              {t('تحدث أو اكتب — رحّال يستمع', 'Speak or type — Rahhal is ready')}
            </span>
          )}
        </div>
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
      </div>
      {showVoiceError ? (
        <p
          className="mt-2 px-1 text-[11px] text-rose-600"
          role="alert"
          data-testid="ai-home-voice-error"
        >
          {speech.error === 'unsupported'
            ? t(
                'الإدخال الصوتي غير مدعوم في هذا المتصفح.',
                'Voice input is not supported in this browser.',
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
                : speech.error === 'timeout'
                  ? t(
                      'انتهت مهلة الاستماع. اضغط الميكروفون للمحاولة مرة أخرى.',
                      speech.errorMessage ?? 'Listening timed out.',
                    )
                  : t(
                      'تعذر التعرف على الكلام. حاول مرة أخرى.',
                      speech.errorMessage ?? 'Speech recognition failed.',
                    )}
        </p>
      ) : null}
    </motion.form>
  )
}
