import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import {
  getBookingOrchestrator,
  persistBookingSession,
  syncBookingSession,
  loadBookingSession,
  type BookingSelectedItem,
} from '../lib/booking'
import type { BookingSession, BookingItem, BookingItemType } from '../lib/booking/bookingTypes'
import type { BookingAction } from '../lib/booking/bookingAction'
import { prepareBookingPayment } from '../lib/payment'
import { savedTripRepository } from '../lib/repositories/savedTripRepository'
import { buildSavedTripData, buildSavedTripTitle } from '../lib/savedTrips/savedTripHelpers'
import { useAuth } from '../lib/auth'
import {
  getBookingFlowController,
  isBookingFlowEnabled,
  type BookingFlowReviewModel,
  type BookingFlowState,
} from '../lib/bookingFlow'
import { BookingFlowReview } from '../components/bookingFlow'

interface BookingReviewLocationState {
  selectedItems?: BookingSelectedItem[]
  travelSessionId: string | null
  currency: string
  /** Resume an already-persisted booking session. */
  bookingSessionId?: string
  /** Sprint 25 — optional conversation + flow ids for restore. */
  conversationId?: string | null
  bookingFlowId?: string
}

const TYPE_LABELS: Record<BookingItemType, string> = {
  flight: 'طيران',
  hotel: 'فنادق',
  rental_car: 'تأجير سيارات',
  activity: 'أنشطة',
  transfer: 'مواصلات',
  insurance: 'تأمين',
  esim: 'eSIM',
}

const TYPE_ICONS: Record<BookingItemType, string> = {
  flight: '✈️',
  hotel: '🏨',
  rental_car: '🚙',
  activity: '🎯',
  transfer: '🚗',
  insurance: '🛡️',
  esim: '📱',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  selected: 'تم الاختيار',
  ready_to_redirect: 'جاهز للتحويل',
  redirected: 'تم التحويل',
  pending_provider_confirmation: 'بانتظار تأكيد المزود',
  confirmed: 'مؤكد',
  failed: 'فشل',
  cancelled: 'ملغي',
  expired: 'منتهي',
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString('en-US')} ${currency}`
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

export default function BookingReview() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const state = location.state as BookingReviewLocationState | null
  const bookingFlowOn = isBookingFlowEnabled()

  const orchestrator = useMemo(() => getBookingOrchestrator(), [])
  const flowController = useMemo(() => getBookingFlowController(), [])
  const bootstrappedForUser = useRef<string | null>(null)

  const [session, setSession] = useState<BookingSession | null>(null)
  const [flowState, setFlowState] = useState<BookingFlowState | null>(null)
  const [flowReview, setFlowReview] = useState<BookingFlowReviewModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirectAction, setRedirectAction] = useState<BookingAction | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const canCreateFromSelection = Boolean(state?.selectedItems && state.selectedItems.length > 0)
  const canResume = Boolean(state?.bookingSessionId)

  useEffect(() => {
    if (!state || authLoading) return
    if (!user?.id) {
      setLoading(false)
      setSession(null)
      return
    }

    const userId = user.id
    // Re-run bootstrap when auth identity settles (avoids anonymous race).
    if (bootstrappedForUser.current === userId) return
    bootstrappedForUser.current = userId

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (bookingFlowOn) {
          let flow =
            (state.bookingFlowId
              ? flowController.restoreFlow(userId, state.bookingFlowId)
              : null) ??
            (state.bookingSessionId
              ? flowController.restoreByBookingSession(userId, state.bookingSessionId)
              : null)

          if (!flow) {
            flow = flowController.createFlow({
              userId,
              conversationId: state.conversationId ?? null,
              travelSessionId: state.travelSessionId,
              currency: state.currency || 'SAR',
            })
          }

          if (state.selectedItems?.length) {
            const applied = await flowController.applySelection({
              flowId: flow.id,
              items: state.selectedItems,
            })
            flow = applied.flow
            if (!cancelled) setSession(applied.session)
          } else if (state.bookingSessionId) {
            const cached = orchestrator.getBookingSession(state.bookingSessionId)
            const loaded =
              (cached?.userId === userId ? cached : null) ??
              (await loadBookingSession(state.bookingSessionId, userId))
            if (loaded) {
              orchestrator.importSession(loaded)
              flow = flowController.bindSession(flow.id, loaded.id)
              if (!cancelled) setSession(loaded)
            }
          }

          if (flow.bookingSessionId) {
            const { model } = await flowController.enterReview(flow.id)
            if (!cancelled) {
              setFlowReview(model)
              setFlowState(flowController.getFlow(flow.id))
              setSession(model.session)
            }
          } else if (!cancelled) {
            setFlowState(flow)
          }
          return
        }

        if (state.bookingSessionId) {
          const cached = orchestrator.getBookingSession(state.bookingSessionId)
          const ownedCache = cached?.userId === userId ? cached : null
          const loaded =
            ownedCache ?? (await loadBookingSession(state.bookingSessionId, userId))
          if (loaded) {
            orchestrator.importSession(loaded)
            if (!cancelled) setSession(loaded)
            return
          }
        }

        if (!state.selectedItems?.length) return

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        const newSession = orchestrator.createBookingSession({
          userId,
          travelSessionId: state.travelSessionId,
          currency: state.currency || 'SAR',
          expiresAt,
        })
        for (const item of state.selectedItems) {
          const result = orchestrator.addBookingItem(newSession.id, {
            type: item.bookingType,
            providerId: item.option.providerIds[0] || 'unknown',
            providerName: item.providerName,
            providerOfferId: item.option.id,
            title: item.option.title,
            price: item.option.price,
            currency: item.option.currency,
            bookingUrl: item.bookingUrl,
            expiresAt: item.expiresAt,
            travelerSummary: '',
            metadata: {
              cancellationInfo: item.cancellationInfo,
              rating: item.option.rating,
              refundable: item.option.refundable,
            },
          })
          if (result.error && !cancelled) setError(result.error)
        }
        const updated = orchestrator.getBookingSession(newSession.id)
        if (updated) {
          await persistBookingSession(updated)
          if (!cancelled) setSession(updated)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [state, orchestrator, flowController, user?.id, authLoading, bookingFlowOn])

  if (!state || (!canCreateFromSelection && !canResume)) {
    return <Navigate to="/results" replace />
  }

  if (authLoading || (loading && !session)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!user?.id) {
    return <Navigate to="/login" replace />
  }

  if (!session) {
    return <Navigate to="/my-trips" replace />
  }

  const handleRemoveItem = (itemId: string) => {
    if (!session) return
    const fromStatus = session.status
    const updated = orchestrator.removeBookingItem(session.id, itemId)
    setSession(updated)
    if (updated) {
      void syncBookingSession(updated, fromStatus)
      if (bookingFlowOn && flowState) {
        void flowController.enterReview(flowState.id).then(({ model }) => {
          setFlowReview(model)
          setSession(model.session)
        })
      }
    }
  }

  const handlePrepareRedirect = () => {
    if (!session) return
    const fromStatus = session.status
    const action = orchestrator.prepareRedirect(session.id)
    const updated = orchestrator.getBookingSession(session.id)
    if (updated) {
      setSession(updated)
      void syncBookingSession(updated, fromStatus)
    }
    setRedirectAction(action)
    if (action && action.allowed) {
      setShowConfirmDialog(true)
    } else if (action) {
      setError(action.messageKey)
    }
  }

  const handleConfirmRedirect = () => {
    if (!session || !redirectAction || !redirectAction.allowed) return
    const fromStatus = session.status
    const updated = orchestrator.markRedirected(session.id)
    setSession(updated)
    if (updated) void syncBookingSession(updated, fromStatus)
    setShowConfirmDialog(false)
    if (redirectAction.bookingUrl) {
      window.open(redirectAction.bookingUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleSaveTrip = async () => {
    if (!session) return
    setError(null)
    try {
      const destination =
        session.items.find((item) => item.type === 'hotel')?.title
        ?? session.items.find((item) => item.type === 'flight')?.title
        ?? session.items[0]?.title
        ?? 'رحلة محفوظة'
      const tripData = buildSavedTripData({
        currency: session.currency,
        travelSessionId: session.travelSessionId,
        bookingSessionId: session.id,
        items: session.items.map((item) => ({
          type: item.type,
          title: item.title,
          providerName: item.providerName,
          price: item.price,
          currency: item.currency,
          bookingUrl: item.bookingUrl,
        })),
      })
      await savedTripRepository.create({
        session_id: null,
        title: buildSavedTripTitle(destination, session.items.length),
        destination,
        trip_data: tripData as unknown as Record<string, unknown>,
      })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ الرحلة')
      setSaved(false)
    }
  }

  const handleEditSelection = () => {
    navigate('/results')
  }

  const handlePayViaRahhal = () => {
    if (!session || session.items.length === 0) {
      setError('لا توجد عناصر للدفع')
      return
    }
    try {
      const prepared = prepareBookingPayment({
        bookingSession: session,
        returnUrl: `${window.location.origin}/checkout/return`,
        customerEmail: user?.email ?? null,
        customerName: user?.user_metadata?.full_name ?? user?.email ?? null,
      })
      navigate('/checkout', {
        state: {
          items: prepared.checkoutInit.items,
          travelSessionId: prepared.checkoutInit.travelSessionId,
          currency: prepared.currency,
          bookingSessionId: prepared.bookingSessionId,
        },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر بدء الدفع عبر بيلامو')
    }
  }

  const summary = session ? orchestrator.calculateBookingSummary(session.id) : null
  const readiness = session ? orchestrator.validateBookingReadiness(session.id) : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/results')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="العودة للنتائج"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">مراجعة الحجز</h1>
              <p className="text-[10px] text-slate-400">راجع اختياراتك قبل المتابعة</p>
            </div>
          </div>
          {session && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${readiness?.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {STATUS_LABELS[session.status] ?? session.status}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            تم حفظ الرحلة في بيلامو
          </div>
        )}

        {bookingFlowOn && flowReview && (
          <div className="mb-6">
            <BookingFlowReview
              model={flowReview}
              onBack={() => navigate('/results', {
                state: {
                  bookingSessionId: session?.id,
                  bookingFlowId: flowState?.id,
                  travelSessionId: state?.travelSessionId ?? null,
                  currency: state?.currency ?? session?.currency ?? 'SAR',
                },
              })}
              onEditSection={() => navigate('/results', {
                state: {
                  bookingSessionId: session?.id,
                  bookingFlowId: flowState?.id,
                  travelSessionId: state?.travelSessionId ?? null,
                  currency: state?.currency ?? session?.currency ?? 'SAR',
                },
              })}
              onRemoveItem={(itemId) => handleRemoveItem(itemId)}
              onContinuePayment={handlePayViaRahhal}
            />
          </div>
        )}

        {/* Items list (legacy + shared) */}
        <div className={`space-y-3 ${bookingFlowOn && flowReview ? 'sr-only' : ''}`}>
          {session?.items.map((item: BookingItem) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden>{TYPE_ICONS[item.type] ?? '📋'}</span>
                  <div>
                    <h3 className="font-bold text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.providerName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-medium text-indigo-700">
                        {item.bookingMode === 'redirect' ? 'تحويل' : String(item.bookingMode)}
                      </span>
                      {item.metadata.cancellationInfo != null && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {String(item.metadata.cancellationInfo)}
                        </span>
                      )}
                      {item.expiresAt && (
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${isExpired(item.expiresAt) ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                          {isExpired(item.expiresAt) ? 'منتهي الصلاحية' : `ينتهي: ${new Date(item.expiresAt).toLocaleDateString('ar-SA')}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-900">{formatPrice(item.price, item.currency)}</p>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="mt-2 text-[11px] font-medium text-rose-500 transition-colors hover:text-rose-700"
                  >
                    إزالة عنصر
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        {summary && !(bookingFlowOn && flowReview) && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-4">ملخص الحجز</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي</span>
                <span>{formatPrice(summary.subtotal, summary.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>رسوم بيلامو</span>
                <span>{formatPrice(summary.fees, summary.currency)}</span>
              </div>
              <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-slate-900">
                <span>الإجمالي</span>
                <span>{formatPrice(summary.total, summary.currency)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment path notice */}
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm text-sky-800">
            يمكنك التحويل لإتمام الحجز لدى المزود، أو متابعة الدفع التجريبي عبر بيلامو (وضع mock افتراضياً).
          </p>
        </div>

        {/* Readiness warnings */}
        {readiness && !readiness.ready && readiness.warnings.length > 0 && !(bookingFlowOn && flowReview) && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800 mb-1">تنبيهات قبل المتابعة:</p>
            <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
              {readiness.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/results')}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              العودة للنتائج
            </button>
            <button
              type="button"
              onClick={handleEditSelection}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              تعديل الاختيار
            </button>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => void handleSaveTrip()}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {saved ? 'تم الحفظ' : 'حفظ الرحلة'}
            </button>
            <button
              type="button"
              onClick={handlePayViaRahhal}
              disabled={session.items.length === 0}
              data-testid="pay-bilamo"
              className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              الدفع عبر بيلامو
            </button>
            <button
              type="button"
              onClick={handlePrepareRedirect}
              disabled={!readiness?.ready}
              className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              التحويل لإتمام الحجز
            </button>
          </div>
        </div>
      </main>

      {/* Confirmation dialog */}
      {showConfirmDialog && redirectAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-3">تأكيد التحويل</h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              سيتم تحويلك إلى <span className="font-bold text-slate-900">{redirectAction.providerName}</span> لإتمام الحجز والدفع. ستبقى رحلتك محفوظة في بيلامو.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRedirect}
                className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
              >
                متابعة الحجز
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
