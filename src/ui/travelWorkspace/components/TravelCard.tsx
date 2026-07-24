import type { TravelCardModel, TravelWorkspaceLocale } from '../types'

export interface TravelCardProps {
  card: TravelCardModel
  locale?: TravelWorkspaceLocale
}

export function TravelCard({ card, locale = 'ar' }: TravelCardProps) {
  return (
    <article
      className={`rahhal-tw-card rahhal-tw-card--${card.kind}`}
      data-testid={`tw-card-${card.kind}`}
      data-card-kind={card.kind}
      data-card-id={card.id}
      data-locale={locale}
      aria-label={card.title}
    >
      <span className="rahhal-tw-card__kind">{card.kind}</span>
      <h3>{card.title}</h3>
      <p>{card.subtitle}</p>
      <footer>
        <span>{card.meta}</span>
        <span data-testid="tw-card-status">{card.statusLabel}</span>
      </footer>
    </article>
  )
}
