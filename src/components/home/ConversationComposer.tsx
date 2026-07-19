import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { HomeLocale } from '../../lib/aiHome'
import { HomeButton } from './HomeButton'

export interface ConversationComposerProps {
  locale: HomeLocale
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
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
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

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

  return (
    <form
      onSubmit={onForm}
      data-testid="ai-home-composer"
      className={`rounded-3xl border bg-white p-3 shadow-xl shadow-slate-900/8 transition-all duration-200 sm:p-4 ${
        focused ? 'border-primary-400 ring-2 ring-primary-500/15' : 'border-slate-100'
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
        <button
          type="button"
          onClick={onVoiceClick}
          disabled={disabled}
          data-testid="ai-home-voice"
          aria-label={t('إدخال صوتي (قريباً)', 'Voice input (coming soon)')}
          title={t('الإدخال الصوتي — الواجهة جاهزة', 'Voice entry — UI ready')}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <HomeButton
          type="submit"
          size="md"
          disabled={disabled || !value.trim()}
          data-testid="ai-home-send"
        >
          {t('ابدأ المحادثة', 'Start conversation')}
          <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </HomeButton>
      </div>
    </form>
  )
}
