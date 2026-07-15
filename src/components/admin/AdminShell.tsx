import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const NAV_ITEMS: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/admin', label: 'نظرة عامة', end: true },
  { to: '/admin/users', label: 'المستخدمون' },
  { to: '/admin/trips', label: 'الرحلات' },
  { to: '/admin/bookings', label: 'الحجوزات' },
  { to: '/admin/payments', label: 'المدفوعات' },
]

interface AdminShellProps {
  title: string
  subtitle: string
  children: ReactNode
  onRefresh?: () => void
  refreshing?: boolean
}

export default function AdminShell({
  title,
  subtitle,
  children,
  onRefresh,
  refreshing = false,
}: AdminShellProps) {
  const { user } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm shadow-primary-600/30">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{title}</h1>
              <p className="truncate text-[10px] text-slate-400 sm:text-[11px]">{subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-[10rem] truncate text-xs text-slate-500 sm:inline">
              {user?.email}
            </span>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                تحديث
              </button>
            )}
            <Link
              to="/"
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
            >
              الرئيسية
            </Link>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 pb-3 sm:px-6">
          <div className="flex min-w-max gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.end
                ? location.pathname === item.to
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
