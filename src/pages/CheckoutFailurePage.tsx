import { useState, useMemo } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { getDefaultPaymentProvider, getCheckoutOrchestrator } from '../lib/payment'

interface FailureLocationState {
  orderId: string
  lockToken: string
  message: string
}

export default function CheckoutFailurePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as FailureLocationState | null

  const [retrying, setRetrying] = useState(false)
  const [retryMessage, setRetryMessage] = useState<string | null>(null)

  const provider = useMemo(() => getDefaultPaymentProvider(), [])
  const orchestrator = useMemo(() => getCheckoutOrchestrator(provider), [provider])

  if (!state) {
    return <Navigate to="/my-trips" replace />
  }

  // Allow failure UI when order id is unknown (e.g. return callback lost session).
  const orderId = state.orderId || ''
  const lockToken = state.lockToken || ''

  const handleRetry = async () => {
    if (!orderId) {
      navigate('/my-trips')
      return
    }
    setRetrying(true)
    setRetryMessage(null)
    try {
      const result = await orchestrator.retryPayment(orderId)
      if (result.success) {
        navigate('/checkout/payment', {
          state: {
            checkoutSession: {
              order: result.order,
              cart: result.order!.cart,
              lockToken: null,
              paymentSession: null,
            },
            items: result.order!.cart.items,
            currency: result.order!.cart.currency,
            travelers: result.order!.travelers,
          },
        })
      } else {
        setRetryMessage(result.message)
      }
    } catch (e) {
      setRetryMessage(e instanceof Error ? e.message : 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  const handleCancel = async () => {
    if (orderId && lockToken) {
      await orchestrator.cancelCheckout(orderId, lockToken)
    }
    navigate('/my-trips')
  }

  const handleRecover = async () => {
    if (!orderId) {
      navigate('/my-trips')
      return
    }
    const result = await orchestrator.recoverAbandonedCheckout(orderId)
    if (result.success) {
      navigate('/checkout/payment', {
        state: {
          checkoutSession: {
            order: result.order,
            cart: result.order!.cart,
            lockToken: null,
            paymentSession: null,
          },
          items: result.order!.cart.items,
          currency: result.order!.cart.currency,
          travelers: result.order!.travelers,
        },
      })
    } else {
      setRetryMessage(result.message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/30 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-base font-bold text-slate-900">فشل الدفع</h1>
            {orderId ? (
              <p className="text-[10px] text-slate-400">{orderId.slice(0, 12)}</p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {/* Error banner */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-rose-800">لم تكتمل عملية الدفع</h2>
          <p className="mt-1 text-sm text-rose-700">{state.message}</p>
        </div>

        {retryMessage && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {retryMessage}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          {orderId ? (
            <>
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="w-full rounded-xl bg-primary-600 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:bg-slate-300"
              >
                {retrying ? 'جاري إعادة المحاولة...' : 'إعادة محاولة الدفع'}
              </button>
              <button
                type="button"
                onClick={handleRecover}
                className="w-full rounded-xl border border-slate-200 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                استرجاع الطلب المتروك
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="w-full rounded-xl border border-rose-200 py-3.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
              >
                إلغاء الطلب
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/my-trips')}
              className="w-full rounded-xl bg-primary-600 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              العودة إلى رحلاتي
            </button>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-xs text-sky-800">
            يمكنك إعادة المحاولة أو استرجاع الطلب لاحقاً من صفحة "رحلاتي".
          </p>
        </div>
      </main>
    </div>
  )
}
