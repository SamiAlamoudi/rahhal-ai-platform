import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authService, validateSignUpForm, mapAuthErrorMessage, type AuthError } from '../lib/auth'

export default function SignUp() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<AuthError[]>([])
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    const formErrors = validateSignUpForm(email, password, confirmPassword)
    if (formErrors.length > 0) {
      setErrors(formErrors)
      return
    }
    setErrors([])
    setLoading(true)
    const result = await authService.signUp(email, password)
    setLoading(false)
    if (!result.success) {
      setGeneralError(mapAuthErrorMessage(result.error))
      return
    }
    if (result.needsVerification) {
      setNeedsVerification(true)
      return
    }
    navigate('/')
  }

  const fieldError = (field: string) => errors.find(e => e.field === field)?.message

  if (needsVerification) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 via-white to-white px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-success-200 bg-success-50 p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-100">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-success-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-success-800">تحقق من بريدك</h2>
            <p className="mt-2 text-sm text-success-700">
              أرسلنا رابط التحقق إلى {email}. اضغط على الرابط لتأكيد حسابك ثم سجّل الدخول.
            </p>
            <Link to="/login" className="mt-4 inline-block text-sm font-medium text-primary-600 hover:text-primary-700">
              العودة لتسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
          <p className="mt-1 text-sm text-slate-500">أنشئ حسابك وابدأ تخطيط رحلاتك</p>
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
              autoComplete="new-password"
            />
            {fieldError('password') && <p className="mt-1 text-xs text-rose-500">{fieldError('password')}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">تأكيد كلمة المرور</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
              placeholder="••••••••"
              autoComplete="new-password"
            />
            {fieldError('confirmPassword') && <p className="mt-1 text-xs text-rose-500">{fieldError('confirmPassword')}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </button>

          <p className="pt-2 text-center text-xs text-slate-500">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
              سجّل الدخول
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
