import { useState } from 'react'
import {
  productCopy,
  type FlightCompareTag,
  type FlightResultView,
  type ProductLocale,
} from '../../../lib/productUx'

const TAG_LABEL: Record<FlightCompareTag, { ar: string; en: string }> = {
  best_value: { ar: 'أفضل قيمة', en: 'Best value' },
  fastest: { ar: 'الأسرع', en: 'Fastest' },
  cheapest: { ar: 'الأرخص', en: 'Cheapest' },
  recommended: { ar: 'موصى به', en: 'Recommended' },
}

export interface FlightResultCardProps {
  flight: FlightResultView
  locale?: ProductLocale
  onSelect?: (id: string) => void
}

export function FlightResultCard({ flight, locale = 'ar', onSelect }: FlightResultCardProps) {
  const [open, setOpen] = useState(false)
  const stopsLabel =
    flight.stops === 0
      ? locale === 'ar'
        ? 'مباشر'
        : 'Direct'
      : locale === 'ar'
        ? `${flight.stops} توقف`
        : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`

  return (
    <article
      data-testid={`flight-result-${flight.id}`}
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
      aria-label={`${flight.airline} ${flight.departure} ${flight.arrival}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{flight.airline}</h3>
            {flight.compareTag ? (
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                {TAG_LABEL[flight.compareTag][locale]}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{flight.reason}</p>
        </div>
        <p className="text-end text-base font-bold text-primary-700">
          {flight.price} {flight.currency}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="font-semibold text-slate-800">{flight.departure}</p>
          <p className="text-slate-400">{locale === 'ar' ? 'مغادرة' : 'Dep'}</p>
        </div>
        <div>
          <p className="font-medium text-slate-600">{flight.durationLabel}</p>
          <p className="text-slate-400">{stopsLabel}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-800">{flight.arrival}</p>
          <p className="text-slate-400">{locale === 'ar' ? 'وصول' : 'Arr'}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {productCopy(locale, open ? 'collapseDetails' : 'expandDetails')}
        </button>
        {onSelect ? (
          <button
            type="button"
            className="min-h-10 rounded-xl bg-primary-600 px-3 text-xs font-bold text-white hover:bg-primary-700"
            onClick={() => onSelect(flight.id)}
          >
            {productCopy(locale, 'selectOption')}
          </button>
        ) : null}
      </div>

      {open ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
          <div>
            <dt className="text-slate-400">{locale === 'ar' ? 'الأمتعة' : 'Baggage'}</dt>
            <dd>{flight.baggage ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-400">{locale === 'ar' ? 'الاسترداد' : 'Refund'}</dt>
            <dd>{flight.refundability ?? '—'}</dd>
          </div>
        </dl>
      ) : null}
    </article>
  )
}
