import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/', label: 'الرئيسية' },
  { to: '/chat', label: 'المحادثة' },
  { to: '/concierge', label: 'كونسيرج' },
  { to: '/voice', label: 'الصوت' },
  { to: '/search', label: 'بحث' },
  { to: '/recommendations', label: 'توصيات' },
  { to: '/planning', label: 'التخطيط' },
  { to: '/timeline', label: 'الجدول' },
  { to: '/continue-trip', label: 'متابعة' },
  { to: '/my-trips', label: 'رحلاتي' },
  { to: '/settings', label: 'الإعدادات' },
] as const

/**
 * Production chrome for Brain-powered screens (Premium tokens via data-rahhal-ds).
 */
export function ProductAppChrome({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  return (
    <div
      data-rahhal-ds
      data-theme="light"
      dir="rtl"
      className="rh-atmosphere"
      style={{ minHeight: '100vh', background: 'var(--ds-bg)', color: 'var(--ds-ink)' }}
    >
      <header
        className="rh-glass-signature"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          borderBottom: '1px solid var(--ds-border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'start',
            }}
          >
            <div style={{ fontFamily: 'var(--ds-font-display)', fontWeight: 800, fontSize: 20 }}>
              رحّال
            </div>
            <div style={{ fontSize: 11, color: 'var(--ds-ink-tertiary)' }}>
              {title ?? 'TravelBrain'}
            </div>
          </button>
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {NAV.map((item) => {
              const active = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                    color: active ? 'var(--ds-ink-inverse)' : 'var(--ds-ink-secondary)',
                    background: active ? 'var(--ds-primary)' : 'transparent',
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
            {isAdmin ? (
              <Link
                to="/admin"
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: 'var(--ds-primary)',
                }}
              >
                الإدارة
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: 920, margin: '0 auto', padding: '16px 16px 48px' }}>{children}</main>
    </div>
  )
}
