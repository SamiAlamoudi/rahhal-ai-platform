import type {
  OperationsCenterLocale,
  OperationsMetricCard,
  OperationsPriority,
  OperationsRisk,
  OperationsTripCard,
} from '../types'

export interface OperationsOverviewProps {
  overview: string
  metrics: OperationsMetricCard[]
  activeTrips: OperationsTripCard[]
  upcomingTrips: OperationsTripCard[]
  delayedTrips: OperationsTripCard[]
  locale: OperationsCenterLocale
}

function StatusChips({
  priority,
  risk,
  locale,
}: {
  priority: OperationsPriority
  risk: OperationsRisk
  locale: OperationsCenterLocale
}) {
  return (
    <div className="rahhal-oc-chips" data-testid="oc-status-chips">
      <span className={priority === 'high' || priority === 'critical' ? `is-${priority}` : undefined}>
        {locale === 'en' ? `P:${priority}` : `أولوية:${priority}`}
      </span>
      <span className={risk === 'high' ? 'is-high' : undefined}>
        {locale === 'en' ? `R:${risk}` : `خطر:${risk}`}
      </span>
    </div>
  )
}

function TripBlock({
  title,
  items,
  testId,
  locale,
}: {
  title: string
  items: OperationsTripCard[]
  testId: string
  locale: OperationsCenterLocale
}) {
  return (
    <section className="rahhal-oc-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-oc-grid" style={{ margin: '0.45rem 0 0' }}>
        {items.map((trip) => (
          <article key={trip.id} className="rahhal-oc-card">
            <strong>{trip.title}</strong>
            <span>{trip.subtitle}</span>
            <em>{trip.statusLabel}</em>
            <StatusChips
              priority={trip.priority}
              risk={trip.risk}
              locale={locale}
            />
          </article>
        ))}
      </div>
    </section>
  )
}

export function OperationsOverview({
  overview,
  metrics,
  activeTrips,
  upcomingTrips,
  delayedTrips,
  locale,
}: OperationsOverviewProps) {
  return (
    <>
      <section className="rahhal-oc-panel" data-testid="oc-overview">
        <h2>{locale === 'en' ? 'Overview' : 'نظرة عامة'}</h2>
        <p>{overview}</p>
      </section>

      <div className="rahhal-oc-grid" data-testid="oc-metrics">
        {metrics.map((m) => (
          <article key={m.id} className="rahhal-oc-card">
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            {m.trendLabel ? <em>{m.trendLabel}</em> : null}
          </article>
        ))}
      </div>

      <TripBlock
        title={locale === 'en' ? 'Active trips' : 'الرحلات النشطة'}
        items={activeTrips}
        testId="oc-active-trips"
        locale={locale}
      />
      <div className="rahhal-oc-layout">
        <TripBlock
          title={locale === 'en' ? 'Upcoming trips' : 'الرحلات القادمة'}
          items={upcomingTrips}
          testId="oc-upcoming-trips"
          locale={locale}
        />
        <TripBlock
          title={locale === 'en' ? 'Delayed trips' : 'الرحلات المتأخرة'}
          items={delayedTrips}
          testId="oc-delayed-trips"
          locale={locale}
        />
      </div>
    </>
  )
}
