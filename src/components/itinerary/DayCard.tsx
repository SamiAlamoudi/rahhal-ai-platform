import type { DayPlan, ItineraryLocale } from '../../lib/smartItinerary'

export interface DayCardProps {
  day: DayPlan
  locale: ItineraryLocale
}

export function DayCard({ day, locale }: DayCardProps) {
  const title = locale === 'ar' ? day.titleAr : day.titleEn
  const notes = locale === 'ar' ? day.notesAr : day.notesEn

  return (
    <article
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
      data-testid={`day-card-${day.dayIndex}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {day.date ? (
          <span className="text-[10px] font-medium text-slate-400">{day.date}</span>
        ) : null}
      </div>
      <ul className="mt-3 space-y-2">
        {day.parts.map((block) => (
          <li key={block.part} className="text-xs text-slate-700">
            <p className="font-semibold text-slate-800">
              {locale === 'ar' ? block.titleAr : block.titleEn}
            </p>
            <p className="mt-0.5 leading-relaxed text-slate-500">
              {locale === 'ar' ? block.bodyAr : block.bodyEn}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-slate-50 pt-2 text-[11px] text-slate-400">{notes}</p>
    </article>
  )
}

export interface DailyAgendaProps {
  days: DayPlan[]
  locale: ItineraryLocale
  title: string
}

export function DailyAgenda({ days, locale, title }: DailyAgendaProps) {
  return (
    <section data-testid="daily-agenda">
      <h2 className="mb-3 text-sm font-bold text-slate-900">{title}</h2>
      {days.length === 0 ? (
        <p className="text-xs text-slate-500">
          {locale === 'ar' ? 'لا توجد أيام مخططة.' : 'No planned days.'}
        </p>
      ) : (
        <div className="space-y-3">
          {days.map((day) => (
            <DayCard key={day.dayIndex} day={day} locale={locale} />
          ))}
        </div>
      )}
    </section>
  )
}
