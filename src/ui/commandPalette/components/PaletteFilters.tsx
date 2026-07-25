import type { CommandPaletteLocale, PaletteFilterId } from '../types'
import { PALETTE_FILTERS } from '../types'

const LABELS: Record<PaletteFilterId, { ar: string; en: string }> = {
  trips: { ar: 'رحلات', en: 'Trips' },
  travelers: { ar: 'مسافرون', en: 'Travelers' },
  flights: { ar: 'طيران', en: 'Flights' },
  hotels: { ar: 'فنادق', en: 'Hotels' },
  documents: { ar: 'مستندات', en: 'Documents' },
  messages: { ar: 'رسائل', en: 'Messages' },
  voice: { ar: 'صوت', en: 'Voice' },
  knowledge: { ar: 'معرفة', en: 'Knowledge' },
  books: { ar: 'كتب', en: 'Books' },
  settings: { ar: 'إعدادات', en: 'Settings' },
}

export function PaletteFilters({
  active,
  locale = 'ar',
  onChange,
}: {
  active: PaletteFilterId | 'all'
  locale?: CommandPaletteLocale
  onChange: (id: PaletteFilterId | 'all') => void
}) {
  return (
    <div className="rahhal-cp-filters" data-testid="cp-filters">
      <button
        type="button"
        data-filter="all"
        className={active === 'all' ? 'is-active' : undefined}
        aria-pressed={active === 'all'}
        onClick={() => onChange('all')}
      >
        {locale === 'en' ? 'All' : 'الكل'}
      </button>
      {PALETTE_FILTERS.map((id) => (
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
    </div>
  )
}
