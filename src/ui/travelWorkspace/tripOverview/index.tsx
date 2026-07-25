import type { TripOverviewModel, TravelWorkspaceLocale } from '../types'

export function TripOverview({
  trip,
  locale = 'ar',
}: {
  trip: TripOverviewModel
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-trip-overview" className="rahhal-tw-overview">
      <p className="rahhal-tw-brand">رحّال</p>
      <h1>{locale === 'en' ? 'Travel Workspace' : 'مساحة السفر'}</h1>
      <dl className="rahhal-tw-overview__grid">
        <div>
          <dt>{locale === 'en' ? 'Destination' : 'الوجهة'}</dt>
          <dd data-testid="tw-destination">{trip.destination}</dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Dates' : 'التواريخ'}</dt>
          <dd>
            {trip.startDate} → {trip.endDate}
          </dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Duration' : 'المدة'}</dt>
          <dd>
            {trip.durationDays} {locale === 'en' ? 'days' : 'أيام'}
          </dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Travelers' : 'المسافرون'}</dt>
          <dd>{trip.travelerCount}</dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Status' : 'الحالة'}</dt>
          <dd data-testid="tw-trip-status-value">{trip.status}</dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Progress' : 'التقدم'}</dt>
          <dd>{trip.progressPercent}%</dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Budget' : 'الميزانية'}</dt>
          <dd>{trip.budgetLabel}</dd>
        </div>
      </dl>
    </section>
  )
}
