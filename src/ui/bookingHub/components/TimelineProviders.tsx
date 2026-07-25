import type {
  BookingHubLocale,
  BookingPlaceItem,
  BookingProviderCard,
  BookingTimelineItem,
} from '../types'

export interface TimelineProvidersProps {
  bookingTimeline: BookingTimelineItem[]
  providers: BookingProviderCard[]
  calendarDays: string[]
  mapPlaceholder: string
  favorites: BookingPlaceItem[]
  bookmarks: BookingPlaceItem[]
  locale: BookingHubLocale
}

export function TimelineProviders({
  bookingTimeline,
  providers,
  calendarDays,
  mapPlaceholder,
  favorites,
  bookmarks,
  locale,
}: TimelineProvidersProps) {
  return (
    <>
      <div className="rahhal-bh-layout">
        <section className="rahhal-bh-panel" data-testid="bh-booking-timeline">
          <h2>
            {locale === 'en' ? 'Booking timeline' : 'الجدول الزمني للحجز'}
          </h2>
          <ul className="rahhal-bh-timeline">
            {bookingTimeline.map((item) => (
              <li key={item.id}>
                <em
                  style={{
                    color: 'var(--rahhal-bh-accent)',
                    fontStyle: 'normal',
                  }}
                >
                  {item.whenLabel}
                </em>
                <strong>{item.title}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="rahhal-bh-panel" data-testid="bh-providers">
          <h2>{locale === 'en' ? 'Provider cards' : 'بطاقات المزودين'}</h2>
          <div className="rahhal-bh-grid" style={{ margin: '0.45rem 0 0' }}>
            {providers.map((p) => (
              <article
                key={p.id}
                className="rahhal-bh-card"
                data-testid="bh-provider-card"
              >
                <strong>{p.name}</strong>
                <span>{p.category}</span>
                <em>{p.statusLabel}</em>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="rahhal-bh-layout">
        <section className="rahhal-bh-panel" data-testid="bh-calendar">
          <h2>{locale === 'en' ? 'Calendar' : 'التقويم'}</h2>
          <div className="rahhal-bh-calendar">
            {calendarDays.map((day, index) => (
              <span
                key={day}
                className={index < 3 ? 'is-active' : undefined}
              >
                {day}
              </span>
            ))}
          </div>
        </section>

        <section className="rahhal-bh-panel" data-testid="bh-map">
          <h2>{locale === 'en' ? 'Map' : 'الخريطة'}</h2>
          <div className="rahhal-bh-placeholder">{mapPlaceholder}</div>
        </section>
      </div>

      <div className="rahhal-bh-layout">
        <section className="rahhal-bh-panel" data-testid="bh-favorites">
          <h2>{locale === 'en' ? 'Favorites' : 'المفضلة'}</h2>
          <div className="rahhal-bh-grid" style={{ margin: '0.45rem 0 0' }}>
            {favorites.map((item) => (
              <article key={item.id} className="rahhal-bh-card">
                <strong>{item.name}</strong>
                <em>{item.meta}</em>
              </article>
            ))}
          </div>
        </section>
        <section className="rahhal-bh-panel" data-testid="bh-bookmarks">
          <h2>{locale === 'en' ? 'Bookmarks' : 'الإشارات المرجعية'}</h2>
          <div className="rahhal-bh-grid" style={{ margin: '0.45rem 0 0' }}>
            {bookmarks.map((item) => (
              <article key={item.id} className="rahhal-bh-card">
                <strong>{item.name}</strong>
                <em>{item.meta}</em>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
