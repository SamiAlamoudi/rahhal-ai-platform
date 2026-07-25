import { motion } from 'framer-motion'
import type { HomeLocale, SuggestedPrompt } from '../../lib/aiHome'
import { promptLabel } from '../../lib/aiHome'

export interface SuggestedPromptGridProps {
  locale: HomeLocale
  prompts: SuggestedPrompt[]
  onSelect: (prompt: SuggestedPrompt) => void
}

/** Interactive suggestion chips — not decorative hero cards. */
export function SuggestedPromptGrid({ locale, prompts, onSelect }: SuggestedPromptGridProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <section data-testid="ai-home-suggestions" aria-label={t('اقتراحات', 'Suggestions')}>
      <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {t('ابدأ من هنا', 'Start here')}
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, index) => (
          <motion.button
            key={prompt.id}
            type="button"
            data-testid={`ai-home-prompt-${prompt.id}`}
            onClick={() => onSelect(prompt)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 * index, ease: 'easeOut' }}
            whileTap={{ scale: 0.98 }}
            className="min-h-11 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-start text-sm font-semibold text-slate-800 shadow-sm shadow-slate-900/5 transition hover:border-primary-300 hover:bg-primary-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {promptLabel(prompt, locale)}
          </motion.button>
        ))}
      </div>
    </section>
  )
}
