import { TravelCard } from '../components/TravelCard'
import type { TravelCardModel, TravelWorkspaceLocale } from '../types'

export function FlightCards({
  cards,
  locale = 'ar',
}: {
  cards: TravelCardModel[]
  locale?: TravelWorkspaceLocale
}) {
  const flights = cards.filter((c) => c.kind === 'flight')
  return (
    <section data-testid="tw-flight-cards" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Flights' : 'الرحلات'}</h2>
      <div className="rahhal-tw-card-grid">
        {flights.map((card) => (
          <TravelCard key={card.id} card={card} locale={locale} />
        ))}
      </div>
    </section>
  )
}
