import type { TimelineItemModel, TravelWorkspaceLocale } from '../types'

export function DailyAgenda({
  items,
  locale = 'ar',
}: {
  items: TimelineItemModel[]
  locale?: TravelWorkspaceLocale
}) {
  const today = items.filter((i) => i.status !== 'cancelled')
  return (
    <section data-testid="tw-daily-agenda" className="rahhal-tw-section">
      <h2>{locale === 'en' ? "Today's schedule" : 'جدول اليوم'}</h2>
      <ul>
        {today.map((item) => (
          <li key={item.id} data-status={item.status}>
            <strong>{item.timeLabel}</strong> {item.title}
          </li>
        ))}
      </ul>
    </section>
  )
}
