import { useCallback, useEffect, useState } from 'react'
import AdminShell from '../components/admin/AdminShell'
import AdminListToolbar from '../components/admin/AdminListToolbar'
import AdminPagination from '../components/admin/AdminPagination'
import AdminStatusBadge from '../components/admin/AdminStatusBadge'
import { adminDashboardService } from '../lib/admin/adminDashboardService'
import { formatAdminDate, formatAdminMoney, type PageResult } from '../lib/admin/adminListHelpers'
import {
  ADMIN_BOOKING_STATUS_LABELS,
  type AdminBookingRecord,
  type AdminBookingStatus,
} from '../lib/admin/mockAdminData'

const PAGE_SIZE = 5

const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'draft', label: 'مسودة' },
  { value: 'ready', label: 'جاهز' },
  { value: 'redirected', label: 'تم التوجيه' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'expired', label: 'منتهي' },
  { value: 'cancelled', label: 'ملغي' },
]

export default function AdminBookingsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PageResult<AdminBookingRecord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await adminDashboardService.listBookings({
        query,
        status,
        page,
        pageSize: PAGE_SIZE,
      })
      setResult(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الحجوزات')
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
      title="إدارة الحجوزات"
      subtitle="جلسات الحجز وحالاتها"
      onRefresh={() => void load()}
      refreshing={loading}
    >
      <AdminListToolbar
        searchId="admin-bookings-search"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="ابحث بالوجهة أو البريد أو المعرف..."
        statusValue={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
      />

      {loading && (
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center shadow-sm">
          <p className="text-sm text-slate-400">جاري تحميل الحجوزات...</p>
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
          <p className="text-sm text-slate-500">لا توجد حجوزات مطابقة</p>
        </div>
      )}

      {!loading && result && result.items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">المعرف</th>
                  <th className="px-4 py-3 font-medium">المستخدم</th>
                  <th className="px-4 py-3 font-medium">الوجهة</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">الإجمالي</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((booking) => (
                  <tr key={booking.id} className="border-t border-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{booking.id}</td>
                    <td className="px-4 py-3 text-slate-700">{booking.userEmail}</td>
                    <td className="px-4 py-3 text-slate-700">{booking.destination}</td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge
                        status={booking.status}
                        label={ADMIN_BOOKING_STATUS_LABELS[booking.status as AdminBookingStatus]}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatAdminMoney(booking.total, booking.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatAdminDate(booking.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <AdminPagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              pageSize={result.pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </AdminShell>
  )
}
