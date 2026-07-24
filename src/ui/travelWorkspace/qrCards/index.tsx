import { TravelCard } from '../components/TravelCard'
import type { TravelCardModel, TravelWorkspaceLocale } from '../types'

export function QrCards({
  cards,
  locale = 'ar',
}: {
  cards: TravelCardModel[]
  locale?: TravelWorkspaceLocale
}) {
  const items = cards.filter((c) => c.kind === 'qr')
  return (
    <section data-testid="tw-qr-cards" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'QR codes' : 'رموز QR'}</h2>
      <div className="rahhal-tw-card-grid">
        {items.map((card) => (
          <TravelCard key={card.id} card={card} locale={locale} />
        ))}
      </div>
    </section>
  )
}
