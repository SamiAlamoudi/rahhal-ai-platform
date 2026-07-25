import type { ExecutiveLocale } from '../types'

export function ExecutiveWidgets({
  locale = 'ar',
  progressPercent = 0,
}: {
  locale?: ExecutiveLocale
  progressPercent?: number
}) {
  const clamped = Math.max(0, Math.min(100, progressPercent))
  return (
    <section data-testid="ed-widgets" className="rahhal-ed-widgets">
      <article data-testid="ed-widget-weather" data-placeholder="true">
        <h3>{locale === 'en' ? 'Weather' : 'الطقس'}</h3>
        <p>{locale === 'en' ? 'Weather placeholder' : 'طقس — واجهة'}</p>
      </article>
      <article data-testid="ed-widget-currency" data-placeholder="true">
        <h3>{locale === 'en' ? 'Currency' : 'العملة'}</h3>
        <p>{locale === 'en' ? 'Currency placeholder' : 'عملة — واجهة'}</p>
      </article>
      <article data-testid="ed-widget-world-clock">
        <h3>{locale === 'en' ? 'World clock' : 'ساعة العالم'}</h3>
        <ul>
          <li>Riyadh · 15:00</li>
          <li>Paris · 14:00</li>
          <li>Dubai · 16:00</li>
        </ul>
      </article>
      <article data-testid="ed-widget-countdown">
        <h3>{locale === 'en' ? 'Countdown' : 'العدّ التنازلي'}</h3>
        <p>02d 14h 20m</p>
      </article>
      <article data-testid="ed-widget-progress-ring" className="rahhal-ed-ring">
        <h3>{locale === 'en' ? 'Progress ring' : 'حلقة التقدم'}</h3>
        <div
          className="rahhal-ed-ring__visual"
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ ['--ring' as string]: `${clamped}%` }}
        >
          <span>{clamped}%</span>
        </div>
      </article>
      <article data-testid="ed-widget-status">
        <h3>{locale === 'en' ? 'Status indicators' : 'مؤشرات الحالة'}</h3>
        <ul className="rahhal-ed-status-list">
          <li data-status="ok">Flights</li>
          <li data-status="warn">Transfers</li>
          <li data-status="ok">Hotels</li>
        </ul>
      </article>
    </section>
  )
}
