import { motion } from 'framer-motion'
import { consultantLine } from '../../lib/premiumExperience'

export interface ChatWelcomeProps {
  locale?: 'ar' | 'en'
  onPrompt: (text: string) => void
  disabled?: boolean
}

const PROMPTS = {
  ar: [
    'حدّثني عن رحلة أحلامك إلى اليابان',
    'عطلة عائلية في إسطنبول بميزانية ١٠٬٠٠٠ ر.س',
    'رحلة عمل قصيرة إلى دبي نهاية الأسبوع',
  ],
  en: [
    'Tell me about a dream trip to Japan',
    'Family holiday in Istanbul under 10,000 SAR',
    'Short business trip to Dubai this weekend',
  ],
} as const

export function ChatWelcome({ locale = 'ar', onPrompt, disabled }: ChatWelcomeProps) {
  const prompts = PROMPTS[locale]
  return (
    <motion.div
      data-testid="chat-welcome"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto flex max-w-lg flex-col items-center px-2 py-10 text-center"
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-lg shadow-primary-900/25"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
          <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
        </svg>
      </div>
      <p className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {consultantLine(locale, 'brand')}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {consultantLine(locale, 'role')}
      </p>
      <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-slate-800 dark:text-slate-100">
        {consultantLine(locale, 'whereToday')}
      </p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {consultantLine(locale, 'emptyChat')}
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onPrompt(prompt)}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-start text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-primary-600 dark:hover:bg-slate-800"
          >
            {prompt}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
