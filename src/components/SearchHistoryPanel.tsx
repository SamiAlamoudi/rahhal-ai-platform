import { memo, useState, useEffect, useCallback } from 'react'
import { searchHistoryRepository, favoriteRepository } from '../lib/repositories'
import type { SearchHistoryRow } from '../lib/types'

interface Props {
  onContinueSearch: (row: SearchHistoryRow) => void
  refreshKey: number
}

function SearchHistoryPanelImpl({ onContinueSearch, refreshKey }: Props) {
  const [history, setHistory] = useState<SearchHistoryRow[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [pinned, setPinned] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, favs] = await Promise.all([
        searchHistoryRepository.listByUser(10),
        favoriteRepository.listByUser(),
      ])
      setHistory(rows)
      setFavorites(favs.map(f => f.destination))
    } catch {
      setHistory([])
      setFavorites([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData, refreshKey])

  const handleDelete = async (id: string) => {
    try {
      await searchHistoryRepository.delete(id)
      setHistory(prev => prev.filter(r => r.id !== id))
    } catch { }
  }

  const handleToggleFavorite = async (destination: string) => {
    try {
      if (favorites.includes(destination)) {
        await favoriteRepository.deleteByDestination(destination)
        setFavorites(prev => prev.filter(d => d !== destination))
      } else {
        await favoriteRepository.create({ destination })
        setFavorites(prev => [...prev, destination])
      }
    } catch { }
  }

  const handleTogglePin = (id: string) => {
    setPinned(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sortedHistory = [
    ...history.filter(r => pinned.has(r.id)),
    ...history.filter(r => !pinned.has(r.id)),
  ]

  return (
    <section
      aria-labelledby="history-heading"
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base">🗂</span>
        <h3 id="history-heading" className="text-sm font-bold text-slate-900">سجل البحث</h3>
      </div>

      {loading ? (
        <div className="space-y-2" aria-label="جاري تحميل السجل">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl border border-slate-100 p-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-slate-100" />
                <div className="h-2 w-1/2 rounded bg-slate-50" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedHistory.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
          <span className="text-2xl">🔍</span>
          <p className="mt-2 text-xs text-slate-400">لا توجد عمليات بحث سابقة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedHistory.map(row => (
            <div
              key={row.id}
              className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-all duration-200 hover:border-primary-200 hover:bg-primary-50/30"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-sm font-bold text-slate-400 transition-colors group-hover:bg-primary-100 group-hover:text-primary-600">
                {pinned.has(row.id) ? '📌' : '🔎'}
              </div>

              <button
                type="button"
                onClick={() => onContinueSearch(row)}
                className="min-w-0 flex-1 text-right"
                aria-label={`متابعة البحث عن ${row.destination}`}
              >
                <p className="truncate text-xs font-bold text-slate-800 group-hover:text-primary-700">
                  {row.destination || 'غير محدد'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {row.result_count} نتيجة · {new Date(row.created_at).toLocaleDateString('ar-SA')}
                </p>
              </button>

              <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleTogglePin(row.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={pinned.has(row.id) ? 'إلغاء التثبيت' : 'تثبيت البحث'}
                  title={pinned.has(row.id) ? 'إلغاء التثبيت' : 'تثبيت'}
                >
                  📌
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(row.destination)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-500"
                  aria-label={favorites.includes(row.destination) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                  title="مفضلة"
                >
                  {favorites.includes(row.destination) ? '★' : '☆'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(row.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  aria-label="حذف البحث"
                  title="حذف"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export const SearchHistoryPanel = memo(SearchHistoryPanelImpl)
