import type {
  JourneyEventCard,
  JourneyLayout,
  JourneyTimelineLocale,
} from '../types'
import { JOURNEY_STEPS } from '../types'
import { EventCard } from './EventCard'

export function TimelineBoard({
  events,
  layout,
  locale = 'ar',
}: {
  events: JourneyEventCard[]
  layout: JourneyLayout
  locale?: JourneyTimelineLocale
}) {
  return (
    <section
      className={`rahhal-jt-board rahhal-jt-board--${layout}`}
      data-testid="jt-timeline-board"
      data-layout={layout}
    >
      {layout === 'vertical' || layout === 'compact' || layout === 'daily' ? (
        <ol className="rahhal-jt-vertical">
          {JOURNEY_STEPS.map((step) => {
            const stepEvents = events.filter((e) => e.step === step)
            if (stepEvents.length === 0) return null
            return (
              <li key={step} data-step={step} className="rahhal-jt-vertical__step">
                <div className="rahhal-jt-vertical__rail" aria-hidden="true">
                  <span className="rahhal-jt-dot" />
                </div>
                <div className="rahhal-jt-vertical__content">
                  <h3 className="rahhal-jt-step-label">{step}</h3>
                  <div className="rahhal-jt-card-row">
                    {stepEvents.map((event) => (
                      <EventCard key={event.id} event={event} locale={locale} />
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}

      {layout === 'horizontal' || layout === 'weekly' ? (
        <div className="rahhal-jt-horizontal" data-testid="jt-horizontal">
          {JOURNEY_STEPS.map((step) => {
            const stepEvents = events.filter((e) => e.step === step)
            return (
              <div key={step} className="rahhal-jt-horizontal__col" data-step={step}>
                <h3>{step}</h3>
                {stepEvents.map((event) => (
                  <EventCard key={event.id} event={event} locale={locale} />
                ))}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
