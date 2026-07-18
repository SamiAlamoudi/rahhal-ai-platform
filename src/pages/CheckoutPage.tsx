import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { getDefaultPaymentProvider, getCheckoutOrchestrator } from '../lib/payment'
import { useAuth } from '../lib/auth'
import { validateCoupon } from '../lib/payment/couponValidator'
import { buildCart } from '../lib/payment/orderManager'
import type { CheckoutItem, CheckoutCart } from '../lib/payment/checkoutTypes'
import type { CheckoutSession } from '../lib/payment/checkoutOrchestrator'

interface CheckoutLocationState {
  items: CheckoutItem[]
  travelSessionId: string | null
  currency: string
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

const TYPE_LABELS: Record<string, string> = {
  flight: 'طيران',
  hotel: 'فندق',
  rental_car: 'تأجير سيارة',
  activity: 'نشاط',
  transfer: 'مواصلات',
  insurance: 'تأمين',
  esim: 'eSIM',
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString('en-US')} ${currency}`
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const state = location.state as CheckoutLocationState | null

  const [couponCode, setCouponCode] = useState('')
  const [couponMessage, setCouponMessage] = useState<{ text: string; valid: boolean } | null>(null)
  const [discount, setDiscount] = useState(0)
  const [, setCheckoutSession] = useState<CheckoutSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const provider = useMemo(() => getDefaultPaymentProvider(), [])
  const orchestrator = useMemo(() => getCheckoutOrchestrator(provider), [provider])

  const cart: CheckoutCart = useMemo(() => {
    if (!state) return { items: [], subtotal: 0, taxes: 0, fees: 0, discount, total: 0, currency: 'SAR' }
    return buildCart(state.items, state.currency, couponMessage?.valid ? couponCode : null, discount)
  }, [state, discount, couponCode, couponMessage])

  const handleApplyCoupon = useCallback(() => {
    if (!couponCode.trim()) {
      setCouponMessage({ text: 'أدخل كود الخصم', valid: false })
      return
    }
    const result = validateCoupon(couponCode, cart)
    setCouponMessage({ text: result.message, valid: result.valid })
    if (result.valid) {
      setDiscount(result.discountAmount)
    } else {
      setDiscount(0)
    }
  }, [couponCode, cart])

  const handleProceedToReview = useCallback(async () => {
    if (!state || state.items.length === 0) {
      setError('لا توجد عناصر للدفع')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const session = await orchestrator.initiateCheckout({
        userId: user?.id ?? 'anonymous',
        travelSessionId: state.travelSessionId,
        items: state.items,
        currency: state.currency,
        travelers: [],
        couponCode: couponMessage?.valid ? couponCode : null,
      })
      setCheckoutSession(session)
      navigate('/checkout/review', {
        state: {
          checkoutSession: session,
          items: state.items,
          currency: state.currency,
        },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initiate checkout')
    } finally {
      setLoading(false)
    }
  }, [state, orchestrator, couponCode, couponMessage, navigate, user?.id])

  if (!state?.items || state.items.length === 0) {
    return <Navigate to="/results" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="رجوع"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">الدفع الموحد</h1>
              <p className="text-[10px] text-slate-400">راجع طلبك وادفع داخل رحّال</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Selected items */}
        <div className="space-y-3">
          {cart.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden>{TYPE_ICONS[item.type] ?? '📋'}</span>
                  <div>
                    <h3 className="font-bold text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.providerName}</p>
                    <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {TYPE_LABELS[item.type] ?? item.type}
                    </span>
                  </div>
                </div>
                <p className="font-bold text-slate-900">{formatPrice(item.price, item.currency)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Coupon section */}
        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-3">كود الخصم</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="أدخل كود الخصم"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
            >
              تطبيق
            </button>
          </div>
          {couponMessage && (
            <p className={`mt-2 text-xs ${couponMessage.valid ? 'text-emerald-600' : 'text-rose-500'}`}>
              {couponMessage.text}
            </p>
          )}
        </div>

        {/* Price summary */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">ملخص الطلب</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>المجموع الفرعي</span>
              <span>{formatPrice(cart.subtotal, cart.currency)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>ضريبة القيمة المضافة (15%)</span>
              <span>{formatPrice(cart.taxes, cart.currency)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>رسوم الخدمة</span>
              <span>{formatPrice(cart.fees, cart.currency)}</span>
            </div>
            {cart.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>الخصم</span>
                <span>-{formatPrice(cart.discount, cart.currency)}</span>
              </div>
            )}
            <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-slate-900">
              <span>الإجمالي</span>
              <span>{formatPrice(cart.total, cart.currency)}</span>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleProceedToReview}
            disabled={loading || cart.items.length === 0}
            data-testid="checkout-continue"
            className="rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {loading ? 'جاري المعالجة...' : 'متابعة للمراجعة'}
          </button>
        </div>
      </main>
    </div>
  )
}
