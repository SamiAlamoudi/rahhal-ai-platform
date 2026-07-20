import { memo } from 'react'
import type { HotelCardModel } from '../../../../lib/chat/conversationExperienceUi'
import MapPreview from '../MapPreview'

interface Props {
  card: HotelCardModel
  onBook?: () => void
  busy?: boolean
}

function HotelTravelCardImpl({ card, onBook, busy }: Props) {
  return (
    <article
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-label={`Hotel ${card.name}`}
    >
      <div className="flex h-28 items-end bg-gradient-to-br from-primary-600 to-primary-900 px-4 py-3 text-white">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-primary-100">Hotel</p>
          <h3 className="text-sm font-bold">{card.name}</h3>
          <p className="text-xs text-primary-100">{card.area} · {'★'.repeat(Math.max(1, Math.min(5, card.stars)))}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-300">{card.reviewsLabel}</span>
          <span className="font-bold text-primary-700 dark:text-primary-300">{card.price} {card.currency}/night</span>
        </div>
        <MapPreview kind="hotel" query={card.mapQuery} label={card.name} compact />
        <ul className="flex flex-wrap gap-1.5 text-[11px]">
          {card.roomTypes.map((room) => (
            <li key={room} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{room}</li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
          <div><dt className="text-slate-400">Breakfast</dt><dd>{card.breakfast}</dd></div>
          <div><dt className="text-slate-400">Cancel</dt><dd>{card.cancellationPolicy}</dd></div>
          <div><dt className="text-slate-400">Refund</dt><dd>{card.refundPolicy}</dd></div>
          <div><dt className="text-slate-400">Loyalty</dt><dd>{card.loyaltyRewards}</dd></div>
        </dl>
        {onBook && (
          <button
            type="button"
            disabled={busy}
            onClick={onBook}
            className="w-full rounded-xl bg-primary-600 px-3 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Book
          </button>
        )}
      </div>
    </article>
  )
}

export const HotelTravelCard = memo(HotelTravelCardImpl)
