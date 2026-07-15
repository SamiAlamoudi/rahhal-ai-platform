import { useCallback, useEffect, useState } from 'react'
import AdminShell from '../components/admin/AdminShell'
import AdminListToolbar from '../components/admin/AdminListToolbar'
import AdminPagination from '../components/admin/AdminPagination'
import AdminStatusBadge from '../components/admin/AdminStatusBadge'
import { adminDashboardService } from '../lib/admin/adminDashboardService'
import { formatAdminDate, type PageResult } from '../lib/admin/adminListHelpers'
import {
  ADMIN_TRIP_STATUS_LABELS,
  type AdminTripRecord,
  type AdminTripStatus,
} from '../lib/admin/mockAdminData'

const PAGE_SIZE = 5

const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'draft', label: 'مسودة' },
  { value: 'active', label: 'نشطة' },
  { value: 'completed', label: 'مكتملة' },
  { value: 'cancelled', label: 'ملغاة' },
]

export default function AdminTripsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PageResult<AdminTripRecord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await adminDashboardService.listTrips({
        query,
        status,
        page,
        pageSize: PAGE_SIZE,
      })
      setResult(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الرحلات')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [query, status, page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [query, status])

  return (
    <AdminShell
      title="إدارة الرحلات"
      subtitle="الرحلات المحفوظة وخطط السفر"
      onRefresh={() => void load()}
      refreshing={loading}
    >
      <AdminListToolbar
        searchId="admin-trips-search"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="ابحث بالعنوان أو الوجهة أو البريد..."
        statusValue={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
      />

      {loading && (
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center shadow-sm">
          <p className="text-sm text-slate-400">جاري تحميل الرحلات...</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-2 text-xs font-medium underline">
            إعادة المحاولة
          </button>
        </div>
      )}

      {!loading && result && result.total === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm text-slate-500">لا توجد رحلات مطابقة</p>
        </div>
      )}

      {!loading && result && result.items.length > 0 && (
        <div className="space-y-3">
          {result.items.map((trip) => (
            <article
              key={trip.id}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-slate-900">{trip.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{trip.destination}</p>
                  <p className="mt-1 text-xs text-slate-400">{trip.userEmail}</p>
                </div>
                <AdminStatusBadge
                  status={trip.status}
                  label={ADMIN_TRIP_STATUS_LABELS[trip.status as AdminTripStatus]}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>{trip.itemCount} عنصر</span>
                <span>{formatAdminDate(trip.createdAt)}</span>
                <span className="font-mono text-[10px] text-slate-400">{trip.id}</span>
              </div>
            </article>
          ))}
          <AdminPagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </AdminShell>
  )
}
