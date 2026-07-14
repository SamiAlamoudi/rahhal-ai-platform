import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { listAllOrders } from '../lib/payment/orderManager'
import { getMockAdminStats, SYSTEM_HEALTH_LABELS } from '../lib/admin/adminStats'
import type { RahhalOrder } from '../lib/payment/checkoutTypes'

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  created: 'تم الإنشاء',
  pending_payment: 'بانتظار الدفع',
  paid: 'مدفوع',
  confirmed: 'مؤكد',
  failed: 'فشل',
  cancelled: 'ملغي',
  refunded: 'مسترد',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  created: 'bg-sky-100 text-sky-700',
  pending_payment: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-400',
  refunded: 'bg-indigo-100 text-indigo-700',
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString('en-US')} ${currency}`
}

export default function CheckoutAdminDashboard() {
  const { user } = useAuth()
  const baseStats = useMemo(() => getMockAdminStats(), [])
  const orders = useMemo(() => listAllOrders(), [])

  const stats = useMemo(() => {
    const paidOrders = orders.filter(o => o.status === 'paid' || o.status === 'confirmed')
    const pendingPayments = orders.filter(o => o.status === 'pending_payment')
    const failedPayments = orders.filter(o => o.status === 'failed')
    const refundedOrders = orders.filter(o => o.status === 'refunded')
    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.cart.total, 0)

    return {
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      pendingPayments: pendingPayments.length,
      failedPayments: failedPayments.length,
      refundedOrders: refundedOrders.length,
      totalRevenue,
    }
  }, [orders])

  const statCards = [
    { label: 'إجمالي الطلبات', value: stats.totalOrders, icon: '📦' },
    { label: 'مدفوع', value: stats.paidOrders, icon: '✅' },
    { label: 'بانتظار الدفع', value: stats.pendingPayments, icon: '⏳' },
    { label: 'فشل الدفع', value: stats.failedPayments, icon: '❌' },
    { label: 'مسترد', value: stats.refundedOrders, icon: '↩️' },
    { label: 'الإيرادات', value: formatPrice(stats.totalRevenue, 'SAR'), icon: '💰' },
  ]

  const healthColors: Record<string, string> = {
    operational: 'bg-success-100 text-success-700',
    degraded: 'bg-amber-100 text-amber-700',
    down: 'bg-rose-100 text-rose-700',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">لوحة الدفع</h1>
              <p className="text-[11px] text-slate-400">رحّال — الطلبات والمدفوعات</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{user?.email}</span>
            <Link to="/" className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
              الرئيسية
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <h2 className="mb-6 text-xl font-bold text-slate-900">نظرة عامة على الطلبات</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-2 text-2xl">{card.icon}</div>
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Orders table */}
        <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-900">أحدث الطلبات</h3>
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">لا توجد طلبات بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-right text-xs text-slate-500">
                    <th className="pb-2 pr-2 font-medium">رقم الطلب</th>
                    <th className="pb-2 px-2 font-medium">الحالة</th>
                    <th className="pb-2 px-2 font-medium">المبلغ</th>
                    <th className="pb-2 px-2 font-medium">المزود</th>
                    <th className="pb-2 pl-2 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 20).map((order: RahhalOrder) => (
                    <tr key={order.id} className="border-b border-slate-50">
                      <td className="py-2.5 pr-2 font-mono text-xs text-slate-700">{order.orderNumber}</td>
                      <td className="py-2.5 px-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-500'}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-700">{formatPrice(order.cart.total, order.cart.currency)}</td>
                      <td className="py-2.5 px-2 text-xs text-slate-500">{order.paymentProvider ?? '—'}</td>
                      <td className="py-2.5 pl-2 text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString('ar-SA')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* System health */}
        <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-900">حالة النظام</h3>
          <div className="space-y-3">
            {Object.entries(baseStats.systemHealth).map(([service, status]) => (
              <div key={service} className="flex items-center justify-between">
                <span className="text-sm capitalize text-slate-700">
                  {service === 'database' ? 'قاعدة البيانات' : service === 'auth' ? 'المصادقة' : 'التخزين'}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${healthColors[status]}`}>
                  {SYSTEM_HEALTH_LABELS[status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
