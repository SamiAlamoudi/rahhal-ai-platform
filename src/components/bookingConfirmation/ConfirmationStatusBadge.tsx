import type { ConfirmationStatus } from '../../lib/bookingConfirmation'

const STYLES: Record<ConfirmationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirming: 'bg-sky-100 text-sky-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

const LABELS: Record<ConfirmationStatus, { ar: string; en: string }> = {
  pending: { ar: 'معلق', en: 'Pending' },
  confirming: { ar: 'جاري التأكيد', en: 'Confirming' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  failed: { ar: 'فشل', en: 'Failed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

export function ConfirmationStatusBadge({
  status,
  locale = 'en',
}: {
  status: ConfirmationStatus
  locale?: 'ar' | 'en'
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STYLES[status]}`}
      data-testid="confirmation-status"
    >
      {LABELS[status][locale]}
    </span>
  )
}
