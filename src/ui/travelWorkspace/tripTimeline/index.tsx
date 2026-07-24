import type {
  TimelineItemModel,
  TimelinePeriod,
  TravelWorkspaceLocale,
} from '../types'

const PERIODS: TimelinePeriod[] = ['morning', 'afternoon', 'evening']

const PERIOD_LABEL: Record<TimelinePeriod, { ar: string; en: string }> = {
  morning: { ar: 'الصباح', en: 'Morning' },
  afternoon: { ar: 'بعد الظهر', en: 'Afternoon' },
  evening: { ar: 'المساء', en: 'Evening' },
}

export function TripTimeline({
  items,
  locale = 'ar',
}: {
  items: TimelineItemModel[]
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-trip-timeline" className="rahhal-tw-timeline">
      <h2>{locale === 'en' ? 'Timeline' : 'الجدول الزمني'}</h2>
      {PERIODS.map((period) => {
        const periodItems = items.filter((i) => i.period === period)
        return (
          <div key={period} data-period={period} className="rahhal-tw-timeline__period">
            <h3>
              {locale === 'en' ? PERIOD_LABEL[period].en : PERIOD_LABEL[period].ar}
            </h3>
            <ol>
              {periodItems.map((item) => (
                <li
                  key={item.id}
                  data-testid="tw-timeline-item"
                  data-status={item.status}
                  className={`rahhal-tw-timeline__item is-${item.status}`}
                >
                  <span className="rahhal-tw-timeline__dot" aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.timeLabel} · {item.status}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )
      })}
    </section>
  )
}
