import { TravelCard } from '../components/TravelCard'
import type { TravelCardModel, TravelWorkspaceLocale } from '../types'

export function TicketCards({
  cards,
  locale = 'ar',
}: {
  cards: TravelCardModel[]
  locale?: TravelWorkspaceLocale
}) {
  const items = cards.filter(
    (c) => c.kind === 'ticket' || c.kind === 'boarding_pass',
  )
  return (
    <section data-testid="tw-ticket-cards" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Tickets' : 'التذاكر'}</h2>
      <div className="rahhal-tw-card-grid">
        {items.map((card) => (
          <TravelCard key={card.id} card={card} locale={locale} />
        ))}
      </div>
    </section>
  )
}
