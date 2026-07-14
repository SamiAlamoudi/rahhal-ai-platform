import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authService, validateSignInForm, mapAuthErrorMessage, type AuthError } from '../lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<AuthError[]>([])
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  const fieldError = (field: string) => errors.find(e => e.field === field)?.message

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 via-white to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white shadow-lg shadow-primary-600/30">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
              <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">رحّال</h1>
          <p className="mt-1 text-sm text-slate-500">سجّل الدخول لمتابعة تخطيط رحلاتك</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          {generalError && (
            <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{generalError}</div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
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
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {fieldError('password') && <p className="mt-1 text-xs text-rose-500">{fieldError('password')}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>

          <div className="flex items-center justify-between pt-2">
            <Link to="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700">
              نسيت كلمة المرور؟
            </Link>
            <Link to="/signup" className="text-xs text-slate-500 hover:text-slate-700">
              إنشاء حساب جديد
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
