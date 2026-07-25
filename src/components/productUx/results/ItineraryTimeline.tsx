import { useState } from 'react'
import type { ItineraryDayView, ProductLocale } from '../../../lib/productUx'

export interface ItineraryTimelineProps {
  days: ItineraryDayView[]
  locale?: ProductLocale
  onEditViaChat?: () => void
  onSave?: () => void
  onShare?: () => void
  onExport?: () => void
  onRefresh?: () => void
}

function QuietButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  )
}

export function ItineraryTimeline({
  days,
  locale = 'ar',
  onEditViaChat,
  onSave,
  onShare,
  onExport,
  onRefresh,
}: ItineraryTimelineProps) {
  const [openDay, setOpenDay] = useState<number | null>(days[0]?.day ?? null)

  return (
    <section
      data-testid="itinerary-timeline"
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
      aria-label={locale === 'ar' ? 'خط السير' : 'Itinerary'}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">
          {locale === 'ar' ? 'خط السير' : 'Itinerary'}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {onEditViaChat ? (
            <QuietButton
              label={locale === 'ar' ? 'عدّل بالمحادثة' : 'Edit in chat'}
              onClick={onEditViaChat}
            />
          ) : null}
          {onSave ? (
            <QuietButton label={locale === 'ar' ? 'حفظ' : 'Save'} onClick={onSave} />
          ) : null}
          {onShare ? (
            <QuietButton label={locale === 'ar' ? 'مشاركة' : 'Share'} onClick={onShare} />
          ) : null}
          {onExport ? (
            <QuietButton label={locale === 'ar' ? 'تصدير' : 'Export'} onClick={onExport} />
          ) : null}
          {onRefresh ? (
            <QuietButton label={locale === 'ar' ? 'تحديث' : 'Refresh'} onClick={onRefresh} />
          ) : null}
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        {days.map((day) => {
          const open = openDay === day.day
          return (
            <li key={day.day} className="rounded-xl border border-slate-100 bg-slate-50/70">
              <button
                type="button"
                className="flex w-full min-h-11 items-center justify-between px-3 py-2 text-start"
                aria-expanded={open}
                onClick={() => setOpenDay(open ? null : day.day)}
              >
                <span className="text-sm font-semibold text-slate-800">
                  {locale === 'ar' ? `اليوم ${day.day}` : `Day ${day.day}`} · {day.title}
                </span>
                <span className="text-xs text-slate-400">{open ? '−' : '+'}</span>
              </button>
              {open ? (
                <ul className="space-y-2 border-t border-slate-100 px-3 py-3">
                  {day.items.map((item) => (
                    <li
                      key={item.id}
                      className={`rounded-lg bg-white px-3 py-2 text-xs ${
                        item.warning || item.conflict
                          ? 'border border-amber-200'
                          : 'border border-transparent'
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-slate-800">{item.title}</span>
                        {item.timeLabel ? (
                          <span className="text-slate-400">{item.timeLabel}</span>
                        ) : null}
                      </div>
                      {item.detail ? (
                        <p className="mt-0.5 text-slate-500">{item.detail}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
