import { useCallback, useEffect, useState } from 'react'
import AdminShell from '../components/admin/AdminShell'
import ProviderStatusCard from '../components/admin/ProviderStatusCard'
import { adminDashboardService, type AdminOverviewStats } from '../lib/admin/adminDashboardService'
import { SYSTEM_HEALTH_LABELS } from '../lib/admin/adminStats'
import { formatAdminMoney } from '../lib/admin/adminListHelpers'

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await adminDashboardService.loadOverview()
      setStats(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل نظرة عامة')
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const healthColors: Record<string, string> = {
    operational: 'bg-emerald-100 text-emerald-700',
    degraded: 'bg-amber-100 text-amber-700',
    down: 'bg-rose-100 text-rose-700',
  }

  const cards = stats
    ? [
        { label: 'المستخدمون', value: stats.userCount.toLocaleString('en-US') },
        { label: 'عمليات البحث', value: stats.searchCount.toLocaleString('en-US') },
        { label: 'الجلسات', value: stats.sessionCount.toLocaleString('en-US') },
        { label: 'رحلات محفوظة', value: stats.totalSavedTrips.toLocaleString('en-US') },
        { label: 'الحجوزات', value: stats.bookingCount.toLocaleString('en-US') },
        { label: 'مدفوعات (تجريبي)', value: stats.paymentCount.toLocaleString('en-US') },
        { label: 'نشط اليوم', value: stats.activeUsersToday.toLocaleString('en-US') },
        { label: 'إيرادات تجريبية', value: formatAdminMoney(stats.revenueSar, 'SAR') },
      ]
    : []

  return (
    <AdminShell
      title="لوحة التحكم"
      subtitle="رحّال — إدارة النظام والصلاحيات"
      onRefresh={() => void load()}
      refreshing={loading}
    >
      {loading && (
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center shadow-sm">
          <p className="text-sm text-slate-400">جاري تحميل النظرة العامة...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-xs font-medium text-amber-900 underline"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {!loading && stats && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">نظرة عامة</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
              مصدر البيانات: {stats.dataSource === 'mock' ? 'تجريبي' : 'قاعدة البيانات + تجريبي'}
            </span>
          </div>

          <ProviderStatusCard />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="text-xl font-bold text-slate-900 sm:text-2xl">{card.value}</div>
                <div className="mt-1 text-xs text-slate-500">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-sm font-bold text-slate-900">الوجهات الأكثر شعبية</h3>
              {stats.popularDestinations.length === 0 ? (
                <p className="text-sm text-slate-400">لا توجد وجهات بعد</p>
              ) : (
                <div className="space-y-3">
                  {stats.popularDestinations.map((dest, i) => (
                    <div key={dest.destination} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{dest.destination}</span>
                      <div className="hidden items-center gap-2 sm:flex">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 sm:w-24">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{
                              width: `${(dest.count / (stats.popularDestinations[0]?.count || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-slate-500">{dest.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-4 text-sm font-bold text-slate-900">حالة النظام</h3>
              <div className="space-y-3">
                {Object.entries(stats.systemHealth).map(([service, status]) => (
                  <div key={service} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">
                      {service === 'database'
                        ? 'قاعدة البيانات'
                        : service === 'auth'
                          ? 'المصادقة'
                          : 'التخزين'}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${healthColors[status]}`}>
                      {SYSTEM_HEALTH_LABELS[status]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
                المدفوعات المعروضة في لوحة الإدارة بيانات تجريبية للقراءة فقط، ومزوّد الدفع يظل mock.
              </p>
            </section>
          </div>
        </div>
      )}

      {!loading && !stats && !error && (
        <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm text-slate-500">لا تتوفر بيانات للنظرة العامة</p>
        </div>
      )}
    </AdminShell>
  )
}
