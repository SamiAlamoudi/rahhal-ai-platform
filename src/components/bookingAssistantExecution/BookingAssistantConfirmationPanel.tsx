import type { BookingConfirmationModel } from '../../core'

function money(amount: number | null | undefined, currency: string): string | null {
  if (amount == null || !Number.isFinite(amount)) return null
  return `${amount.toLocaleString('en-US')} ${currency}`
}

export interface BookingAssistantConfirmationPanelProps {
  model: BookingConfirmationModel
  onDownload?: () => void
  onShare?: () => void
  className?: string
}

/**
 * Sprint 102 — confirmation presentation with reference, PNR placeholder, actions.
 */
export function BookingAssistantConfirmationPanel({
  model,
  onDownload,
  onShare,
  className = '',
}: BookingAssistantConfirmationPanelProps) {
  return (
    <div
      data-testid="booking-assistant-confirmation-panel"
      className={`space-y-6 ${className}`}
    >
      <header className="space-y-2">
        <p
          data-testid="booking-assistant-lifecycle"
          className="text-xs font-semibold uppercase tracking-wide text-teal-800"
        >
          {model.lifecycle.status}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Booking confirmation</h1>
        {model.bookingReference && (
          <p data-testid="booking-assistant-reference" className="text-sm text-slate-700">
            Reference: <span className="font-semibold">{model.bookingReference}</span>
          </p>
        )}
        {model.pnrPlaceholder && (
          <p data-testid="booking-assistant-pnr" className="text-sm text-slate-600">
            PNR: <span className="font-mono">{model.pnrPlaceholder}</span>
          </p>
        )}
      </header>

      {model.itinerary && (
        <section data-testid="booking-assistant-confirmation-itinerary" className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Itinerary</h2>
          <ul className="space-y-1 text-sm text-slate-700">
            {model.itinerary.destination && <li>Destination: {model.itinerary.destination}</li>}
            {model.itinerary.flightLabel && <li>Flight: {model.itinerary.flightLabel}</li>}
            {model.itinerary.hotelLabel && <li>Hotel: {model.itinerary.hotelLabel}</li>}
            {model.itinerary.packageLabel && <li>Package: {model.itinerary.packageLabel}</li>}
          </ul>
        </section>
      )}

      {model.pricing?.total != null && (
        <p data-testid="booking-assistant-confirmation-total" className="text-sm font-semibold text-slate-900">
          Total: {money(model.pricing.total, model.pricing.currency)}
        </p>
      )}

      {(model.actions.canDownload || model.actions.canShare) && (
        <div className="flex flex-wrap gap-3">
          {model.actions.canDownload && onDownload && (
            <button
              type="button"
              data-testid="booking-assistant-download"
              onClick={onDownload}
              className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900"
            >
              {model.actions.downloadLabel}
            </button>
          )}
          {model.actions.canShare && onShare && (
            <button
              type="button"
              data-testid="booking-assistant-share"
              onClick={onShare}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              {model.actions.shareLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
