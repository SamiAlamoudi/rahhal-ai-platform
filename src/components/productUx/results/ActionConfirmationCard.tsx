import { productCopy, type ActionConfirmationView, type ProductLocale } from '../../../lib/productUx'

export interface ActionConfirmationCardProps {
  confirmation: ActionConfirmationView
  locale?: ProductLocale
  onConfirm?: () => void
  onCancel?: () => void
  busy?: boolean
}

export function ActionConfirmationCard({
  confirmation,
  locale = 'ar',
  onConfirm,
  onCancel,
  busy,
}: ActionConfirmationCardProps) {
  return (
    <section
      data-testid="action-confirmation-card"
      role="dialog"
      aria-modal="false"
      aria-label={confirmation.title}
      className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm"
    >
      <h3 className="text-sm font-bold text-slate-900">{confirmation.title}</h3>
      <p className="mt-1 text-[11px] font-medium text-amber-800">
        {locale === 'ar'
          ? 'معاينة فقط — لا يتم تنفيذ حجز أو دفع حي.'
          : 'Preview only — no live booking or payment is executed.'}
      </p>
      <dl className="mt-3 space-y-2 text-xs text-slate-700">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">{locale === 'ar' ? 'الخيار' : 'Option'}</dt>
          <dd className="text-end font-semibold">{confirmation.selectedOption}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">{locale === 'ar' ? 'المسافرون' : 'Travelers'}</dt>
          <dd className="text-end">{confirmation.travelers}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">{locale === 'ar' ? 'التواريخ' : 'Dates'}</dt>
          <dd className="text-end">{confirmation.dates}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">{locale === 'ar' ? 'المبلغ' : 'Total'}</dt>
          <dd className="text-end font-bold text-primary-700">{confirmation.totalAmount}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{locale === 'ar' ? 'الإلغاء' : 'Cancellation'}</dt>
          <dd className="mt-0.5 leading-relaxed">{confirmation.cancellationTerms}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {onCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {productCopy(locale, 'cancelAction')}
          </button>
        ) : null}
        {onConfirm ? (
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {productCopy(locale, 'confirmAction')}
          </button>
        ) : null}
      </div>
    </section>
  )
}
