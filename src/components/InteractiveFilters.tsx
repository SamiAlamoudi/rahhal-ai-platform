import { memo } from 'react'

export interface FilterKey {
  id: string
  label: string
  icon: string
}

const FILTERS: FilterKey[] = [
  { id: 'budget', label: 'ميزانية', icon: '💰' },
  { id: 'luxury', label: 'فخامة', icon: '💎' },
  { id: 'family', label: 'عائلي', icon: '👨‍👩‍👧' },
  { id: 'business', label: 'عمل', icon: '💼' },
  { id: 'adventure', label: 'مغامرة', icon: '🗺️' },
  { id: 'beach', label: 'شاطئ', icon: '🏖️' },
  { id: 'city', label: 'مدينة', icon: '🏙️' },
  { id: 'nature', label: 'طبيعة', icon: '🌿' },
  { id: 'culture', label: 'ثقافة', icon: '🏛️' },
  { id: 'visa-friendly', label: 'تأشيرة سهلة', icon: '🛂' },
  { id: 'weather', label: 'طقس', icon: '☀️' },
  { id: 'fastest', label: 'أسرع رحلة', icon: '⚡' },
  { id: 'shortest-flight', label: 'أقصر طيران', icon: '✈️' },
  { id: 'best-value', label: 'أفضل قيمة', icon: '⭐' },
]

interface Props {
  activeFilters: Set<string>
  onToggleFilter: (id: string) => void
  onClearAll: () => void
}

function InteractiveFiltersImpl({ activeFilters, onToggleFilter, onClearAll }: Props) {
  return (
    <section
      aria-labelledby="filters-heading"
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🎛️</span>
          <h3 id="filters-heading" className="text-sm font-bold text-slate-900">تصفية النتائج</h3>
        </div>
        {activeFilters.size > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[10px] font-medium text-slate-400 transition-colors hover:text-rose-500"
          >
            مسح الكل ({activeFilters.size})
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(filter => {
          const active = activeFilters.has(filter.id)
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onToggleFilter(filter.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400/20 ${
                active
                  ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-primary-200 hover:text-primary-600'
              }`}
              aria-pressed={active}
            >
              <span aria-hidden>{filter.icon}</span>
              <span>{filter.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export const InteractiveFilters = memo(InteractiveFiltersImpl)
