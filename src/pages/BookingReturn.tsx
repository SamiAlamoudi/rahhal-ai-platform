import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import {
  getBookingOrchestrator,
  loadBookingSession,
  syncBookingSession,
} from '../lib/booking'
import type { BookingSession } from '../lib/booking/bookingTypes'
import { useAuth } from '../lib/auth'

interface SafeReturnParams {
  bookingSessionId: string | null
  provider: string | null
  status: string | null
}

const ALLOWED_PARAM_KEYS = ['bookingSessionId', 'provider', 'status'] as const

function extractSafeParams(searchParams: URLSearchParams): SafeReturnParams {
  const params: SafeReturnParams = {
    bookingSessionId: null,
    provider: null,
    status: null,
  }
  for (const key of ALLOWED_PARAM_KEYS) {
    const value = searchParams.get(key)
    if (value) {
      params[key] = value
    }
  }
  return params
}

const STATUS_LABELS: Record<string, string> = {
  redirected: 'تم التحويل',
  pending_provider_confirmation: 'بانتظار تأكيد المزود',
  confirmed: 'مؤكد',
  cancelled: 'ملغي',
  expired: 'منتهي',
}

export default function BookingReturn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const params = useMemo(() => extractSafeParams(searchParams), [searchParams])
  const { user, loading: authLoading } = useAuth()

  const orchestrator = useMemo(() => getBookingOrchestrator(), [])
  const [referenceInput, setReferenceInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [providerUrl, setProviderUrl] = useState<string | null>(null)
  const [session, setSession] = useState<BookingSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!params.bookingSessionId) {
        if (!cancelled) {
          setSession(null)
          setLoading(false)
        }
        return
      }
      if (authLoading) return
      if (!user?.id) {
        if (!cancelled) {
          setSession(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const cached = orchestrator.getBookingSession(params.bookingSessionId)
        const ownedCache = cached?.userId === user.id ? cached : null
        const loaded =
          ownedCache ?? (await loadBookingSession(params.bookingSessionId, user.id))
        if (loaded) orchestrator.importSession(loaded)
        if (!cancelled) setSession(loaded)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params.bookingSessionId, orchestrator, user?.id, authLoading])

  const providerRef = session?.providerReferences.find(r => r.providerId === params.provider) ?? null

  const handleAddReference = () => {
    if (!session || !referenceInput.trim()) return
    const providerId = params.provider || providerRef?.providerId || ''
    if (!providerId) return
    const fromStatus = session.status
    const updated = orchestrator.addProviderReference(session.id, providerId, referenceInput.trim())
    setSession(updated)
    if (updated) void syncBookingSession(updated, fromStatus)
    setSubmitted(true)
  }

  const handleReturnToProvider = () => {
    if (providerRef?.redirectUrl) {
      setProviderUrl(providerRef.redirectUrl)
    }
  }

  if (providerUrl) {
    window.open(providerUrl, '_blank', 'noopener,noreferrer')
    setProviderUrl(null)
  }

  if (!params.bookingSessionId) {
    return <Navigate to="/" replace />
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!user?.id) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="العودة"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">العودة من الحجز</h1>
              <p className="text-[10px] text-slate-400">تأكيد حجزك لدى المزود</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">هل أكملت الحجز لدى المزود؟</h2>

          {session ? (
            <>
              <p className="text-sm text-slate-600 mb-2">
                المزود: <span className="font-medium text-slate-900">{providerRef?.providerName || params.provider || 'غير معروف'}</span>
              </p>
              <p className="text-sm text-slate-600 mb-5">
                حالة الحجز: <span className="font-medium text-slate-900">{STATUS_LABELS[session.status] ?? session.status}</span>
              </p>

              {submitted ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
                  <p className="text-sm text-amber-800">
                    تم تسجيل رقم الحجز. حالة حجزك الآن «بانتظار تأكيد المزود». لن يتم تأكيد الحجز تلقائياً.
                  </p>
                </div>
              ) : (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    رقم الحجز لدى المزود (اختياري)
                  </label>
                  <input
                    type="text"
                    value={referenceInput}
                    onChange={e => setReferenceInput(e.target.value)}
                    placeholder="أدخل رقم الحجز"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                  <p className="mt-2 text-[11px] text-slate-400">
                    إدخال رقم الحجز لا يعني التأكيد. سيبقى الحجز بحالة «بانتظار تأكيد المزود» حتى يتم التحقق.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={handleReturnToProvider}
                  disabled={!providerRef?.redirectUrl}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  العودة إلى المزود
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    العودة للرئيسية
                  </button>
                  {!submitted && (
                    <button
                      type="button"
                      onClick={handleAddReference}
                      disabled={!referenceInput.trim()}
                      className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      تسجيل رقم الحجز
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 mb-5">
                لم نتمكن من العثور على جلسة الحجز. قد تكون منتهية الصلاحية أو محذوفة.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
                >
                  العودة للرئيسية
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/40 p-4">
          <p className="text-xs text-slate-500">
            رحّال لا يعتبر الحجز مؤكداً بمجرد العودة من المزود. التأكيد يتطلب تحققاً موثوقاً من المزود.
          </p>
        </div>
      </main>
    </div>
  )
}
