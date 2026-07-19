import type { BookingFlowReviewModel, BookingFlowSectionId } from '../../lib/bookingFlow'
import type { BookingItem } from '../../lib/booking/bookingTypes'

export interface BookingFlowReviewProps {
  model: BookingFlowReviewModel
  onEditSection?: (sectionId: BookingFlowSectionId) => void
  onRemoveItem?: (itemId: string) => void
  onContinuePayment?: () => void
  onBack?: () => void
  className?: string
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString('en-US')} ${currency}`
}

/**
 * Sprint 25 — sectioned booking review (presentational).
 * Business rules live in BookingFlowController / BookingOrchestrator.
 */
export function BookingFlowReview({
  model,
  onEditSection,
  onRemoveItem,
  onContinuePayment,
  onBack,
  className = '',
}: BookingFlowReviewProps) {
  const itemSections = model.sections.filter((s) =>
    ['flights', 'hotels', 'transport', 'activities', 'packages', 'travelers', 'dates'].includes(
      s.id,
    ),
  )

  return (
    <div
      data-testid="booking-flow-review"
      className={`space-y-4 ${className}`}
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Booking review</h2>
          <p className="text-[11px] text-slate-500" data-testid="booking-flow-stage">
            Stage: {model.stage}
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            data-testid="booking-flow-back"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Back
          </button>
        )}
      </header>

      {itemSections.map((section) => (
        <section
          key={section.id}
          data-testid={`booking-flow-section-${section.id}`}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
            {section.editable && onEditSection && (
              <button
                type="button"
                onClick={() => onEditSection(section.id)}
                data-testid={`booking-flow-edit-${section.id}`}
                className="text-[11px] font-medium text-primary-600 hover:text-primary-700"
              >
                Edit
              </button>
            )}
          </div>
          {section.items.length > 0 ? (
            <ul className="space-y-2">
              {section.items.map((item: BookingItem) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 text-sm"
                  data-testid={`booking-flow-item-${item.id}`}
                >
                  <div>
                    <p className="font-medium text-slate-800">{item.title}</p>
                    <p className="text-[11px] text-slate-500">{item.providerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      {formatPrice(item.price, item.currency)}
                    </p>
                    {onRemoveItem && (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="mt-1 text-[10px] text-rose-500 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">
              {section.summaryLine ?? section.emptyLabel}
            </p>
          )}
        </section>
      ))}

      <section
        data-testid="booking-flow-price-summary"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h3 className="mb-2 text-sm font-bold text-slate-900">Price summary</h3>
        <div className="space-y-1 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>
              {formatPrice(model.priceSummary.subtotal, model.priceSummary.currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Fees</span>
            <span>
              {formatPrice(model.priceSummary.fees, model.priceSummary.currency)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900">
            <span>Total</span>
            <span>
              {formatPrice(model.priceSummary.total, model.priceSummary.currency)}
            </span>
          </div>
        </div>
      </section>

      <section
        data-testid="booking-flow-budget"
        className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
      >
        <p className="font-semibold text-slate-800">Budget comparison</p>
        <p className="mt-1 text-xs">{model.budgetComparison.label}</p>
      </section>

      {model.warnings.length > 0 && (
        <section
          data-testid="booking-flow-warnings"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <p className="mb-1 text-sm font-medium text-amber-800">Warnings</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-700">
            {model.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {onContinuePayment && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onContinuePayment}
            disabled={!model.readyForPayment}
            data-testid="booking-flow-ready-payment"
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Ready for payment
          </button>
        </div>
      )}
    </div>
  )
}
