import type { AlertModel, TravelWorkspaceLocale } from '../types'

export function AlertsPanel({
  alerts,
  locale = 'ar',
}: {
  alerts: AlertModel[]
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-alerts-panel" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Important alerts' : 'تنبيهات مهمة'}</h2>
      <ul>
        {alerts.map((a) => (
          <li key={a.id} data-severity={a.severity} className={`is-${a.severity}`}>
            {a.message}
          </li>
        ))}
      </ul>
    </section>
  )
}
