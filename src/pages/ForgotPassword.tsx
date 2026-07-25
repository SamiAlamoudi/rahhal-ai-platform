import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { authService, validateEmail, mapAuthErrorMessage } from '../lib/auth'
import { productCopy } from '../lib/productUx'
import { AuthExperience, Atmosphere, SurfacePanel } from '../components/productUx'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const locale = 'ar' as const

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
      <Atmosphere variant="auth" className="min-h-screen">
        <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
          <SurfacePanel className="w-full p-8 text-center">
            <h2 className="text-lg font-bold text-slate-900">تحقق من بريدك</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              أرسلنا رابط إعادة تعيين كلمة المرور إلى {email}.
            </p>
            <Link
              to="/login"
              className="mt-5 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              العودة لتسجيل الدخول
            </Link>
          </SurfacePanel>
        </div>
      </Atmosphere>
    )
  }

  return (
    <AuthExperience
      locale={locale}
      title={productCopy(locale, 'authForgotTitle')}
      subtitle={productCopy(locale, 'authForgotSubtitle')}
      footer={
        <p className="text-center text-xs text-slate-500">
          تذكرت كلمة المرور؟{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            سجّل الدخول
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="forgot-password-form">
        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
        >
          {loading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
        </button>
      </form>
    </AuthExperience>
  )
}
