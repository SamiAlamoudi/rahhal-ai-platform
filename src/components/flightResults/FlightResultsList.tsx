import { useMemo, useState } from 'react'
import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'
import type { TravelSearchRequest } from '../../utils/travelSearchRequest'
import {
  buildFlightRecommendationSummary,
  emptyFlightFilters,
  filterFlights,
  onlyFlights,
  sortFlights,
  toFlightResultViewModel,
  uniqueAirlines,
  type FlightFilterState,
  type FlightSortKey,
} from '../../lib/flightResults'
import { FlightFiltersBar } from './FlightFiltersBar'
import { FlightRecommendationBanner } from './FlightRecommendationBanner'
import { FlightResultCard } from './FlightResultCard'
import { FlightSortBar } from './FlightSortBar'

export interface FlightResultsListProps {
  rankedOptions: NormalizedTravelOption[]
  searchRequest: TravelSearchRequest
  locale?: 'ar' | 'en'
  selectingId?: string | null
  onSelectFlight: (option: NormalizedTravelOption) => void
  onOpenDetails: (option: NormalizedTravelOption) => void
}

export function FlightResultsList({
  rankedOptions,
  searchRequest,
  locale = 'en',
  selectingId = null,
  onSelectFlight,
  onOpenDetails,
}: FlightResultsListProps) {
  const [sortKey, setSortKey] = useState<FlightSortKey>('best')
  const [filters, setFilters] = useState<FlightFilterState>(emptyFlightFilters())

  const flights = useMemo(() => onlyFlights(rankedOptions), [rankedOptions])
  const airlines = useMemo(() => uniqueAirlines(flights), [flights])
  const maxPriceCeiling = useMemo(
    () => Math.max(0, ...flights.map((f) => f.price), 0),
    [flights],
  )

  const visible = useMemo(
    () => sortFlights(filterFlights(flights, filters), sortKey),
    [flights, filters, sortKey],
  )

  const summary = useMemo(
    () => buildFlightRecommendationSummary({
      options: flights,
      searchRequest,
      locale,
    }),
    [flights, searchRequest, locale],
  )

  if (flights.length === 0) {
    return (
      <div className="space-y-4">
        <FlightRecommendationBanner summary={summary} />
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {locale === 'ar' ? 'لا توجد رحلات لعرضها.' : 'No flights to display.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <FlightRecommendationBanner summary={summary} />
      <FlightSortBar value={sortKey} locale={locale} onChange={setSortKey} />
      <FlightFiltersBar
        filters={filters}
        airlines={airlines}
        maxPriceCeiling={maxPriceCeiling || 10000}
        locale={locale}
        onChange={setFilters}
      />
      <p className="text-xs font-medium text-slate-500">
        {locale === 'ar'
          ? `عرض ${visible.length} من ${flights.length}`
          : `Showing ${visible.length} of ${flights.length}`}
      </p>
      <div className="space-y-3">
        {visible.map((option) => {
          const view = toFlightResultViewModel(option)
          return (
            <FlightResultCard
              key={option.id}
              view={view}
              locale={locale}
              selecting={selectingId === option.id}
              onSelect={() => onSelectFlight(option)}
              onDetails={() => onOpenDetails(option)}
            />
          )
        })}
      </div>
      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {locale === 'ar'
            ? 'لا توجد رحلات تطابق عوامل التصفية.'
            : 'No flights match these filters.'}
        </div>
      )}
    </div>
  )
}
