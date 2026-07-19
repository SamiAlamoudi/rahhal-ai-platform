import type { HomeLocale, TravelSmartCardModel } from '../../lib/aiHome'
import { cardSubtitle, cardTitle } from '../../lib/aiHome'
import { HomeCard } from './HomeCard'
import { HomeEmptyState } from './HomeStates'
import { SectionHeader } from './SectionHeader'
import { StatusChip } from './StatusChip'

export interface TravelCardsSectionProps {
  locale: HomeLocale
  cards: TravelSmartCardModel[]
  onOpen: (card: TravelSmartCardModel) => void
}

export function TravelCardsSection({ locale, cards, onOpen }: TravelCardsSectionProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)

  return (
    <section data-testid="ai-home-travel-cards">
      <SectionHeader
        title={t('بطاقات السفر الذكية', 'Smart travel cards')}
        subtitle={t('رحلاتك وتوصيات مستشار رحّال', 'Your trips and Rahhal recommendations')}
      />
      {cards.length === 0 ? (
        <HomeEmptyState
          title={t('لا بطاقات بعد', 'No cards yet')}
          body={t('ابدأ محادثة لاكتشاف وجهات جديدة', 'Start a conversation to discover destinations')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {cards.map((card) => (
            <HomeCard
              key={card.id}
              interactive
              data-testid={`ai-home-card-${card.kind}`}
              onClick={() => onOpen(card)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{cardTitle(card, locale)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{cardSubtitle(card, locale)}</p>
                  {(locale === 'ar' ? card.metaAr : card.metaEn) ? (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {locale === 'ar' ? card.metaAr : card.metaEn}
                    </p>
                  ) : null}
                </div>
                {card.statusChip ? (
                  <StatusChip
                    label={locale === 'ar' ? card.statusChip.labelAr : card.statusChip.labelEn}
                    tone={card.statusChip.tone}
                  />
                ) : null}
              </div>
            </HomeCard>
          ))}
        </div>
      )}
    </section>
  )
}
