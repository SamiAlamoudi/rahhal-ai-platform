import type { InsightsCenterLocale, InsightsFilterId } from '../types'
import { INSIGHTS_FILTERS } from '../types'

const LABELS: Record<InsightsFilterId, { ar: string; en: string }> = {
  this_trip: { ar: 'هذه الرحلة', en: 'This trip' },
  this_month: { ar: 'هذا الشهر', en: 'This month' },
  this_year: { ar: 'هذا العام', en: 'This year' },
  lifetime: { ar: 'مدى الحياة', en: 'Lifetime' },
  business: { ar: 'عمل', en: 'Business' },
  personal: { ar: 'شخصي', en: 'Personal' },
}

export function InsightsFilters({
  active,
  locale = 'ar',
  onChange,
}: {
  active: InsightsFilterId
  locale?: InsightsCenterLocale
  onChange: (id: InsightsFilterId) => void
}) {
  return (
    <nav data-testid="ic-filters" className="rahhal-ic-filters" aria-label="filters">
      {INSIGHTS_FILTERS.map((id) => (
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
