import type { MemoryCenterLocale, MemoryFilterId } from '../types'
import { MEMORY_FILTERS } from '../types'

const FILTER_LABELS: Record<
  MemoryFilterId,
  { ar: string; en: string }
> = {
  all: { ar: 'الكل', en: 'All' },
  destinations: { ar: 'وجهات', en: 'Destinations' },
  preferences: { ar: 'تفضيلات', en: 'Preferences' },
  documents: { ar: 'وثائق', en: 'Documents' },
  conversations: { ar: 'محادثات', en: 'Conversations' },
  rules: { ar: 'قواعد', en: 'Rules' },
}

export interface MemoryToolbarProps {
  activeFilter: MemoryFilterId
  searchQuery: string
  locale: MemoryCenterLocale
  onFilterChange: (filter: MemoryFilterId) => void
  onSearchChange: (query: string) => void
}

export function MemoryToolbar({
  activeFilter,
  searchQuery,
  locale,
  onFilterChange,
  onSearchChange,
}: MemoryToolbarProps) {
  return (
    <>
      <div className="rahhal-mc-toolbar" data-testid="mc-search">
        <input
          type="search"
          value={searchQuery}
          placeholder={
            locale === 'en'
              ? 'Search memories (UI only)…'
              : 'ابحث في الذكريات (واجهة فقط)…'
          }
          aria-label={locale === 'en' ? 'Search memories' : 'بحث الذكريات'}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button type="button" data-testid="mc-bookmarks-btn">
          {locale === 'en' ? 'Bookmarks' : 'المفضلة'}
        </button>
      </div>

      <nav className="rahhal-mc-filters" data-testid="mc-filters" aria-label="filters">
        {MEMORY_FILTERS.map((id) => (
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
