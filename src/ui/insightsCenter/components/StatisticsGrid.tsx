import type { InsightsCenterLocale, InsightsStatCard } from '../types'

const STAT_LABELS: Record<string, { ar: string; en: string }> = {
  trips: { ar: 'رحلات', en: 'Trips' },
  flights: { ar: 'طيران', en: 'Flights' },
  nights: { ar: 'ليالٍ', en: 'Nights' },
  travelers: { ar: 'مسافرون', en: 'Travelers' },
  meetings: { ar: 'اجتماعات', en: 'Meetings' },
  activities: { ar: 'أنشطة', en: 'Activities' },
}

export function StatisticsGrid({
  statistics,
  locale = 'ar',
  testId = 'ic-statistics',
}: {
  statistics: InsightsStatCard[]
  locale?: InsightsCenterLocale
  testId?: string
}) {
  return (
    <section data-testid={testId} className="rahhal-ic-stats">
      {statistics.map((stat) => (
        <article
          key={stat.id}
          className="rahhal-ic-card"
          data-testid="ic-stat-card"
          data-stat={stat.labelKey}
        >
          <strong>{stat.value}</strong>
          <span>
            {STAT_LABELS[stat.labelKey]
              ? locale === 'en'
                ? STAT_LABELS[stat.labelKey].en
                : STAT_LABELS[stat.labelKey].ar
              : stat.labelKey}
          </span>
          {stat.trendLabel ? (
            <em data-testid="ic-trend">{stat.trendLabel}</em>
          ) : null}
        </article>
      ))}
    </section>
  )
}
