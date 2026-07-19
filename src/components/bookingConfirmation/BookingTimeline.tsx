/** Compatible with ConfirmationEvent and OrderTimelineEvent. */
export interface TimelineEventView {
  id: string
  type: string
  at: string
  labelEn: string
  labelAr: string
}

export interface BookingTimelineProps {
  events: TimelineEventView[]
  locale?: 'ar' | 'en'
  /** Highlight the latest / active step. */
  activeType?: string | null
}

export function BookingTimeline({
  events,
  locale = 'en',
  activeType = null,
}: BookingTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        {locale === 'ar' ? 'لا يوجد خط زمني بعد.' : 'No timeline events yet.'}
      </p>
    )
  }

  return (
    <ol className="space-y-3 border-s-2 border-slate-100 ps-4" data-testid="booking-timeline">
      {events.map((event) => {
        const active = activeType ? event.type === activeType : false
        return (
          <li key={event.id} className="relative text-xs text-slate-700">
            <span
              className={`absolute -start-[1.35rem] top-1 h-2.5 w-2.5 rounded-full ${
                active ? 'bg-primary-600 ring-2 ring-primary-200' : 'bg-slate-300'
              }`}
            />
            <p className={`font-semibold ${active ? 'text-primary-700' : ''}`}>
              {locale === 'ar' ? event.labelAr : event.labelEn}
            </p>
            <p className="text-[11px] text-slate-400">
              {new Date(event.at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
