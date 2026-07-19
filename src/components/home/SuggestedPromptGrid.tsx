import type { HomeLocale, SuggestedPrompt } from '../../lib/aiHome'
import { promptLabel } from '../../lib/aiHome'
import { HomeCard } from './HomeCard'
import { SectionHeader } from './SectionHeader'

export interface SuggestedPromptGridProps {
  locale: HomeLocale
  prompts: SuggestedPrompt[]
  onSelect: (prompt: SuggestedPrompt) => void
}

export function SuggestedPromptGrid({ locale, prompts, onSelect }: SuggestedPromptGridProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <section data-testid="ai-home-suggestions">
      <SectionHeader
        title={t('اقتراحات المحادثة', 'Suggested conversations')}
        subtitle={t('اضغط لبدء الحوار فوراً', 'Tap to open the AI conversation')}
      />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {prompts.map((prompt) => (
          <HomeCard
            key={prompt.id}
            interactive
            data-testid={`ai-home-prompt-${prompt.id}`}
            onClick={() => onSelect(prompt)}
            className="!p-3.5"
          >
            <span className="text-lg" aria-hidden>
              {prompt.icon}
            </span>
            <p className="mt-2 text-xs font-bold leading-snug text-slate-900 sm:text-sm">
              {promptLabel(prompt, locale)}
            </p>
          </HomeCard>
        ))}
      </div>
    </section>
  )
}
