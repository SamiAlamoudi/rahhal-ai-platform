import type { ExecutiveLocale, ExecutiveMetricModel } from '../types'

const LABELS: Record<string, { ar: string; en: string }> = {
  total_trips: { ar: 'إجمالي الرحلات', en: 'Total trips' },
  upcoming_flights: { ar: 'رحلات قادمة', en: 'Upcoming flights' },
  travelers: { ar: 'المسافرون', en: 'Travelers' },
  hotels: { ar: 'فنادق', en: 'Hotels' },
  documents: { ar: 'مستندات', en: 'Documents' },
  pending_tasks: { ar: 'مهام معلّقة', en: 'Pending tasks' },
  completed_tasks: { ar: 'مهام مكتملة', en: 'Completed tasks' },
}

export function ExecutiveMetrics({
  metrics,
  locale = 'ar',
}: {
  metrics: ExecutiveMetricModel[]
  locale?: ExecutiveLocale
}) {
  return (
    <section data-testid="ed-metrics" className="rahhal-ed-metrics">
      {metrics.map((m) => (
        <article key={m.id} data-metric={m.labelKey} className="rahhal-ed-metric">
          <strong>{m.value}</strong>
          <span>
            {LABELS[m.labelKey]
              ? locale === 'en'
                ? LABELS[m.labelKey].en
                : LABELS[m.labelKey].ar
              : m.labelKey}
          </span>
        </article>
      ))}
    </section>
  )
}
