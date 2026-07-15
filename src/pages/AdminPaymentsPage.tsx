import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminShell from '../components/admin/AdminShell'
import AdminListToolbar from '../components/admin/AdminListToolbar'
import AdminPagination from '../components/admin/AdminPagination'
import AdminStatusBadge from '../components/admin/AdminStatusBadge'
import { adminDashboardService } from '../lib/admin/adminDashboardService'
import { formatAdminDate, formatAdminMoney, type PageResult } from '../lib/admin/adminListHelpers'
import {
  ADMIN_PAYMENT_STATUS_LABELS,
  getMockAdminPayments,
  summarizeMockPayments,
  type AdminPaymentRecord,
  type AdminPaymentStatus,
} from '../lib/admin/mockAdminData'

const PAGE_SIZE = 5

const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'pending', label: 'بانتظار الدفع' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'failed', label: 'فشل' },
  { value: 'refunded', label: 'مسترد' },
  { value: 'cancelled', label: 'ملغي' },
]

export default function AdminPaymentsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PageResult<AdminPaymentRecord> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const summary = useMemo(() => summarizeMockPayments(getMockAdminPayments()), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await adminDashboardService.listPayments({
        query,
        status,
        page,
        pageSize: PAGE_SIZE,
      })
      setResult(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المدفوعات التجريبية')
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

  const cards = [
    { label: 'إجمالي (تجريبي)', value: summary.totalPayments.toLocaleString('en-US') },
    { label: 'مدفوع', value: summary.paidCount.toLocaleString('en-US') },
    { label: 'بانتظار', value: summary.pendingCount.toLocaleString('en-US') },
    { label: 'فشل', value: summary.failedCount.toLocaleString('en-US') },
    { label: 'مسترد', value: summary.refundedCount.toLocaleString('en-US') },
    { label: 'إيرادات تجريبية', value: formatAdminMoney(summary.totalRevenue, 'SAR') },
  ]

  return (
    <AdminShell
      title="المدفوعات (قراءة فقط)"
      subtitle="بيانات تجريبية — المزوّد mock فقط"
      onRefresh={() => void load()}
      refreshing={loading}
    >
      <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800">
        هذه الصفحة للقراءة فقط وتعرض بيانات mock. لا يتم استدعاء Moyasar أو Stripe، ولا يوجد منطق دفع إنتاجي هنا.
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="text-lg font-bold text-slate-900">{card.value}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">{card.label}</div>
          </div>
        ))}
      </div>

      <AdminListToolbar
        searchId="admin-payments-search"
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="ابحث برقم الطلب أو البريد..."
        statusValue={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
      />

      {loading && (
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center shadow-sm">
          <p className="text-sm text-slate-400">جاري تحميل المدفوعات التجريبية...</p>
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
          <p className="text-sm text-slate-500">لا توجد مدفوعات تجريبية مطابقة</p>
        </div>
      )}

      {!loading && result && result.items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">رقم الطلب</th>
                  <th className="px-4 py-3 font-medium">المستخدم</th>
                  <th className="px-4 py-3 font-medium">المبلغ</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">المزوّد</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{payment.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{payment.userEmail}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatAdminMoney(payment.amount, payment.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge
                        status={payment.status}
                        label={ADMIN_PAYMENT_STATUS_LABELS[payment.status as AdminPaymentStatus]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {payment.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatAdminDate(payment.createdAt)}</td>
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
