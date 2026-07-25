import type { JourneyEventCard, JourneyTimelineLocale } from '../types'

export function EventCard({
  event,
  locale = 'ar',
}: {
  event: JourneyEventCard
  locale?: JourneyTimelineLocale
}) {
  return (
    <article
      className={`rahhal-jt-card rahhal-jt-card--${event.status} rahhal-jt-card--${event.kind}`}
      data-testid="jt-event-card"
      data-event-id={event.id}
      data-step={event.step}
      data-kind={event.kind}
      data-status={event.status}
      data-placeholder={event.placeholder ? 'true' : 'false'}
      data-locale={locale}
    >
      <span className="rahhal-jt-card__kind">{event.kind}</span>
      <h3>{event.title}</h3>
      <p>{event.subtitle}</p>
      <footer>
        <time>{event.timeLabel}</time>
        <span data-testid="jt-event-status">{event.status}</span>
      </footer>
    </article>
  )
}
