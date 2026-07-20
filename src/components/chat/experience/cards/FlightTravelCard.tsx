import { memo } from 'react'
import type { FlightCardModel } from '../../../../lib/chat/conversationExperienceUi'

interface Props {
  card: FlightCardModel
  onBook?: () => void
  busy?: boolean
}

function FlightTravelCardImpl({ card, onBook, busy }: Props) {
  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-label={`Flight ${card.airline} ${card.departure} to ${card.arrival}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold text-white"
            aria-hidden
          >
            {card.logoLabel}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{card.airline}</h3>
            <p className="text-xs text-slate-500">{card.fareFamily}</p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-base font-bold text-primary-700 dark:text-primary-300">
            {card.price} {card.currency}
          </p>
          <p className="text-[11px] text-slate-500">+{card.loyaltyPoints} pts</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{card.departure}</p>
          <p className="text-slate-400">DEP</p>
        </div>
        <div>
          <p className="font-medium text-slate-600 dark:text-slate-300">{card.durationLabel}</p>
          <p className="text-slate-400">{card.stops === 0 ? 'Direct' : `${card.stops} stop`}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{card.arrival}</p>
          <p className="text-slate-400">ARR</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <div><dt className="text-slate-400">Baggage</dt><dd>{card.baggage}</dd></div>
        <div><dt className="text-slate-400">Refund</dt><dd>{card.refundPolicy}</dd></div>
        <div><dt className="text-slate-400">Change</dt><dd>{card.changePolicy}</dd></div>
        <div><dt className="text-slate-400">Fare</dt><dd>{card.fareFamily}</dd></div>
      </dl>
      {onBook && (
        <button
          type="button"
          disabled={busy}
          onClick={onBook}
          className="mt-3 w-full rounded-xl bg-primary-600 px-3 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Book
        </button>
      )}
    </article>
  )
}

export const FlightTravelCard = memo(FlightTravelCardImpl)
