import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getMockAdminStats, SYSTEM_HEALTH_LABELS } from '../lib/admin/adminStats'

export default function AdminDashboard() {
  const { user } = useAuth()
  const stats = useMemo(() => getMockAdminStats(), [])

  const healthColors: Record<string, string> = {
    operational: 'bg-success-100 text-success-700',
    degraded: 'bg-amber-100 text-amber-700',
    down: 'bg-rose-100 text-rose-700',
  }

  const statCards = [
    { label: 'المستخدمون', value: stats.userCount, icon: '👥' },
    { label: 'عمليات البحث', value: stats.searchCount, icon: '🔍' },
    { label: 'الجلسات', value: stats.sessionCount, icon: '📋' },
    { label: 'رحلات محفوظة', value: stats.totalSavedTrips, icon: '⭐' },
    { label: 'وجهات مفضلة', value: stats.totalFavorites, icon: '❤️' },
    { label: 'نشط اليوم', value: stats.activeUsersToday, icon: '⚡' },
  ]

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
              <h1 className="text-lg font-bold text-slate-900">لوحة التحكم</h1>
              <p className="text-[11px] text-slate-400">رحّال — إحصائيات النظام</p>
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
        <h2 className="mb-6 text-xl font-bold text-slate-900">نظرة عامة</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-2 text-2xl">{card.icon}</div>
              <div className="text-2xl font-bold text-slate-900">{card.value.toLocaleString()}</div>
              <div className="mt-0.5 text-xs text-slate-500">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-900">الوجهات الأكثر شعبية</h3>
            <div className="space-y-3">
              {stats.popularDestinations.map((dest, i) => (
                <div key={dest.destination} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-slate-700">{dest.destination}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${(dest.count / stats.popularDestinations[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500">{dest.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-900">حالة النظام</h3>
            <div className="space-y-3">
              {Object.entries(stats.systemHealth).map(([service, status]) => (
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
        </div>
      </main>
    </div>
  )
}
