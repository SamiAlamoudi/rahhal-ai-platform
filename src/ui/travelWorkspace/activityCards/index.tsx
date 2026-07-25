import { TravelCard } from '../components/TravelCard'
import type { TravelCardModel, TravelWorkspaceLocale } from '../types'

export function ActivityCards({
  cards,
  locale = 'ar',
}: {
  cards: TravelCardModel[]
  locale?: TravelWorkspaceLocale
}) {
  const items = cards.filter((c) => c.kind === 'activity' || c.kind === 'restaurant')
  return (
    <section data-testid="tw-activity-cards" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Activities' : 'الأنشطة'}</h2>
      <div className="rahhal-tw-card-grid">
        {items.map((card) => (
          <TravelCard key={card.id} card={card} locale={locale} />
        ))}
      </div>
    </section>
  )
}
