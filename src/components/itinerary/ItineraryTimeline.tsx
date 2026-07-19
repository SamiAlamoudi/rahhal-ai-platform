import type { TimelineItem, ItineraryLocale } from '../../lib/smartItinerary'

export interface TimelineItemViewProps {
  item: TimelineItem
  locale: ItineraryLocale
  active?: boolean
}

export function TimelineItemView({ item, locale, active }: TimelineItemViewProps) {
  const label = locale === 'ar' ? item.labelAr : item.labelEn
  const detail = locale === 'ar' ? item.detailAr : item.detailEn

  return (
    <li className="relative text-xs text-slate-700" data-testid={`timeline-item-${item.type}`}>
      <span
        className={`absolute -start-[1.35rem] top-1 h-2.5 w-2.5 rounded-full ${
          active ? 'bg-primary-600 ring-2 ring-primary-200' : item.placeholder ? 'bg-slate-200' : 'bg-slate-400'
        }`}
      />
      <p className={`font-semibold ${active ? 'text-primary-700' : ''}`}>
        {label}
        {item.placeholder ? (
          <span className="ms-2 text-[10px] font-medium text-slate-400">
            {locale === 'ar' ? 'قريباً' : 'Soon'}
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{detail}</p>
      {item.at ? (
        <p className="mt-0.5 text-[10px] text-slate-400">
          {new Date(item.at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
        </p>
      ) : null}
    </li>
  )
}

export interface ItineraryTimelineProps {
  items: TimelineItem[]
  locale?: ItineraryLocale
  activeType?: string | null
}

export function ItineraryTimeline({
  items,
  locale = 'ar',
  activeType = null,
}: ItineraryTimelineProps) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        {locale === 'ar' ? 'لا يوجد خط زمني بعد.' : 'No timeline yet.'}
      </p>
    )
  }

  return (
    <ol className="space-y-3 border-s-2 border-slate-100 ps-4" data-testid="itinerary-timeline">
      {items.map((item) => (
        <TimelineItemView
          key={item.id}
          item={item}
          locale={locale}
          active={activeType ? item.type === activeType : false}
        />
      ))}
    </ol>
  )
}
