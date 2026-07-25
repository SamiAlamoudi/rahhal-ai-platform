import type {
  BookingHubLocale,
  BookingStatCard,
  BookingTripCard,
} from '../types'

export interface BookingOverviewProps {
  overview: string
  stats: BookingStatCard[]
  upcomingTrips: BookingTripCard[]
  pastTrips: BookingTripCard[]
  locale: BookingHubLocale
}

function TripGrid({
  title,
  items,
  testId,
}: {
  title: string
  items: BookingTripCard[]
  testId: string
}) {
  return (
    <section className="rahhal-bh-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-bh-grid" style={{ margin: '0.45rem 0 0' }}>
        {items.map((trip) => (
          <article key={trip.id} className="rahhal-bh-card">
            <strong>{trip.title}</strong>
            <span>{trip.subtitle}</span>
            <em>
              {trip.dateLabel} · {trip.statusLabel}
            </em>
          </article>
        ))}
      </div>
    </section>
  )
}

export function BookingOverview({
  overview,
  stats,
  upcomingTrips,
  pastTrips,
  locale,
}: BookingOverviewProps) {
  return (
    <>
      <section className="rahhal-bh-panel" data-testid="bh-overview">
        <h2>{locale === 'en' ? 'Overview' : 'نظرة عامة'}</h2>
        <p>{overview}</p>
      </section>

      <div className="rahhal-bh-grid" data-testid="bh-stats">
        {stats.map((stat) => (
          <article key={stat.id} className="rahhal-bh-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      <TripGrid
        title={locale === 'en' ? 'Upcoming trips' : 'الرحلات القادمة'}
        items={upcomingTrips}
        testId="bh-upcoming-trips"
      />
      <TripGrid
        title={locale === 'en' ? 'Past trips' : 'الرحلات السابقة'}
        items={pastTrips}
        testId="bh-past-trips"
      />
    </>
  )
}
