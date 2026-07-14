import { useMemo } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import type { RahhalOrder } from '../lib/payment/checkoutTypes'
import type { Invoice } from '../lib/payment/invoiceGenerator'
import type { Itinerary } from '../lib/payment/itineraryGenerator'
import type { PaymentSession } from '../lib/payment/paymentTypes'

interface SuccessLocationState {
  order: RahhalOrder
  invoice: Invoice | null
  itinerary: Itinerary | null
  paymentSession: PaymentSession | null
}

const TYPE_ICONS: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  rental_car: '🚙',
  activity: '🎯',
  transfer: '🚗',
  insurance: '🛡️',
  esim: '📱',
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString('en-US')} ${currency}`
}

export default function CheckoutSuccessPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as SuccessLocationState | null

  const order = useMemo(() => state?.order ?? null, [state])
  const invoice = useMemo(() => state?.invoice ?? null, [state])
  const itinerary = useMemo(() => state?.itinerary ?? null, [state])

  if (!order) {
    return <Navigate to="/my-trips" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/30 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-base font-bold text-slate-900">تم الدفع بنجاح</h1>
            <p className="text-[10px] text-slate-400">{order.orderNumber}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {/* Success banner */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-emerald-800">تم تأكيد حجزك!</h2>
          <p className="mt-1 text-sm text-emerald-700">تم إصدار الفاتورة وخط سير الرحلة</p>
        </div>

        {/* Order details */}
        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">تفاصيل الطلب</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>رقم الطلب</span>
              <span className="font-mono text-xs">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>رقم الحجز</span>
              <span className="font-mono text-xs">{order.bookingNumber}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>المرجع</span>
              <span className="font-mono text-xs">{order.customerReference}</span>
            </div>
            {order.invoiceNumber && (
              <div className="flex justify-between text-slate-600">
                <span>رقم الفاتورة</span>
                <span className="font-mono text-xs">{order.invoiceNumber}</span>
              </div>
            )}
            {state?.paymentSession?.transactionId && (
              <div className="flex justify-between text-slate-600">
                <span>رقم العملية</span>
                <span className="font-mono text-xs">{state.paymentSession.transactionId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Invoice */}
        {invoice && (
          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">الفاتورة</h3>
            <div className="space-y-1.5 text-xs">
              {invoice.lines.map((line, i) => (
                <div
                  key={i}
                  className={`flex justify-between ${line.type === 'total' ? 'border-t border-slate-100 pt-1.5 font-bold text-slate-900' : 'text-slate-600'}`}
                >
                  <span>{line.label}</span>
                  <span>{formatPrice(line.amount, invoice.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Itinerary */}
        {itinerary && (
          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">خط سير الرحلة</h3>
            <div className="space-y-2">
              {itinerary.segments.map((seg, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg" aria-hidden>{TYPE_ICONS[seg.type] ?? '📋'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{seg.title}</p>
                    <p className="text-xs text-slate-500">{seg.providerName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => navigate('/my-trips')}
            className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            عرض رحلاتي
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            العودة للرئيسية
          </button>
        </div>
      </main>
    </div>
  )
}
