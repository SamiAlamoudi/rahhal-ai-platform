import type { OperationsCenterLocale, OperationsFilterId } from '../types'
import { OPERATIONS_FILTERS } from '../types'

const FILTER_LABELS: Record<OperationsFilterId, { ar: string; en: string }> = {
  all: { ar: 'الكل', en: 'All' },
  active: { ar: 'نشطة', en: 'Active' },
  delayed: { ar: 'متأخرة', en: 'Delayed' },
  incidents: { ar: 'حوادث', en: 'Incidents' },
  approvals: { ar: 'موافقات', en: 'Approvals' },
  visa: { ar: 'تأشيرات', en: 'Visa' },
}

export interface OperationsToolbarProps {
  activeFilter: OperationsFilterId
  searchQuery: string
  locale: OperationsCenterLocale
  onFilterChange: (filter: OperationsFilterId) => void
  onSearchChange: (query: string) => void
}

export function OperationsToolbar({
  activeFilter,
  searchQuery,
  locale,
  onFilterChange,
  onSearchChange,
}: OperationsToolbarProps) {
  return (
    <>
      <div className="rahhal-oc-toolbar" data-testid="oc-search">
        <input
          type="search"
          value={searchQuery}
          placeholder={
            locale === 'en'
              ? 'Search operations (UI only)…'
              : 'ابحث في العمليات (واجهة فقط)…'
          }
          aria-label={locale === 'en' ? 'Search operations' : 'بحث العمليات'}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button type="button" data-testid="oc-priority-btn">
          {locale === 'en' ? 'Priority' : 'الأولوية'}
        </button>
        <button type="button" data-testid="oc-risk-btn">
          {locale === 'en' ? 'Risk' : 'المخاطر'}
        </button>
      </div>

      <nav
        className="rahhal-oc-filters"
        data-testid="oc-filters"
        aria-label="filters"
      >
        {OPERATIONS_FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            className={id === activeFilter ? 'is-active' : undefined}
            data-filter={id}
            onClick={() => onFilterChange(id)}
          >
            {FILTER_LABELS[id][locale]}
          </button>
        ))}
      </nav>
    </>
  )
}
