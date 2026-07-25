import type { DashboardFilterId, ExecutiveLocale, ExecutiveSearchState } from '../types'
import { DASHBOARD_FILTERS } from '../types'

export function ExecutiveSearch({
  search,
  locale = 'ar',
  onChange,
}: {
  search: ExecutiveSearchState
  locale?: ExecutiveLocale
  onChange: (next: ExecutiveSearchState) => void
}) {
  return (
    <section data-testid="ed-search" className="rahhal-ed-search">
      <label>
        <span className="rahhal-ed-sr-only">
          {locale === 'en' ? 'Global search' : 'بحث عام'}
        </span>
        <input
          type="search"
          data-testid="ed-global-search"
          value={search.query}
          placeholder={locale === 'en' ? 'Search…' : 'بحث…'}
          onChange={(e) => onChange({ ...search, query: e.target.value })}
        />
      </label>
      <select
        data-testid="ed-search-category"
        value={search.category}
        onChange={(e) =>
          onChange({
            ...search,
            category: e.target.value as DashboardFilterId | 'all',
          })
        }
      >
        <option value="all">{locale === 'en' ? 'All categories' : 'كل الفئات'}</option>
        {DASHBOARD_FILTERS.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
      <label>
        <input
          type="checkbox"
          data-testid="ed-search-recent"
          checked={search.showRecent}
          onChange={(e) => onChange({ ...search, showRecent: e.target.checked })}
        />
        {locale === 'en' ? 'Recent' : 'الأخيرة'}
      </label>
      <label>
        <input
          type="checkbox"
          data-testid="ed-search-favorites"
          checked={search.showFavorites}
          onChange={(e) =>
            onChange({ ...search, showFavorites: e.target.checked })
          }
        />
        {locale === 'en' ? 'Favorites' : 'المفضلة'}
      </label>
    </section>
  )
}
