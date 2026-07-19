import type { BookingRecord } from '../../lib/booking'

export interface TripRecordCardProps {
  record: BookingRecord
  locale?: 'ar' | 'en'
  onOpen: (sessionId: string) => void
  onResume?: (sessionId: string) => void
  onCancel?: (sessionId: string) => void
  canResume?: boolean
  canCancel?: boolean
  busy?: boolean
}

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  draft: { ar: 'مسودة', en: 'Draft' },
  selected: { ar: 'تم الاختيار', en: 'Selected' },
  ready_to_redirect: { ar: 'جاهز للتحويل', en: 'Ready' },
  redirected: { ar: 'تم التحويل', en: 'Redirected' },
  pending_provider_confirmation: { ar: 'بانتظار التأكيد', en: 'Pending' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' },
  failed: { ar: 'فشل', en: 'Failed' },
  cancelled: { ar: 'ملغي', en: 'Cancelled' },
  expired: { ar: 'منتهي', en: 'Expired' },
}

export function TripRecordCard({
  record,
  locale = 'ar',
  onOpen,
  onResume,
  onCancel,
  canResume = false,
  canCancel = false,
  busy = false,
}: TripRecordCardProps) {
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en)
  const status = STATUS_LABELS[record.status]?.[locale] ?? record.status
  const route = record.flight
    ? `${record.flight.origin || '—'} → ${record.flight.destination || '—'}`
    : (record.itemTitles[0] ?? t('حجز', 'Booking'))

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {record.bookingReference}
          </p>
          <h3 className="mt-1 truncate text-sm font-bold text-slate-900">{route}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {record.flight?.airline || t(`${record.itemTitles.length} عنصر`, `${record.itemTitles.length} items`)}
            {' · '}
            {record.fare.grandTotal.toLocaleString()} {record.fare.currency}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {new Date(record.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
          {status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpen(record.sessionId)}
          className="rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700"
        >
          {t('التفاصيل', 'Details')}
        </button>
        {canResume && onResume && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onResume(record.sessionId)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('متابعة', 'Resume')}
          </button>
        )}
        {canCancel && onCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel(record.sessionId)}
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            {busy ? t('جاري…', '…') : t('إلغاء', 'Cancel')}
          </button>
        )}
      </div>
    </article>
  )
}
