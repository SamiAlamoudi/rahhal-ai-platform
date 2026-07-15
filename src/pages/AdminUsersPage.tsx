import { useCallback, useEffect, useState } from 'react'
import AdminShell from '../components/admin/AdminShell'
import AdminListToolbar from '../components/admin/AdminListToolbar'
import AdminPagination from '../components/admin/AdminPagination'
import AdminStatusBadge from '../components/admin/AdminStatusBadge'
import { adminDashboardService } from '../lib/admin/adminDashboardService'
import { formatAdminDate } from '../lib/admin/adminListHelpers'
import {
  ADMIN_USER_STATUS_LABELS,
  type AdminUserRecord,
  type AdminUserStatus,
} from '../lib/admin/mockAdminData'
import type { PageResult } from '../lib/admin/adminListHelpers'

const PAGE_SIZE = 5

const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'active', label: 'نشط' },
  { value: 'pending', label: 'بانتظار التفعيل' },
  { value: 'suspended', label: 'موقوف' },
]

export default function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PageResult<AdminUserRecord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await adminDashboardService.listUsers({
        query,
        status,
        page,
        pageSize: PAGE_SIZE,
      })
      setResult(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المستخدمين')
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
      title="إدارة المستخدمين"
      subtitle="صلاحيات RBAC وحالة الحسابات"
      onRefresh={() => void load()}
      refreshing={loading}
    >
      <AdminListToolbar
        searchId="admin-users-search"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="ابحث بالاسم أو البريد..."
        statusValue={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
      />

      {loading && (
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center shadow-sm">
          <p className="text-sm text-slate-400">جاري تحميل المستخدمين...</p>
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
          <p className="text-sm text-slate-500">لا يوجد مستخدمون مطابقون للبحث</p>
        </div>
      )}

      {!loading && result && result.items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">الاسم</th>
                  <th className="px-4 py-3 font-medium">البريد</th>
                  <th className="px-4 py-3 font-medium">الدور</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">آخر دخول</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((user) => (
                  <tr key={user.id} className="border-t border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{user.fullName}</td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {user.role === 'admin' ? 'مشرف' : 'مستخدم'}
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge
                        status={user.status}
                        label={ADMIN_USER_STATUS_LABELS[user.status as AdminUserStatus]}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {user.lastSignInAt ? formatAdminDate(user.lastSignInAt) : '—'}
                    </td>
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
