import type { BookingHubLocale, BookingServiceCard } from '../types'

export interface ServicesPanelProps {
  flights: BookingServiceCard[]
  hotels: BookingServiceCard[]
  transportation: BookingServiceCard[]
  cruises: BookingServiceCard[]
  trains: BookingServiceCard[]
  activities: BookingServiceCard[]
  restaurants: BookingServiceCard[]
  events: BookingServiceCard[]
  insurance: BookingServiceCard[]
  locale: BookingHubLocale
}

function ServiceBlock({
  title,
  items,
  testId,
}: {
  title: string
  items: BookingServiceCard[]
  testId: string
}) {
  return (
    <section className="rahhal-bh-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-bh-grid" style={{ margin: '0.45rem 0 0' }}>
        {items.map((item) => (
          <article key={item.id} className="rahhal-bh-card">
            <strong>{item.title}</strong>
            <span>{item.meta}</span>
            <em>{item.priceLabel}</em>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ServicesPanel({
  flights,
  hotels,
  transportation,
  cruises,
  trains,
  activities,
  restaurants,
  events,
  insurance,
  locale,
}: ServicesPanelProps) {
  return (
    <>
      <div className="rahhal-bh-layout">
        <ServiceBlock
          title={locale === 'en' ? 'Flights' : 'الطيران'}
          items={flights}
          testId="bh-flights"
        />
        <ServiceBlock
          title={locale === 'en' ? 'Hotels' : 'الفنادق'}
          items={hotels}
          testId="bh-hotels"
        />
      </div>
      <div className="rahhal-bh-layout">
        <ServiceBlock
          title={locale === 'en' ? 'Transportation' : 'التنقل'}
          items={transportation}
          testId="bh-transportation"
        />
        <ServiceBlock
          title={locale === 'en' ? 'Cruises' : 'الرحلات البحرية'}
          items={cruises}
          testId="bh-cruises"
        />
      </div>
      <div className="rahhal-bh-layout">
        <ServiceBlock
          title={locale === 'en' ? 'Trains' : 'القطارات'}
          items={trains}
          testId="bh-trains"
        />
        <ServiceBlock
          title={locale === 'en' ? 'Activities' : 'الأنشطة'}
          items={activities}
          testId="bh-activities"
        />
      </div>
      <div className="rahhal-bh-grid">
        <ServiceBlock
          title={locale === 'en' ? 'Restaurants' : 'المطاعم'}
          items={restaurants}
          testId="bh-restaurants"
        />
        <ServiceBlock
          title={locale === 'en' ? 'Events' : 'الفعاليات'}
          items={events}
          testId="bh-events"
        />
        <ServiceBlock
          title={locale === 'en' ? 'Insurance' : 'التأمين'}
          items={insurance}
          testId="bh-insurance"
        />
      </div>
    </>
  )
}
