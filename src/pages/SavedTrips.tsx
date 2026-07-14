import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { savedTripRepository } from '../lib/repositories/savedTripRepository'
import type { SavedTripRow } from '../lib/types'

export default function SavedTrips() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState<SavedTripRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await savedTripRepository.listByUser(50)
        if (!cancelled) setTrips(rows)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'تعذر تحميل الرحلات المحفوظة')
          setTrips([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="رجوع"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">الرحلات المحفوظة</h1>
              <p className="text-[10px] text-slate-400">خططك المفضلة</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {loading && <p className="text-center text-sm text-slate-400">جاري التحميل...</p>}
        {error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}
        {!loading && trips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <span className="text-3xl">⭐</span>
            <p className="mt-2 text-sm text-slate-500">لا توجد رحلات محفوظة بعد</p>
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="mt-4 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              ابدأ التخطيط لرحلة
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <div key={trip.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="font-bold text-slate-900">{trip.title}</p>
                <p className="mt-1 text-sm text-slate-600">{trip.destination}</p>
                <p className="mt-2 text-[11px] text-slate-400">
                  {new Date(trip.created_at).toLocaleDateString('ar-SA')}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
