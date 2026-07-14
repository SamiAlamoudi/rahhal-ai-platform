import { useMemo } from 'react'
import { getBookingOrchestrator } from '../lib/booking'
import { BOOKING_MODE_VALUES } from '../lib/booking/bookingTypes'
import type { BookingCapabilities } from '../lib/booking/bookingCapabilities'
import {
  redirectWithCancellationCapabilities,
  defaultBookingCapabilities,
} from '../lib/booking/bookingCapabilities'
import { getProviderRegistry } from '../integrations/registry'

function assessProviderBookingCapabilities(
  adapter: string,
  hasBookingUrl: boolean,
): BookingCapabilities {
  if (adapter === 'mock') {
    return defaultBookingCapabilities()
  }
  if (hasBookingUrl) {
    return redirectWithCancellationCapabilities()
  }
  return defaultBookingCapabilities()
}

const MODE_LABELS: Record<string, string> = {
  redirect: 'تحويل',
  embedded: 'مضمّن',
  merchant: 'تاجر',
}

export function BookingDiagnosticsSection() {
  const orchestrator = useMemo(() => getBookingOrchestrator(), [])
  const registry = useMemo(() => getProviderRegistry(), [])
  const sessions = useMemo(() => orchestrator.getAllSessions(), [orchestrator])
  const lastError = orchestrator.getLastError()

  const allProviders = registry.listAll()
  const redirectCapable = allProviders.filter(e =>
    assessProviderBookingCapabilities(e.adapterType, true).supportsRedirect,
  )
  const embeddedCapable = allProviders.filter(e =>
    assessProviderBookingCapabilities(e.adapterType, true).supportsEmbeddedCheckout,
  )
  const merchantCapable = allProviders.filter(e =>
    assessProviderBookingCapabilities(e.adapterType, true).supportsMerchantBooking,
  )

  const redirectedSessions = sessions.filter(s => s.status === 'redirected' || s.status === 'pending_provider_confirmation')
  const pendingConfirmations = sessions.filter(s => s.status === 'pending_provider_confirmation')

  return (
    <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900 mb-4">إعدادات الحجز</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-bold text-slate-500 mb-2">أوضاع الحجز المتاحة</h3>
          <div className="flex flex-wrap gap-2">
            {BOOKING_MODE_VALUES.map(mode => (
              <span
                key={mode}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  mode === 'redirect'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400 line-through'
                }`}
              >
                {MODE_LABELS[mode] ?? mode}
                {mode === 'redirect' && ' (مفعّل)'}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-500 mb-2">الوضع الافتراضي</h3>
          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-700">
            تحويل (redirect)
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{redirectCapable.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">مزودو التحويل</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-300">{embeddedCapable.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">مزودو الإدماج</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-300">{merchantCapable.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">مزودو الدفع المباشر</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{sessions.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">جلسات الحجز</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{redirectedSessions.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">جلسات محوّلة</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{pendingConfirmations.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">بانتظار التأكيد</p>
        </div>
      </div>

      {lastError && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2">
          <p className="text-xs text-rose-700">
            آخر خطأ: <span dir="ltr">{lastError}</span>
          </p>
        </div>
      )}
    </div>
  )
}
