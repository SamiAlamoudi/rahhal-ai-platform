import { TravelCard } from '../components/TravelCard'
import type { TravelCardModel, TravelWorkspaceLocale } from '../types'

export function TransportCards({
  cards,
  locale = 'ar',
}: {
  cards: TravelCardModel[]
  locale?: TravelWorkspaceLocale
}) {
  const items = cards.filter((c) => c.kind === 'transport')
  return (
    <section data-testid="tw-transport-cards" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Transportation' : 'التنقل'}</h2>
      <div className="rahhal-tw-card-grid">
        {items.map((card) => (
          <TravelCard key={card.id} card={card} locale={locale} />
        ))}
      </div>
    </section>
  )
}
