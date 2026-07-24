import type { BookingFilterId, BookingHubLocale } from '../types'
import { BOOKING_FILTERS } from '../types'

const FILTER_LABELS: Record<BookingFilterId, { ar: string; en: string }> = {
  all: { ar: 'الكل', en: 'All' },
  upcoming: { ar: 'قادمة', en: 'Upcoming' },
  past: { ar: 'سابقة', en: 'Past' },
  flights: { ar: 'طيران', en: 'Flights' },
  hotels: { ar: 'فنادق', en: 'Hotels' },
  transport: { ar: 'تنقل', en: 'Transport' },
}

export interface BookingToolbarProps {
  activeFilter: BookingFilterId
  searchQuery: string
  locale: BookingHubLocale
  onFilterChange: (filter: BookingFilterId) => void
  onSearchChange: (query: string) => void
}

export function BookingToolbar({
  activeFilter,
  searchQuery,
  locale,
  onFilterChange,
  onSearchChange,
}: BookingToolbarProps) {
  return (
    <>
      <div className="rahhal-bh-toolbar" data-testid="bh-search">
        <input
          type="search"
          value={searchQuery}
          placeholder={
            locale === 'en'
              ? 'Search bookings (UI only)…'
              : 'ابحث في الحجوزات (واجهة فقط)…'
          }
          aria-label={locale === 'en' ? 'Search bookings' : 'بحث الحجوزات'}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button type="button" data-testid="bh-favorites-btn">
          {locale === 'en' ? 'Favorites' : 'المفضلة'}
        </button>
        <button type="button" data-testid="bh-bookmarks-btn">
          {locale === 'en' ? 'Bookmarks' : 'مثبّت'}
        </button>
      </div>

      <nav
        className="rahhal-bh-filters"
        data-testid="bh-filters"
        aria-label="filters"
      >
        {BOOKING_FILTERS.map((id) => (
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
