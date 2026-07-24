import { TravelCard } from '../components/TravelCard'
import type { TravelCardModel, TravelWorkspaceLocale } from '../types'

export function MeetingCards({
  cards,
  locale = 'ar',
}: {
  cards: TravelCardModel[]
  locale?: TravelWorkspaceLocale
}) {
  const items = cards.filter((c) => c.kind === 'meeting')
  return (
    <section data-testid="tw-meeting-cards" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Meetings' : 'الاجتماعات'}</h2>
      <div className="rahhal-tw-card-grid">
        {items.map((card) => (
          <TravelCard key={card.id} card={card} locale={locale} />
        ))}
      </div>
    </section>
  )
}
