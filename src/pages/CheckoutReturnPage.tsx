import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getDefaultPaymentProvider, getCheckoutOrchestrator } from '../lib/payment'
import {
  chooseCheckoutOutcomeRoute,
  clearCheckoutReturnContext,
  loadCheckoutReturnContext,
  resolveOrderIdFromReturn,
  resolvePaymentIdFromReturn,
} from '../lib/payment/moyasarCheckout'
import { generateInvoice } from '../lib/payment/invoiceGenerator'
import { generateItinerary } from '../lib/payment/itineraryGenerator'

/**
 * Moyasar callback / return page.
 * Customer lands here after hosted payment; we refresh status from the provider
 * (and any webhook that already ran) then route to success or failure.
 */
export default function CheckoutReturnPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState('جاري التحقق من حالة الدفع...')

  const provider = useMemo(() => getDefaultPaymentProvider(), [])
  const orchestrator = useMemo(() => getCheckoutOrchestrator(provider), [provider])

  useEffect(() => {
    let cancelled = false

    async function reconcile() {
      const stored = loadCheckoutReturnContext()
      const orderId = resolveOrderIdFromReturn(searchParams, stored)
      const queryStatus = searchParams.get('status')
      const paymentId = resolvePaymentIdFromReturn(searchParams, stored)

      if (!orderId) {
        setMessage('تعذر تحديد الطلب بعد العودة من بوابة الدفع')
        navigate('/checkout/failure', {
          state: {
            orderId: '',
            lockToken: stored?.lockToken ?? '',
            message: 'Missing order id on payment return',
          },
          replace: true,
        })
        return
      }

      try {
        const result = await orchestrator.refreshPaymentStatus(orderId)
        if (cancelled) return

        const status = result.paymentSession?.status
          ?? queryStatus
          ?? null

        const route = chooseCheckoutOutcomeRoute(status, queryStatus)

        if (route === '/checkout/success' && result.order) {
          clearCheckoutReturnContext()
          const invoice = generateInvoice(result.order)
          const itinerary = generateItinerary(result.order)
          navigate('/checkout/success', {
            replace: true,
            state: {
              order: result.order,
              invoice,
              itinerary,
              paymentSession: result.paymentSession,
            },
          })
          return
        }

        if (route === '/checkout/failure') {
          clearCheckoutReturnContext()
          navigate('/checkout/failure', {
            replace: true,
            state: {
              orderId,
              lockToken: stored?.lockToken ?? '',
              message: result.message || `Payment ${status ?? 'failed'}`,
            },
          })
          return
        }

        // Still pending — poll once more shortly, then treat as pending failure path with retry
        setMessage(`الدفع قيد المعالجة${paymentId ? ` (${paymentId.slice(0, 10)}…)` : ''}…`)
        await new Promise((r) => setTimeout(r, 1500))
        if (cancelled) return

        const retry = await orchestrator.refreshPaymentStatus(orderId)
        if (cancelled) return
        const retryStatus = retry.paymentSession?.status ?? status
        const retryRoute = chooseCheckoutOutcomeRoute(retryStatus, queryStatus)

        if (retryRoute === '/checkout/success' && retry.order) {
          clearCheckoutReturnContext()
          navigate('/checkout/success', {
            replace: true,
            state: {
              order: retry.order,
              invoice: generateInvoice(retry.order),
              itinerary: generateItinerary(retry.order),
              paymentSession: retry.paymentSession,
            },
          })
          return
        }

        clearCheckoutReturnContext()
        navigate('/checkout/failure', {
          replace: true,
          state: {
            orderId,
            lockToken: stored?.lockToken ?? '',
            message: retry.message || `Payment status: ${retryStatus ?? 'pending'}`,
          },
        })
      } catch (e) {
        if (cancelled) return
        clearCheckoutReturnContext()
        navigate('/checkout/failure', {
          replace: true,
          state: {
            orderId,
            lockToken: stored?.lockToken ?? '',
            message: e instanceof Error ? e.message : 'Payment return reconciliation failed',
          },
        })
      }
    }

    void reconcile()
    return () => {
      cancelled = true
    }
  }, [navigate, orchestrator, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <svg className="mb-4 h-8 w-8 animate-spin text-primary-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <h1 className="text-base font-bold text-slate-900">العودة من بوابة الدفع</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </main>
    </div>
  )
}
