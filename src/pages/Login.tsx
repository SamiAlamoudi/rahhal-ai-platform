import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authService, validateSignInForm, mapAuthErrorMessage, type AuthError } from '../lib/auth'
import { isDemoAuthEnabled } from '../lib/auth/demoAuth'
import { productCopy } from '../lib/productUx'
import { AuthExperience } from '../components/productUx'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<AuthError[]>([])
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const demoEnabled = isDemoAuthEnabled()
  const locale = 'ar' as const

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    const formErrors = validateSignInForm(email, password)
    if (formErrors.length > 0) {
      setErrors(formErrors)
      return
    }
    setErrors([])
    setLoading(true)
    const result = await authService.signIn(email, password)
    setLoading(false)
    if (!result.success) {
      setGeneralError(mapAuthErrorMessage(result.error))
      return
    }
    navigate('/')
  }

  const handleDemoSignIn = async () => {
    setGeneralError(null)
    setErrors([])
    setLoading(true)
    const result = await authService.signInDemo()
    setLoading(false)
    if (!result.success) {
      setGeneralError(result.error ?? 'تعذّر الدخول التجريبي')
      return
    }
    navigate('/')
  }

  const fieldError = (field: string) => errors.find((e) => e.field === field)?.message

  return (
    <AuthExperience
      locale={locale}
      title={productCopy(locale, 'authLoginTitle')}
      subtitle={productCopy(locale, 'authLoginSubtitle')}
      footer={
        <div className="flex items-center justify-between gap-3 text-xs">
          <Link to="/forgot-password" className="font-medium text-primary-600 hover:text-primary-700">
            نسيت كلمة المرور؟
          </Link>
          <Link to="/signup" className="text-slate-500 hover:text-slate-700">
            إنشاء حساب جديد
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
        {generalError && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{generalError}</div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            placeholder="example@email.com"
            autoComplete="email"
          />
          {fieldError('email') && <p className="mt-1 text-xs text-rose-500">{fieldError('email')}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {fieldError('password') && (
            <p className="mt-1 text-xs text-rose-500">{fieldError('password')}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
        >
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>

        {demoEnabled && (
          <button
            type="button"
            disabled={loading}
            onClick={handleDemoSignIn}
            data-testid="login-demo"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
          >
            متابعة كمستخدم تجريبي (محلي)
          </button>
        )}
      </form>
    </AuthExperience>
  )
}
