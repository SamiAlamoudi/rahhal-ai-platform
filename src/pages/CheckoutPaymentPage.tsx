import { useState, useMemo } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { getDefaultPaymentProvider, getCheckoutOrchestrator } from '../lib/payment'
import {
  buildCheckoutReturnUrl,
  isHostedMoyasarPaymentUrl,
  saveCheckoutReturnContext,
} from '../lib/payment/moyasarCheckout'
import type { CheckoutItem, TravelerInfo } from '../lib/payment/checkoutTypes'
import type { CheckoutSession } from '../lib/payment/checkoutOrchestrator'

interface PaymentLocationState {
  checkoutSession: CheckoutSession
  items: CheckoutItem[]
  currency: string
  travelers: TravelerInfo[]
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString('en-US')} ${currency}`
}

export default function CheckoutPaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as PaymentLocationState | null

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const provider = useMemo(() => getDefaultPaymentProvider(), [])
  const orchestrator = useMemo(() => getCheckoutOrchestrator(provider), [provider])

  if (!state?.checkoutSession?.order) {
    return <Navigate to="/checkout" replace />
  }

  const { order, lockToken } = state.checkoutSession
  const cart = state.checkoutSession.cart

  const handlePay = async () => {
    if (!lockToken) {
      setError('Lock token missing — cannot proceed with payment')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const returnUrl = buildCheckoutReturnUrl(window.location.origin, order.id)
      const traveler = state.travelers[0]
      const customerName = traveler
        ? `${traveler.firstName} ${traveler.lastName}`.trim()
        : null

      const sessionResult = await orchestrator.createPaymentSession(
        order.id,
        null,
        customerName,
        returnUrl,
      )

      if (!sessionResult.success || !sessionResult.paymentSession) {
        setError(sessionResult.message || 'Failed to create payment session')
        setProcessing(false)
        return
      }

      const redirectUrl = sessionResult.paymentSession.redirectUrl
      if (!redirectUrl) {
        setError('Payment provider did not return a hosted payment URL')
        setProcessing(false)
        navigate('/checkout/failure', {
          state: {
            orderId: order.id,
            lockToken,
            message: 'Missing hosted payment URL',
          },
        })
        return
      }

      // Production Moyasar path: only redirect to verified *.moyasar.com URLs.
      if (provider.providerId === 'moyasar' && !isHostedMoyasarPaymentUrl(redirectUrl)) {
        setError('Payment provider returned an invalid Moyasar hosted URL')
        setProcessing(false)
        navigate('/checkout/failure', {
          state: {
            orderId: order.id,
            lockToken,
            message: 'Invalid Moyasar payment URL',
          },
        })
        return
      }

      saveCheckoutReturnContext({
        orderId: order.id,
        lockToken,
        paymentSessionId: sessionResult.paymentSession.id,
      })

      // Hosted checkout — leave Bilamo; Moyasar (or mock returnUrl) collects payment.
      window.location.assign(redirectUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment processing failed')
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={processing}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              aria-label="رجوع"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900" data-testid="payment-ready">الدفع</h1>
              <p className="text-[10px] text-slate-400">{order.orderNumber}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">ملخص الدفع</h2>
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
            <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-slate-900">
              <span>المبلغ المستحق</span>
              <span>{formatPrice(cart.total, cart.currency)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-3">طريقة الدفع</h2>
          <p className="text-sm text-slate-600">
            سيتم تحويلك إلى صفحة الدفع الآمنة لدى Moyasar لإدخال بيانات البطاقة.
          </p>
          <p className="mt-3 text-[10px] text-slate-400">
            الدفع الآمن عبر بوابة Moyasar. لا يتم تخزين بيانات البطاقة في بيلامو.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-xs text-sky-800">
            يتم حماية عملية الدفع بقفل آلي لمنع الدفع المكرر أو إعادة الإرسال.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePay}
          disabled={processing}
          className="mt-6 w-full rounded-xl bg-primary-600 py-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              جاري التحويل إلى Moyasar...
            </span>
          ) : (
            `ادفع ${formatPrice(cart.total, cart.currency)}`
          )}
        </button>
      </main>
    </div>
  )
}
