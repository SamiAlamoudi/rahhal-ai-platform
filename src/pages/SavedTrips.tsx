import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { savedTripRepository } from '../lib/repositories/savedTripRepository'
import type { SavedTripRow } from '../lib/types'
import {
  filterSavedTrips,
  formatSavedTripTotal,
  parseSavedTripData,
} from '../lib/savedTrips/savedTripHelpers'

const TYPE_LABELS: Record<string, string> = {
  flight: 'طيران',
  hotel: 'فنادق',
  rental_car: 'تأجير سيارات',
  activity: 'أنشطة',
  transfer: 'مواصلات',
  insurance: 'تأمين',
  esim: 'eSIM',
}

export default function SavedTrips() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState<SavedTripRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const loadTrips = useCallback(async () => {
    setLoading(true)
    setError(null)
    setActionError(null)
    try {
      const rows = await savedTripRepository.listByUser(50)
      setTrips(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الرحلات المحفوظة')
      setTrips([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTrips()
  }, [loadTrips])

  const filtered = useMemo(() => filterSavedTrips(trips, query), [trips, query])

  const startRename = (trip: SavedTripRow) => {
    setEditingId(trip.id)
    setEditTitle(trip.title)
    setActionError(null)
  }

  const cancelRename = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const saveRename = async (tripId: string) => {
    const title = editTitle.trim()
    if (!title) {
      setActionError('عنوان الرحلة مطلوب')
      return
    }
    setBusyId(tripId)
    setActionError(null)
    try {
      const updated = await savedTripRepository.update(tripId, { title })
      if (updated) {
        setTrips((prev) => prev.map((t) => (t.id === tripId ? updated : t)))
      }
      setEditingId(null)
      setEditTitle('')
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذر تحديث العنوان')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    const tripId = pendingDeleteId
    setBusyId(tripId)
    setActionError(null)
    try {
      await savedTripRepository.delete(tripId)
      setTrips((prev) => prev.filter((t) => t.id !== tripId))
      if (expandedId === tripId) setExpandedId(null)
      if (editingId === tripId) cancelRename()
      setPendingDeleteId(null)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذر حذف الرحلة')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="رجوع"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900">الرحلات المحفوظة</h1>
              <p className="text-[10px] text-slate-400">خططك المفضلة</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadTrips()}
            disabled={loading}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            تحديث
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <label className="sr-only" htmlFor="saved-trips-search">بحث في الرحلات المحفوظة</label>
          <input
            id="saved-trips-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالعنوان أو الوجهة..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
          />
        </div>

        {loading && (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
                <div className="h-4 w-2/3 rounded bg-slate-100" />
                <div className="mt-3 h-3 w-1/3 rounded bg-slate-100" />
                <div className="mt-4 h-3 w-1/4 rounded bg-slate-100" />
              </div>
            ))}
            <p className="text-center text-sm text-slate-400">جاري التحميل...</p>
          </div>
        )}

        {error && !loading && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadTrips()}
              className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 transition-colors hover:bg-rose-50"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {actionError}
          </div>
        )}

        {!loading && !error && filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <p className="mt-2 text-sm text-slate-500">
              {query.trim() ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد رحلات محفوظة بعد'}
            </p>
            <button
              type="button"
              onClick={() => (query.trim() ? setQuery('') : navigate('/chat'))}
              className="mt-4 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              {query.trim() ? 'مسح البحث' : 'ابدأ مع وكيل السفر'}
            </button>
          </div>
        ) : null}

        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((trip) => {
              const data = parseSavedTripData(trip.trip_data)
              const totalLabel = formatSavedTripTotal(data)
              const expanded = expandedId === trip.id
              const renaming = editingId === trip.id
              const busy = busyId === trip.id

              return (
                <article key={trip.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <div className="p-4">
                    {renaming ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                          aria-label="عنوان الرحلة"
                          disabled={busy}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveRename(trip.id)}
                            disabled={busy}
                            className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            حفظ
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            disabled={busy}
                            className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : trip.id)}
                          className="min-w-0 flex-1 text-right"
                        >
                          <p className="truncate font-bold text-slate-900">{trip.title || 'رحلة محفوظة'}</p>
                          <p className="mt-1 text-sm text-slate-600">{trip.destination || '—'}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span>{new Date(trip.created_at).toLocaleDateString('ar-SA')}</span>
                            {data.agentItinerary && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                خطة وكيل السفر
                              </span>
                            )}
                            {data.items.length > 0 && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                                {data.items.length} عنصر
                              </span>
                            )}
                            {totalLabel && (
                              <span className="rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">
                                {totalLabel}
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    )}

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : trip.id)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                      </button>
                      <button
                        type="button"
                        onClick={() => startRename(trip)}
                        disabled={busy || renaming}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        إعادة تسمية
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(data.agentItinerary ? '/chat' : '/search')}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        متابعة التخطيط
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(trip.id)}
                        disabled={busy}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                      >
                        حذف
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-3">
                      {data.agentItinerary && (
                        <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3 text-sm text-slate-700">
                          <p className="font-bold text-slate-900">{data.agentItinerary.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {data.agentItinerary.destinations.join('، ')}
                            {' · '}
                            {data.agentItinerary.durationDays} أيام
                            {' · '}
                            {data.agentItinerary.estimatedBudget.amount.toLocaleString('en-US')}{' '}
                            {data.agentItinerary.estimatedBudget.currency}
                          </p>
                          <ul className="mt-2 space-y-1 text-xs text-slate-600">
                            {data.agentItinerary.activities.slice(0, 5).map((day) => (
                              <li key={`${trip.id}-day-${day.day}`}>
                                {day.title}: {day.activities.map((a) => a.title).join(' · ')}
                              </li>
                            ))}
                          </ul>
                          <button
                            type="button"
                            onClick={() => navigate('/chat')}
                            className="mt-3 text-xs font-medium text-primary-700 underline"
                          >
                            فتح وكيل السفر للتعديل
                          </button>
                        </div>
                      )}
                      {data.items.length === 0 && !data.agentItinerary ? (
                        <p className="text-sm text-slate-500">لا توجد عناصر محفوظة داخل هذه الرحلة.</p>
                      ) : data.items.length > 0 ? (
                        <ul className="space-y-2">
                          {data.items.map((item, index) => (
                            <li
                              key={`${trip.id}-${index}-${item.title}`}
                              className="rounded-xl border border-slate-100 bg-white px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                                  <p className="mt-0.5 text-[11px] text-slate-500">
                                    {TYPE_LABELS[item.type] ?? item.type}
                                    {item.providerName ? ` · ${item.providerName}` : ''}
                                  </p>
                                </div>
                                <p className="shrink-0 text-sm font-bold text-slate-800">
                                  {item.price.toLocaleString('en-US')} {item.currency}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </main>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">حذف الرحلة المحفوظة؟</h2>
            <p className="mt-2 text-sm text-slate-600">
              سيتم حذف هذه الخطة نهائياً من قائمة رحلاتك المحفوظة.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                disabled={busyId === pendingDeleteId}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busyId === pendingDeleteId}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
