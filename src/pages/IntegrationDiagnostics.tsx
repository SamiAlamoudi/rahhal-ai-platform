import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProviderHealthService, type ProviderHealth } from '../integrations/health'
import { getCatalogStatus } from '../integrations/catalogStatus'
import { BookingDiagnosticsSection } from '../components/BookingDiagnosticsSection'

const DOMAIN_LABELS: Record<string, string> = {
  flight: 'طيران',
  hotel: 'فنادق',
  activity: 'أنشطة',
  transfer: 'مواصلات',
  'rental-car': 'تأجير سيارات',
  weather: 'طقس',
  visa: 'تأشيرات',
  currency: 'عملات',
}

const DOMAIN_ICONS: Record<string, string> = {
  flight: '✈️',
  hotel: '🏨',
  activity: '🎯',
  transfer: '🚗',
  'rental-car': '🚙',
  weather: '☀️',
  visa: '🛂',
  currency: '💱',
}

const OAUTH_LABELS: Record<string, string> = {
  none: '—',
  valid: 'ساري',
  expired: 'منتهي',
  'not-configured': 'غير مُهيأ',
}

const OAUTH_COLORS: Record<string, string> = {
  none: 'text-slate-400',
  valid: 'text-emerald-600',
  expired: 'text-rose-500',
  'not-configured': 'text-amber-500',
}

function HealthBadge({ connected, healthy }: { connected: boolean; healthy: boolean }) {
  const isUp = connected && healthy
  const isDegraded = connected && !healthy
  const config = isUp
    ? { label: 'سليم', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
    : isDegraded
      ? { label: 'متدهور', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
      : { label: 'غير متصل', color: 'bg-rose-100 text-rose-600 border-rose-200', dot: 'bg-rose-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${config.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${enabled ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-400'}`}>
      {enabled ? 'مفعّل' : 'معطّل'}
    </span>
  )
}

function ModeBadge({ mode }: { mode: 'mock' | 'real' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${mode === 'real' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
      {mode === 'real' ? 'حقيقي' : 'وهمي'}
    </span>
  )
}

export default function IntegrationDiagnostics() {
  const navigate = useNavigate()
  const healthService = useMemo(() => getProviderHealthService(), [])
  const healths = useMemo(() => healthService.checkAll(), [healthService])
  const catalog = useMemo(() => getCatalogStatus(), [])
  const hasFlight = healths.some(h => h.domain === 'flight')
  const hasHotel = healths.some(h => h.domain === 'hotel')
  const hasRentalCar = healths.some(h => h.domain === 'rental-car')
  const showCountColumns = hasHotel || hasRentalCar

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
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
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700 text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">تشخيص التكاملات</h1>
                <p className="text-[10px] text-slate-400">حالة مزوّدي الخدمة — للقراءة فقط</p>
              </div>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            {healths.length} مزوّد
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-900">حالة الكتالوج</h2>
          <div className="flex flex-wrap gap-2">
            {catalog.map((entry) => (
              <span
                key={entry.domain}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  entry.status === 'live'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {entry.domain}: {entry.status === 'live' ? 'مباشر' : 'قريباً'}
              </span>
            ))}
          </div>
        </section>

        {healths.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <span className="text-3xl">📋</span>
            <p className="mt-2 text-sm text-slate-500">لا توجد مزوّدين مفعّلين</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">المزوّد</th>
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">المجال</th>
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">الحالة</th>
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">مفعّل</th>
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">المحوّل</th>
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">الوضع</th>
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">API متاح</th>
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">زمن الاستجابة</th>
                  {hasFlight && <th scope="col" className="p-3 text-xs font-bold text-slate-600">OAuth</th>}
                  {hasFlight && <th scope="col" className="p-3 text-xs font-bold text-slate-600">عمر التوكن</th>}
                  {showCountColumns && <th scope="col" className="p-3 text-xs font-bold text-slate-600">عدد النتائج</th>}
                  {showCountColumns && <th scope="col" className="p-3 text-xs font-bold text-slate-600">آخر طلب</th>}
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">الصحة</th>
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">آخر فحص</th>
                  <th scope="col" className="p-3 text-xs font-bold text-slate-600">آخر خطأ</th>
                </tr>
              </thead>
              <tbody>
                {healths.map((h: ProviderHealth) => (
                  <tr key={h.providerId} className="border-b border-slate-50 transition-colors hover:bg-slate-50/30">
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-base" aria-hidden>{DOMAIN_ICONS[h.domain] ?? '📋'}</span>
                        <span className="font-bold text-slate-800">{h.providerName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400" dir="ltr">{h.providerId}</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {DOMAIN_LABELS[h.domain] ?? h.domain}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${h.connected ? 'text-emerald-600' : 'text-rose-500'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${h.connected ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                        {h.connected ? 'متصل' : 'غير متصل'}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap"><EnabledBadge enabled={h.enabled} /></td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-mono font-medium text-slate-600" dir="ltr">
                        {h.adapter}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap"><ModeBadge mode={h.mode} /></td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${h.apiReachable ? 'text-emerald-600' : 'text-rose-500'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${h.apiReachable ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                        {h.apiReachable ? 'نعم' : 'لا'}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap text-[10px] text-slate-500" dir="ltr">
                      {h.lastResponseTime !== null ? `${h.lastResponseTime}ms` : '—'}
                    </td>
                    {hasFlight && (
                      <td className="p-3 whitespace-nowrap">
                        <span className={`text-xs font-bold ${OAUTH_COLORS[h.oauthStatus] ?? 'text-slate-400'}`}>
                          {OAUTH_LABELS[h.oauthStatus] ?? h.oauthStatus}
                        </span>
                      </td>
                    )}
                    {hasFlight && (
                      <td className="p-3 whitespace-nowrap text-[10px] text-slate-500" dir="ltr">
                        {h.tokenRemainingLifetime !== null ? `${Math.round(h.tokenRemainingLifetime / 1000)}s` : '—'}
                      </td>
                    )}
                    {showCountColumns && (
                      <td className="p-3 whitespace-nowrap text-[10px] text-slate-500" dir="ltr">
                        {h.lastResponseCount !== null ? h.lastResponseCount : '—'}
                      </td>
                    )}
                    {showCountColumns && (
                      <td className="p-3 whitespace-nowrap text-[10px] text-slate-400" dir="ltr">
                        {h.lastRequestAt ? new Date(h.lastRequestAt).toLocaleTimeString('ar-SA') : '—'}
                      </td>
                    )}
                    <td className="p-3 whitespace-nowrap"><HealthBadge connected={h.connected} healthy={h.healthy} /></td>
                    <td className="p-3 whitespace-nowrap text-[10px] text-slate-400" dir="ltr">
                      {new Date(h.lastCheck).toLocaleTimeString('ar-SA')}
                    </td>
                    <td className="p-3 whitespace-nowrap text-[10px] text-rose-400 max-w-[200px] truncate" dir="ltr" title={h.lastError ?? ''}>
                      {h.lastError ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <BookingDiagnosticsSection />

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/40 p-4">
          <p className="text-xs text-slate-500">
            هذه الصفحة للقراءة فقط. حالة المزوّدين تُقرأ من إعدادات البيئة ولا يمكن تعديلها من هنا.
          </p>
        </div>
      </main>
    </div>
  )
}
