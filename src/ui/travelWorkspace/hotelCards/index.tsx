import { TravelCard } from '../components/TravelCard'
import type { TravelCardModel, TravelWorkspaceLocale } from '../types'

export function HotelCards({
  cards,
  locale = 'ar',
}: {
  cards: TravelCardModel[]
  locale?: TravelWorkspaceLocale
}) {
  const hotels = cards.filter((c) => c.kind === 'hotel')
  return (
    <section data-testid="tw-hotel-cards" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Hotels' : 'الفنادق'}</h2>
      <div className="rahhal-tw-card-grid">
        {hotels.map((card) => (
          <TravelCard key={card.id} card={card} locale={locale} />
        ))}
      </div>
    </section>
  )
}
