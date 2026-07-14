import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authService, validateEmail, mapAuthErrorMessage } from '../lib/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    setLoading(true)
    const result = await authService.resetPassword(email)
    setLoading(false)
    if (!result.success) {
      setError(mapAuthErrorMessage(result.error))
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 via-white to-white px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-success-200 bg-success-50 p-8">
            <h2 className="text-lg font-bold text-success-800">تحقق من بريدك</h2>
            <p className="mt-2 text-sm text-success-700">
              أرسلنا رابط إعادة تعيين كلمة المرور إلى {email}.
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
          <h1 className="text-xl font-bold text-slate-900">نسيت كلمة المرور</h1>
          <p className="mt-1 text-sm text-slate-500">أدخل بريدك وسنرسل رابط إعادة التعيين</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          {error && <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال رابط التعيين'}
          </button>

          <p className="pt-2 text-center text-xs text-slate-500">
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
              العودة لتسجيل الدخول
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
