import type { TravelWorkspaceLocale } from '../types'

/** Weather placeholder — no weather APIs. */
export function WeatherPanel({ locale = 'ar' }: { locale?: TravelWorkspaceLocale }) {
  return (
    <section
      data-testid="tw-weather-panel"
      data-placeholder="true"
      className="rahhal-tw-panel-card"
    >
      <h2>{locale === 'en' ? 'Weather' : 'الطقس'}</h2>
      <p>{locale === 'en' ? 'Weather placeholder' : 'طقس — واجهة فقط'}</p>
    </section>
  )
}
