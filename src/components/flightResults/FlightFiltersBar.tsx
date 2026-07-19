import type { CabinClass } from '../../utils/contracts/models/flight'
import type { FlightFilterState, TimeOfDayWindow } from '../../lib/flightResults'

export interface FlightFiltersBarProps {
  filters: FlightFilterState
  airlines: string[]
  maxPriceCeiling: number
  locale?: 'ar' | 'en'
  onChange: (next: FlightFilterState) => void
}

export function FlightFiltersBar({
  filters,
  airlines,
  maxPriceCeiling,
  locale = 'en',
  onChange,
}: FlightFiltersBarProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)
  const update = (patch: Partial<FlightFilterState>) => onChange({ ...filters, ...patch })

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-bold text-slate-800">{t('تصفية الرحلات', 'Filter flights')}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
          {t('الحد الأقصى للسعر', 'Maximum price')}
          <input
            type="number"
            min={0}
            max={maxPriceCeiling}
            value={filters.maxPrice ?? ''}
            placeholder={String(maxPriceCeiling)}
            onChange={(e) => {
              const value = e.target.value
              update({ maxPrice: value === '' ? null : Number(value) })
            }}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
          {t('التوقفات', 'Stops')}
          <select
            value={filters.stops}
            onChange={(e) => update({ stops: e.target.value as FlightFilterState['stops'] })}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="any">{t('الكل', 'Any')}</option>
            <option value="nonstop">{t('مباشر', 'Nonstop')}</option>
            <option value="max1">{t('توقف واحد كحد أقصى', 'Max 1 stop')}</option>
            <option value="max2">{t('توقفان كحد أقصى', 'Max 2 stops')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
          {t('الدرجة', 'Cabin')}
          <select
            value={filters.cabin}
            onChange={(e) => update({ cabin: e.target.value as CabinClass | 'any' })}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="any">{t('الكل', 'Any')}</option>
            <option value="economy">{t('اقتصادية', 'Economy')}</option>
            <option value="premium-economy">{t('اقتصادية مميزة', 'Premium economy')}</option>
            <option value="business">{t('رجال أعمال', 'Business')}</option>
            <option value="first">{t('أولى', 'First')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
          {t('وقت المغادرة', 'Departure time')}
          <select
            value={filters.departureWindow}
            onChange={(e) => update({ departureWindow: e.target.value as TimeOfDayWindow })}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="any">{t('أي وقت', 'Any')}</option>
            <option value="morning">{t('صباح', 'Morning')}</option>
            <option value="afternoon">{t('ظهر', 'Afternoon')}</option>
            <option value="evening">{t('مساء', 'Evening')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
          {t('وقت الوصول', 'Arrival time')}
          <select
            value={filters.arrivalWindow}
            onChange={(e) => update({ arrivalWindow: e.target.value as TimeOfDayWindow })}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="any">{t('أي وقت', 'Any')}</option>
            <option value="morning">{t('صباح', 'Morning')}</option>
            <option value="afternoon">{t('ظهر', 'Afternoon')}</option>
            <option value="evening">{t('مساء', 'Evening')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600 sm:col-span-2 lg:col-span-1">
          {t('شركات الطيران', 'Airlines')}
          <select
            multiple
            value={filters.airlines}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
              update({ airlines: selected })
            }}
            className="min-h-[2.5rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            {airlines.map((airline) => (
              <option key={airline} value={airline}>{airline}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
