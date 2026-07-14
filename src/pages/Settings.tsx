import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { preferenceRepository } from '../lib/repositories/preferenceRepository'

type Currency = 'SAR' | 'USD'

export default function Settings() {
  const navigate = useNavigate()
  const [currency, setCurrency] = useState<Currency>('SAR')
  const [language] = useState('ar')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const prefs = await preferenceRepository.getForUser()
        if (!cancelled && prefs) {
          if (prefs.preferred_currency === 'USD' || prefs.preferred_currency === 'SAR') {
            setCurrency(prefs.preferred_currency)
          }
        }
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await preferenceRepository.upsert({
        preferred_currency: currency,
        preferred_language: language,
      })
      setMessage('تم حفظ التفضيلات')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'تعذر حفظ التفضيلات')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
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
            <div>
              <h1 className="text-base font-bold text-slate-900">الإعدادات</h1>
              <p className="text-[10px] text-slate-400">تفضيلات الحساب</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {loading ? (
          <p className="text-sm text-slate-400">جاري التحميل...</p>
        ) : (
          <div className="max-w-md space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">العملة</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
              >
                <option value="SAR">ريال سعودي (SAR)</option>
                <option value="USD">دولار أمريكي (USD)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">اللغة</label>
              <select
                value={language}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600"
              >
                <option value="ar">العربية</option>
              </select>
            </div>

            {message && (
              <p className="text-sm text-slate-600">{message}</p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-300"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
