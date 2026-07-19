import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { HomeLocale } from '../../lib/aiHome'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
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
    onResult: (transcript) => {
      // Insert into composer — never auto-send.
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
      speech.start() // sets unsupported error state
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
    <form
      onSubmit={onForm}
      data-testid="ai-home-composer"
      className={`rounded-3xl border bg-white p-3 shadow-xl shadow-slate-900/8 transition-all duration-200 sm:p-4 ${
        focused || listening
          ? 'border-primary-400 ring-2 ring-primary-500/15'
          : 'border-slate-100'
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
        rows={3}
        disabled={disabled}
        placeholder={t(
          'مثال: أريد السفر إلى طوكيو… أو ميزانيتي ٥٠٠٠ ر.س',
          'e.g. I want to travel to Tokyo… or I have 5000 SAR',
        )}
        className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none sm:text-base"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onMicClick}
            disabled={disabled}
            data-testid="ai-home-voice"
            data-listening={listening ? 'true' : 'false'}
            aria-label={micLabel}
            aria-pressed={listening}
            title={micLabel}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-40 ${
              listening
                ? 'voice-mic-pulse border-rose-300 bg-rose-50 text-rose-600'
                : 'border-slate-200 text-slate-500 hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700'
            }`}
          >
            {listening ? (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 animate-pulse"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
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
              className="flex items-center gap-1.5 text-xs font-medium text-rose-600"
              role="status"
              aria-live="polite"
              data-testid="ai-home-voice-listening"
            >
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500"
                aria-hidden="true"
              />
              {t('جاري الاستماع…', 'Listening...')}
              {speech.interimTranscript ? (
                <span className="truncate text-slate-500 max-w-[10rem] sm:max-w-[16rem]">
                  {speech.interimTranscript}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        <HomeButton
          type="submit"
          size="md"
          disabled={disabled || !value.trim()}
          data-testid="ai-home-send"
        >
          {t('ابدأ المحادثة', 'Start conversation')}
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
    </form>
  )
}
