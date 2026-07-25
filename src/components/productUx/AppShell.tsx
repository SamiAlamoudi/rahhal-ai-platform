import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { productCopy, type ProductLocale } from '../../lib/productUx'
import { Atmosphere } from './Atmosphere'
import { BrandMark } from './BrandMark'

export interface AppShellProps {
  locale?: ProductLocale
  children: ReactNode
  /** Compact overlay header (home hero) vs solid sticky bar */
  transparentHeader?: boolean
  showMobileNav?: boolean
  trailing?: ReactNode
}

const NAV = [
  { to: '/', key: 'navHome' as const, match: (p: string) => p === '/' },
  { to: '/chat', key: 'navChat' as const, match: (p: string) => p.startsWith('/chat') },
  { to: '/my-trips', key: 'navTrips' as const, match: (p: string) => p.startsWith('/my-trips') },
  { to: '/settings', key: 'navSettings' as const, match: (p: string) => p.startsWith('/settings') },
]

/**
 * Minimal responsive product shell — not a dashboard.
 */
export function AppShell({
  locale = 'ar',
  children,
  transparentHeader = false,
  showMobileNav = true,
  trailing,
}: AppShellProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <Atmosphere variant={transparentHeader ? 'hero' : 'page'} className="min-h-screen">
      <div dir={dir} data-testid="product-app-shell" className="relative z-10 min-h-screen pb-20 sm:pb-6">
        <header
          className={`sticky top-0 z-40 ${
            transparentHeader
              ? 'bg-transparent'
              : 'border-b border-slate-200/60 bg-white/80 backdrop-blur-xl'
          }`}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="min-h-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              aria-label={productCopy(locale, 'navHome')}
            >
              <BrandMark
                locale={locale}
                size="sm"
                withName
                inverted={transparentHeader}
              />
            </button>
            <nav
              className="hidden items-center gap-0.5 sm:flex"
              aria-label={locale === 'ar' ? 'التنقل' : 'Navigation'}
            >
              {NAV.map((item) => {
                const active = item.match(pathname)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`min-h-10 rounded-xl px-3 py-2 text-sm font-medium transition ${
                      transparentHeader
                        ? active
                          ? 'bg-white/15 text-white'
                          : 'text-white/80 hover:bg-white/10'
                        : active
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {productCopy(locale, item.key)}
                  </Link>
                )
              })}
            </nav>
            <div className="flex items-center gap-1.5">
              <Link
                to="/notifications"
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm ${
                  transparentHeader
                    ? 'text-white/90 hover:bg-white/10'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                aria-label={locale === 'ar' ? 'الإشعارات' : 'Notifications'}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
                </svg>
              </Link>
              <Link
                to="/settings"
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm ${
                  transparentHeader
                    ? 'text-white/90 hover:bg-white/10'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                aria-label={productCopy(locale, 'navSettings')}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 19.5c1.8-3 4.2-4.5 7-4.5s5.2 1.5 7 4.5" />
                </svg>
              </Link>
              {trailing}
            </div>
          </div>
        </header>

        {children}

        {showMobileNav ? (
          <nav
            className={`fixed inset-x-0 bottom-0 z-40 border-t sm:hidden ${
              transparentHeader
                ? 'border-white/10 bg-slate-950/80 backdrop-blur-xl'
                : 'border-slate-200/80 bg-white/95 backdrop-blur-xl'
            }`}
            aria-label={locale === 'ar' ? 'التنقل السفلي' : 'Mobile navigation'}
          >
            <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1 px-2 py-2">
              {NAV.map((item) => {
                const active = item.match(pathname)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex min-h-12 flex-col items-center justify-center rounded-xl text-[11px] font-semibold ${
                      transparentHeader
                        ? active
                          ? 'bg-white/12 text-white'
                          : 'text-white/70'
                        : active
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {productCopy(locale, item.key)}
                  </Link>
                )
              })}
            </div>
          </nav>
        ) : null}
      </div>
    </Atmosphere>
  )
}
