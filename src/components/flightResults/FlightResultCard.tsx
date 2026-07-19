import { useState } from 'react'
import type { FlightResultViewModel } from '../../lib/flightResults'
import {
  formatFlightDuration,
  formatFlightTime,
  stopsLabel,
} from '../../lib/flightResults'

export interface FlightResultCardProps {
  view: FlightResultViewModel
  locale?: 'ar' | 'en'
  onSelect: (id: string) => void
  onDetails: (id: string) => void
  selecting?: boolean
}

export function FlightResultCard({
  view,
  locale = 'en',
  onSelect,
  onDetails,
  selecting = false,
}: FlightResultCardProps) {
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:border-slate-200 hover:shadow-md">
      <div className="flex items-stretch">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-e border-slate-50 bg-slate-50/60 sm:w-20">
          {view.logoUrl && !logoFailed ? (
            <img
              src={view.logoUrl}
              alt={view.airlineName}
              className="h-9 w-9 rounded-lg object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white">
              {view.airlineCode}
            </div>
          )}
          <span className="hidden max-w-[4.5rem] truncate px-1 text-center text-[9px] font-medium text-slate-500 sm:block">
            {view.airlineName}
          </span>
        </div>

        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{view.airlineName}</p>
              <p className="mt-0.5 text-[11px] capitalize text-slate-500">
                {locale === 'ar' ? 'الدرجة:' : 'Cabin:'} {view.cabin}
              </p>
            </div>
            <div className="shrink-0 text-end">
              <p className="text-base font-bold text-primary-600">
                {view.price.toLocaleString()} {view.currency}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs">
            <div className="flex min-w-[3.5rem] flex-col items-center">
              <span className="font-bold text-slate-800">{formatFlightTime(view.departureTime)}</span>
              <span className="text-[10px] font-semibold text-slate-500">{view.origin}</span>
            </div>
            <div className="flex flex-1 flex-col items-center px-1">
              <span className="text-[10px] font-medium text-slate-500">
                {formatFlightDuration(view.durationMinutes)}
              </span>
              <div className="my-0.5 h-px w-full bg-slate-200" />
              <span className="text-[10px] text-slate-400">{stopsLabel(view.stops, locale)}</span>
            </div>
            <div className="flex min-w-[3.5rem] flex-col items-center">
              <span className="font-bold text-slate-800">{formatFlightTime(view.arrivalTime)}</span>
              <span className="text-[10px] font-semibold text-slate-500">{view.destination}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(view.id)}
              disabled={selecting}
              className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              {selecting
                ? (locale === 'ar' ? 'جاري التحديد…' : 'Selecting…')
                : (locale === 'ar' ? 'اختيار الرحلة' : 'Select Flight')}
            </button>
            <button
              type="button"
              onClick={() => onDetails(view.id)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              {locale === 'ar' ? 'التفاصيل' : 'Details'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
