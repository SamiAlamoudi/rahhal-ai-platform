import type { TripStatisticsModel, TravelWorkspaceLocale } from '../types'

export function TripStatistics({
  stats,
  locale = 'ar',
}: {
  stats: TripStatisticsModel
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-trip-statistics" className="rahhal-tw-panel-card">
      <h2>{locale === 'en' ? 'Trip statistics' : 'إحصاءات الرحلة'}</h2>
      <ul>
        <li>
          {locale === 'en' ? 'Flights' : 'رحلات'}: {stats.flights}
        </li>
        <li>
          {locale === 'en' ? 'Hotels' : 'فنادق'}: {stats.hotels}
        </li>
        <li>
          {locale === 'en' ? 'Meetings' : 'اجتماعات'}: {stats.meetings}
        </li>
        <li>
          {locale === 'en' ? 'Activities' : 'أنشطة'}: {stats.activities}
        </li>
        <li>
          {locale === 'en' ? 'Transfers' : 'تنقلات'}: {stats.transfers}
        </li>
      </ul>
    </section>
  )
}
