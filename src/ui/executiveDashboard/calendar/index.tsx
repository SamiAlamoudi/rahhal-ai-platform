import type { CalendarViewMode, ExecutiveLocale } from '../types'
import { CALENDAR_VIEWS } from '../types'

const LABELS: Record<CalendarViewMode, { ar: string; en: string }> = {
  monthly: { ar: 'شهري', en: 'Monthly' },
  weekly: { ar: 'أسبوعي', en: 'Weekly' },
  daily: { ar: 'يومي', en: 'Daily' },
  agenda: { ar: 'أجندة', en: 'Agenda' },
}

/** Calendar placeholder — no sync / Firebase / backend. */
export function CalendarPlaceholder({
  view,
  locale = 'ar',
  onViewChange,
}: {
  view: CalendarViewMode
  locale?: ExecutiveLocale
  onViewChange: (view: CalendarViewMode) => void
}) {
  return (
    <section
      data-testid="ed-calendar"
      data-placeholder="true"
      data-calendar-view={view}
      className="rahhal-ed-calendar"
    >
      <header>
        <h2>{locale === 'en' ? 'Calendar' : 'التقويم'}</h2>
        <div className="rahhal-ed-calendar__views">
          {CALENDAR_VIEWS.map((mode) => (
            <button
              key={mode}
              type="button"
              data-view={mode}
              className={view === mode ? 'is-active' : undefined}
              aria-pressed={view === mode}
              onClick={() => onViewChange(mode)}
            >
              {locale === 'en' ? LABELS[mode].en : LABELS[mode].ar}
            </button>
          ))}
        </div>
      </header>
      <div className="rahhal-ed-calendar__canvas" data-testid="ed-calendar-canvas">
        {locale === 'en'
          ? `${LABELS[view].en} view placeholder`
          : `عرض ${LABELS[view].ar} — واجهة فقط`}
      </div>
    </section>
  )
}
