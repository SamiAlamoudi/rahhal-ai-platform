import type {
  InsightsAchievementBadge,
  InsightsCenterLocale,
  InsightsTimelinePoint,
  InsightsTripCountModel,
} from '../types'

export function HealthAndPlaceholders({
  travelHealthScore,
  tripFrequencyLabel,
  tripCounts,
  carbonFootprintPlaceholder,
  passportStatusPlaceholder,
  visaStatusPlaceholder,
  loyaltySummaryPlaceholder,
  timelineSummary,
  badges,
  locale = 'ar',
}: {
  travelHealthScore: number
  tripFrequencyLabel: string
  tripCounts: InsightsTripCountModel
  carbonFootprintPlaceholder: string
  passportStatusPlaceholder: string
  visaStatusPlaceholder: string
  loyaltySummaryPlaceholder: string
  timelineSummary: InsightsTimelinePoint[]
  badges: InsightsAchievementBadge[]
  locale?: InsightsCenterLocale
}) {
  const score = Math.max(0, Math.min(100, travelHealthScore))
  return (
    <div className="rahhal-ic-health" data-testid="ic-health-block">
      <section className="rahhal-ic-panel" data-testid="ic-health-score">
        <h2>{locale === 'en' ? 'Travel health score' : 'درجة صحة السفر'}</h2>
        <div
          className="rahhal-ic-ring"
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ ['--ring' as string]: `${score}%` }}
        >
          <span data-testid="ic-health-value">{score}</span>
        </div>
      </section>

      <section className="rahhal-ic-panel" data-testid="ic-trip-counts">
        <h2>{locale === 'en' ? 'Trips' : 'الرحلات'}</h2>
        <p data-testid="ic-trip-frequency">{tripFrequencyLabel}</p>
        <ul>
          <li data-testid="ic-upcoming">
            {locale === 'en' ? 'Upcoming' : 'قادمة'}: {tripCounts.upcoming}
          </li>
          <li data-testid="ic-completed">
            {locale === 'en' ? 'Completed' : 'مكتملة'}: {tripCounts.completed}
          </li>
          <li data-testid="ic-cancelled">
            {locale === 'en' ? 'Cancelled' : 'ملغاة'}: {tripCounts.cancelled}
          </li>
        </ul>
      </section>

      <section className="rahhal-ic-panel" data-testid="ic-timeline-chart">
        <h2>
          {locale === 'en' ? 'Travel timeline summary' : 'ملخص الجدول الزمني'}
        </h2>
        <div className="rahhal-ic-timeline-bars">
          {timelineSummary.map((point) => (
            <div key={point.id} data-point={point.id}>
              <i style={{ height: `${Number(point.valueLabel) * 12}px` }} />
              <span>{point.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rahhal-ic-panel" data-testid="ic-badges">
        <h2>{locale === 'en' ? 'Achievement badges' : 'شارات الإنجاز'}</h2>
        <ul className="rahhal-ic-badges">
          {badges.map((badge) => (
            <li
              key={badge.id}
              data-earned={badge.earned ? 'true' : 'false'}
              className={badge.earned ? 'is-earned' : undefined}
            >
              {badge.label}
            </li>
          ))}
        </ul>
      </section>

      <PlaceholderCard
        testId="ic-passport"
        title={locale === 'en' ? 'Passport status' : 'حالة الجواز'}
        body={passportStatusPlaceholder}
      />
      <PlaceholderCard
        testId="ic-visa"
        title={locale === 'en' ? 'Visa status' : 'حالة التأشيرة'}
        body={visaStatusPlaceholder}
      />
      <PlaceholderCard
        testId="ic-loyalty"
        title={locale === 'en' ? 'Loyalty summary' : 'ملخص الولاء'}
        body={loyaltySummaryPlaceholder}
      />
      <PlaceholderCard
        testId="ic-carbon"
        title={locale === 'en' ? 'Carbon footprint' : 'البصمة الكربونية'}
        body={carbonFootprintPlaceholder}
      />
    </div>
  )
}

function PlaceholderCard({
  testId,
  title,
  body,
}: {
  testId: string
  title: string
  body: string
}) {
  return (
    <section
      className="rahhal-ic-panel"
      data-testid={testId}
      data-placeholder="true"
    >
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  )
}
