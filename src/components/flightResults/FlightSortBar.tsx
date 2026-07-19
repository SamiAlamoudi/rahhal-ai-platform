import type { FlightSortKey } from '../../lib/flightResults'

export interface FlightSortBarProps {
  value: FlightSortKey
  locale?: 'ar' | 'en'
  onChange: (key: FlightSortKey) => void
}

const OPTIONS: Array<{ key: FlightSortKey; ar: string; en: string }> = [
  { key: 'best', ar: 'الأفضل', en: 'Best' },
  { key: 'cheapest', ar: 'الأرخص', en: 'Cheapest' },
  { key: 'fastest', ar: 'الأسرع', en: 'Fastest' },
  { key: 'earliest_departure', ar: 'أبكر مغادرة', en: 'Earliest departure' },
  { key: 'latest_departure', ar: 'أحدث مغادرة', en: 'Latest departure' },
]

export function FlightSortBar({ value, locale = 'en', onChange }: FlightSortBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              active
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {locale === 'ar' ? opt.ar : opt.en}
          </button>
        )
      })}
    </div>
  )
}
