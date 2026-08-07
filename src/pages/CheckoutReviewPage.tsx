import { useState, useMemo } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import type { CheckoutItem, TravelerInfo } from '../lib/payment/checkoutTypes'
import type { CheckoutSession } from '../lib/payment/checkoutOrchestrator'

interface ReviewLocationState {
  checkoutSession: CheckoutSession
  items: CheckoutItem[]
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

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString('en-US')} ${currency}`
}

export default function CheckoutReviewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as ReviewLocationState | null

  const [travelers, setTravelers] = useState<TravelerInfo[]>([
    { id: 't1', firstName: '', lastName: '', dateOfBirth: null, passportNumber: null, passportExpiry: null, nationality: null, type: 'adult' },
  ])
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const cart = useMemo(() => state?.checkoutSession.cart, [state])

  if (!state?.checkoutSession || !cart) {
    return <Navigate to="/checkout" replace />
  }

  const handleAddTraveler = () => {
    setTravelers(prev => [...prev, {
      id: `t${prev.length + 1}`,
      firstName: '', lastName: '', dateOfBirth: null,
      passportNumber: null, passportExpiry: null, nationality: null,
      type: 'adult',
    }])
  }

  const handleRemoveTraveler = (id: string) => {
    setTravelers(prev => prev.filter(t => t.id !== id))
  }

  const handleTravelerChange = (id: string, field: keyof TravelerInfo, value: string) => {
    setTravelers(prev => prev.map(t => t.id === id ? { ...t, [field]: value || null } : t))
  }

  const handleProceedToPayment = () => {
    setError(null)
    if (!acceptedTerms) {
      setError('يجب الموافقة على الشروط والأحكام للمتابعة')
      return
    }
    const incompleteTravelers = travelers.filter(t => !t.firstName.trim() || !t.lastName.trim())
    if (incompleteTravelers.length > 0) {
      setError('يرجى إكمال أسماء جميع المسافرين')
      return
    }

    setLoading(true)
    navigate('/checkout/payment', {
      state: {
        checkoutSession: state.checkoutSession,
        items: state.items,
        currency: state.currency,
        travelers,
      },
    })
    setLoading(false)
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
              <h1 className="text-base font-bold text-slate-900">مراجعة الحجز</h1>
              <p className="text-[10px] text-slate-400">راجع بياناتك قبل الدفع</p>
            </div>
          </div>
          {state.checkoutSession.order && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-600">
              {state.checkoutSession.order.orderNumber}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Itinerary review */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-4">مراجعة الرحلة</h2>
          <div className="space-y-3">
            {state.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl" aria-hidden>{TYPE_ICONS[item.type] ?? '📋'}</span>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.providerName}</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-slate-700">{formatPrice(item.price, item.currency)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Traveler names */}
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">بيانات المسافرين</h2>
            <button
              type="button"
              onClick={handleAddTraveler}
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              + إضافة مسافر
            </button>
          </div>
          <div className="space-y-4">
            {travelers.map((t, idx) => (
              <div key={t.id} className="rounded-xl border border-slate-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">المسافر {idx + 1}</span>
                  {travelers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTraveler(t.id)}
                      className="text-xs text-rose-500 hover:text-rose-700"
                    >
                      إزالة
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="الاسم الأول"
                    value={t.firstName}
                    onChange={(e) => handleTravelerChange(t.id, 'firstName', e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                  />
                  <input
                    type="text"
                    placeholder="اسم العائلة"
                    value={t.lastName}
                    onChange={(e) => handleTravelerChange(t.id, 'lastName', e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                  />
                  <input
                    type="text"
                    placeholder="رقم الجواز"
                    value={t.passportNumber ?? ''}
                    onChange={(e) => handleTravelerChange(t.id, 'passportNumber', e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                  />
                  <input
                    type="text"
                    placeholder="الجنسية"
                    value={t.nationality ?? ''}
                    onChange={(e) => handleTravelerChange(t.id, 'nationality', e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Policies */}
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-3">سياسات وشروط</h2>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-slate-400">•</span>
              <span>الحقائب: تشمل حقيبة يد واحدة لكل مسافر</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-slate-400">•</span>
              <span>سياسة الإلغاء: إلغاء مجاني حتى 24 ساعة قبل الموعد</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-slate-400">•</span>
              <span>شروط الإيجار: رخصة قيادة صالحة + بطاقة ائتمانية</span>
            </div>
          </div>
        </div>

        {/* Terms acceptance */}
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              data-testid="checkout-terms"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-700">
              أوافق على <span className="font-medium text-primary-600">الشروط والأحكام</span> وسياسة الخصوصية الخاصة ببيلامو، وأؤكد صحة البيانات المدخلة.
            </span>
          </label>
        </div>

        {/* Total + Action */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">الإجمالي</p>
            <p className="text-xl font-bold text-slate-900">{formatPrice(cart.total, cart.currency)}</p>
          </div>
          <button
            type="button"
            onClick={handleProceedToPayment}
            disabled={loading || !acceptedTerms}
            data-testid="checkout-to-payment"
            className="rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            المتابعة للدفع
          </button>
        </div>
      </main>
    </div>
  )
}
