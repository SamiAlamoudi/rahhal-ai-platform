import type {
  BookingCancellationPolicy,
  BookingItinerarySummary,
  BookingPriceBreakdown,
  BookingReviewModel,
} from '../../core'

function money(amount: number | null | undefined, currency: string): string | null {
  if (amount == null || !Number.isFinite(amount)) return null
  return `${amount.toLocaleString('en-US')} ${currency}`
}

export interface BookingAssistantReviewPanelProps {
  model: BookingReviewModel
  className?: string
}

/**
 * Sprint 102 — booking review presentation (itinerary, pricing, policy).
 * Hides missing sections; no empty placeholders.
 */
export function BookingAssistantReviewPanel({
  model,
  className = '',
}: BookingAssistantReviewPanelProps) {
  return (
    <div
      data-testid="booking-assistant-review-panel"
      className={`space-y-6 ${className}`}
    >
      {model.itinerary && (
        <ItineraryBlock itinerary={model.itinerary} />
      )}
      {model.pricing && (
        <PricingBlock pricing={model.pricing} />
      )}
      {model.cancellationPolicy && (
        <PolicyBlock policy={model.cancellationPolicy} />
      )}
    </div>
  )
}

function ItineraryBlock({ itinerary }: { itinerary: BookingItinerarySummary }) {
  const rows = [
    itinerary.origin && itinerary.destination
      ? { label: 'Route', value: `${itinerary.origin} → ${itinerary.destination}` }
      : itinerary.destination
        ? { label: 'Destination', value: itinerary.destination }
        : null,
    itinerary.startDate
      ? {
        label: 'Dates',
        value: itinerary.endDate
          ? `${itinerary.startDate} – ${itinerary.endDate}`
          : itinerary.startDate,
      }
      : null,
    itinerary.flightLabel ? { label: 'Flight', value: itinerary.flightLabel } : null,
    itinerary.hotelLabel ? { label: 'Hotel', value: itinerary.hotelLabel } : null,
    itinerary.packageLabel ? { label: 'Package', value: itinerary.packageLabel } : null,
    itinerary.travelerCount != null
      ? { label: 'Travelers', value: String(itinerary.travelerCount) }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>

  if (rows.length === 0) return null

  return (
    <section data-testid="booking-assistant-itinerary" className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Itinerary summary</h2>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs uppercase tracking-wide text-slate-500">{row.label}</dt>
            <dd className="text-sm font-medium text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function PricingBlock({ pricing }: { pricing: BookingPriceBreakdown }) {
  const rows = [
    money(pricing.baseFare, pricing.currency)
      ? { label: 'Base fare', value: money(pricing.baseFare, pricing.currency)! }
      : null,
    money(pricing.taxes, pricing.currency)
      ? { label: 'Taxes', value: money(pricing.taxes, pricing.currency)! }
      : null,
    money(pricing.fees, pricing.currency)
      ? { label: 'Fees', value: money(pricing.fees, pricing.currency)! }
      : null,
    money(pricing.savings, pricing.currency)
      ? { label: 'Savings', value: money(pricing.savings, pricing.currency)! }
      : null,
    money(pricing.total, pricing.currency)
      ? { label: 'Total', value: money(pricing.total, pricing.currency)! }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>

  if (rows.length === 0) return null

  return (
    <section data-testid="booking-assistant-pricing" className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Pricing</h2>
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className={`text-sm ${row.label === 'Total' ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
              {row.label}
            </dt>
            <dd className={`text-sm ${row.label === 'Total' ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function PolicyBlock({ policy }: { policy: BookingCancellationPolicy }) {
  return (
    <section data-testid="booking-assistant-cancellation" className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">Cancellation policy</h2>
      {policy.refundable != null && (
        <p className="text-sm text-slate-700">
          {policy.refundable ? 'Refundable' : 'Non-refundable'}
        </p>
      )}
      {policy.summary && (
        <p className="text-sm text-slate-600">{policy.summary}</p>
      )}
      {policy.deadline && (
        <p className="text-xs text-slate-500">Deadline: {policy.deadline}</p>
      )}
    </section>
  )
}
