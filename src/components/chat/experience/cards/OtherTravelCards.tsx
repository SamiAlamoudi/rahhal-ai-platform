import { memo } from 'react'
import type {
  ActivityCardModel,
  CarCardModel,
  InsuranceCardModel,
  VisaCardModel,
} from '../../../../lib/chat/conversationExperienceUi'
import MapPreview from '../MapPreview'

export const CarTravelCard = memo(function CarTravelCard({
  card,
  onBook,
  busy,
}: {
  card: CarCardModel
  onBook?: () => void
  busy?: boolean
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label={`Car ${card.vehicleLabel}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase text-slate-400">Car</p>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{card.vehicleLabel}</h3>
          <p className="text-xs text-slate-500">{card.supplier}</p>
        </div>
        <div className="flex h-12 w-16 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800">{card.imageLabel}</div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <div><dt className="text-slate-400">Insurance</dt><dd>{card.insurance}</dd></div>
        <div><dt className="text-slate-400">Mileage</dt><dd>{card.mileage}</dd></div>
        <div><dt className="text-slate-400">Fuel</dt><dd>{card.fuelPolicy}</dd></div>
        <div><dt className="text-slate-400">Cancel</dt><dd>{card.cancellation}</dd></div>
        <div><dt className="text-slate-400">Pickup</dt><dd>{card.pickup}</dd></div>
        <div><dt className="text-slate-400">Return</dt><dd>{card.dropoff}</dd></div>
      </dl>
      <MapPreview kind="car_pickup" query={card.pickup} label={card.pickup} compact />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm font-bold text-primary-700 dark:text-primary-300">{card.price} {card.currency}</p>
        {onBook && (
          <button type="button" disabled={busy} onClick={onBook} className="rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            Reserve
          </button>
        )}
      </div>
    </article>
  )
})

export const ActivityTravelCard = memo(function ActivityTravelCard({
  card,
  onReserve,
  busy,
}: {
  card: ActivityCardModel
  onReserve?: () => void
  busy?: boolean
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label={`Activity ${card.title}`}>
      <p className="text-[10px] uppercase text-slate-400">Activity</p>
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{card.title}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <div><dt className="text-slate-400">Duration</dt><dd>{card.duration}</dd></div>
        <div><dt className="text-slate-400">Availability</dt><dd>{card.availability}</dd></div>
        <div className="col-span-2"><dt className="text-slate-400">Refund</dt><dd>{card.refundRules}</dd></div>
      </dl>
      <MapPreview kind="activity" query={card.locationQuery} label={card.title} compact />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">{card.priceLabel}</p>
        {onReserve && (
          <button type="button" disabled={busy} onClick={onReserve} className="rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            Reserve
          </button>
        )}
      </div>
    </article>
  )
})

export const VisaTravelCard = memo(function VisaTravelCard({
  card,
  onAction,
}: {
  card: VisaCardModel
  onAction?: () => void
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Visa requirements">
      <p className="text-[10px] uppercase text-slate-400">Visa</p>
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{card.status}</h3>
      <ul className="mt-2 list-disc ps-4 text-[11px] text-slate-600 dark:text-slate-300">
        {card.requiredDocuments.map((doc) => <li key={doc}>{doc}</li>)}
      </ul>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <div><dt className="text-slate-400">Processing</dt><dd>{card.processingTime}</dd></div>
        <div><dt className="text-slate-400">Passport</dt><dd>{card.passportValidity}</dd></div>
        <div className="col-span-2"><dt className="text-slate-400">Approval</dt><dd>{card.estimatedApproval}</dd></div>
      </dl>
      {onAction && (
        <button type="button" onClick={onAction} className="mt-3 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200">
          Review visa
        </button>
      )}
    </article>
  )
})

export const InsuranceTravelCard = memo(function InsuranceTravelCard({
  card,
  onPurchase,
}: {
  card: InsuranceCardModel
  onPurchase?: () => void
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Travel insurance">
      <p className="text-[10px] uppercase text-slate-400">Insurance</p>
      <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{card.coverageSummary}</h3>
      <p className="mt-2 text-[11px] text-slate-500">Exclusions</p>
      <ul className="list-disc ps-4 text-[11px] text-slate-600 dark:text-slate-300">
        {card.exclusions.map((row) => <li key={row}>{row}</li>)}
      </ul>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <div><dt className="text-slate-400">Cancellation</dt><dd>{card.cancellation}</dd></div>
        <div><dt className="text-slate-400">Emergency</dt><dd>{card.emergencyAssistance}</dd></div>
      </dl>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">{card.priceLabel}</p>
        {onPurchase && (
          <button type="button" onClick={onPurchase} className="rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white">
            Purchase
          </button>
        )}
      </div>
    </article>
  )
})
