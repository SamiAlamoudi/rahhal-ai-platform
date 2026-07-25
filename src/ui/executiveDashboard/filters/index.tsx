import type { DashboardFilterId, ExecutiveLocale } from '../types'
import { DASHBOARD_FILTERS } from '../types'

const LABELS: Record<DashboardFilterId, { ar: string; en: string }> = {
  today: { ar: 'اليوم', en: 'Today' },
  tomorrow: { ar: 'غداً', en: 'Tomorrow' },
  this_week: { ar: 'هذا الأسبوع', en: 'This week' },
  trips: { ar: 'رحلات', en: 'Trips' },
  meetings: { ar: 'اجتماعات', en: 'Meetings' },
  flights: { ar: 'طيران', en: 'Flights' },
  hotels: { ar: 'فنادق', en: 'Hotels' },
  transportation: { ar: 'تنقل', en: 'Transportation' },
  documents: { ar: 'مستندات', en: 'Documents' },
}

export function DashboardFilters({
  active,
  locale = 'ar',
  onChange,
}: {
  active: DashboardFilterId
  locale?: ExecutiveLocale
  onChange: (id: DashboardFilterId) => void
}) {
  return (
    <nav data-testid="ed-filters" className="rahhal-ed-filters" aria-label="filters">
      {DASHBOARD_FILTERS.map((id) => (
        <button
          key={id}
          type="button"
          data-filter={id}
          className={active === id ? 'is-active' : undefined}
          aria-pressed={active === id}
          onClick={() => onChange(id)}
        >
          {locale === 'en' ? LABELS[id].en : LABELS[id].ar}
        </button>
      ))}
    </nav>
  )
}
