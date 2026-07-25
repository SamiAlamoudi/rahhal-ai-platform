import { useState } from 'react'
import { productCopy, type HotelResultView, type ProductLocale } from '../../../lib/productUx'

export interface HotelResultCardProps {
  hotel: HotelResultView
  locale?: ProductLocale
  onSelect?: (id: string) => void
}

export function HotelResultCard({ hotel, locale = 'ar', onSelect }: HotelResultCardProps) {
  const [open, setOpen] = useState(false)
  const showImage =
    hotel.imageUrl && !hotel.imageUrl.startsWith('hotel:') ? hotel.imageUrl : null

  return (
    <article
      data-testid={`hotel-result-${hotel.id}`}
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
      aria-label={hotel.name}
    >
      <div className="relative h-28 bg-gradient-to-br from-primary-600 to-primary-900 px-4 py-3 text-white">
        {showImage ? (
          <img
            src={showImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
            loading="lazy"
          />
        ) : null}
        <div className="relative">
          <h3 className="text-sm font-bold">{hotel.name}</h3>
          <p className="text-xs text-primary-100">
            {hotel.area}
            {hotel.rating != null ? ` · ${hotel.rating}` : ''}
          </p>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs leading-relaxed text-slate-600">{hotel.reason}</p>
          <p className="shrink-0 text-sm font-bold text-primary-700">
            {hotel.totalPrice} {hotel.currency}
          </p>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {hotel.roomType} · {hotel.mealPlan}
        </p>
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
              onClick={() => onSelect(hotel.id)}
            >
              {productCopy(locale, 'selectOption')}
            </button>
          ) : null}
        </div>
        {open ? (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
            <p>
              <span className="text-slate-400">
                {locale === 'ar' ? 'الإلغاء: ' : 'Cancellation: '}
              </span>
              {hotel.cancellation}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {hotel.amenities.map((a) => (
                <li key={a} className="rounded-full bg-slate-100 px-2 py-0.5">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  )
}
