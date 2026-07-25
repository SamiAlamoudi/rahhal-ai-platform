import { useState } from 'react'
import { productCopy, type ProductLocale } from '../../../lib/productUx'
import { SurfacePanel } from '../SurfacePanel'

export interface TravelPreferences {
  language: 'ar' | 'en'
  homeAirport: string
  seatPreference: string
  cabinPreference: string
  hotelPreference: string
  budgetStyle: string
  dietary: string
  accessibility: string
  travelerNotes: string
}

const DEFAULTS: TravelPreferences = {
  language: 'ar',
  homeAirport: 'RUH',
  seatPreference: '',
  cabinPreference: '',
  hotelPreference: '',
  budgetStyle: 'balanced',
  dietary: '',
  accessibility: '',
  travelerNotes: '',
}

export interface TravelPreferencesPanelProps {
  locale?: ProductLocale
  initial?: Partial<TravelPreferences>
  onSave?: (prefs: TravelPreferences) => void
}

/**
 * Lightweight traveler preferences — no feature flags or technical settings.
 */
export function TravelPreferencesPanel({
  locale = 'ar',
  initial,
  onSave,
}: TravelPreferencesPanelProps) {
  const [prefs, setPrefs] = useState<TravelPreferences>({ ...DEFAULTS, ...initial })
  const [saved, setSaved] = useState(false)

  const field = (key: keyof TravelPreferences, label: string, placeholder?: string) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor={`pref-${key}`}>
        {label}
      </label>
      <input
        id={`pref-${key}`}
        value={String(prefs[key] ?? '')}
        onChange={(e) => {
          setSaved(false)
          setPrefs((p) => ({ ...p, [key]: e.target.value }))
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
      />
    </div>
  )

  return (
    <SurfacePanel className="p-5" elevated={false}>
      <div data-testid="travel-preferences-panel">
        <h2 className="text-base font-bold text-slate-900">{productCopy(locale, 'profileTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{productCopy(locale, 'profileSubtitle')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="pref-language">
              {locale === 'ar' ? 'اللغة المفضّلة' : 'Preferred language'}
            </label>
            <select
              id="pref-language"
              value={prefs.language}
              onChange={(e) => {
                setSaved(false)
                setPrefs((p) => ({ ...p, language: e.target.value as 'ar' | 'en' }))
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
          {field('homeAirport', locale === 'ar' ? 'مطار المغادرة' : 'Home airport', 'RUH')}
          {field('seatPreference', locale === 'ar' ? 'مقعد مفضّل' : 'Seat preference', locale === 'ar' ? 'ممر / نافذة' : 'Aisle / window')}
          {field('cabinPreference', locale === 'ar' ? 'درجة السفر' : 'Cabin preference')}
          {field('hotelPreference', locale === 'ar' ? 'تفضيل الفندق' : 'Hotel preference')}
          {field('budgetStyle', locale === 'ar' ? 'أسلوب الميزانية' : 'Budget style', 'balanced')}
          {field('dietary', locale === 'ar' ? 'تغذية' : 'Dietary')}
          {field('accessibility', locale === 'ar' ? 'إمكانية الوصول' : 'Accessibility')}
        </div>
        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="pref-notes">
            {locale === 'ar' ? 'مسافرون محفوظون / ملاحظات' : 'Saved travelers / notes'}
          </label>
          <textarea
            id="pref-notes"
            value={prefs.travelerNotes}
            onChange={(e) => {
              setSaved(false)
              setPrefs((p) => ({ ...p, travelerNotes: e.target.value }))
            }}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white hover:bg-primary-700"
          onClick={() => {
            onSave?.(prefs)
            setSaved(true)
          }}
        >
          {locale === 'ar' ? 'حفظ التفضيلات' : 'Save preferences'}
        </button>
        {saved ? (
          <p className="mt-2 text-xs text-emerald-700" role="status">
            {locale === 'ar' ? 'تم الحفظ محلياً لهذه الجلسة.' : 'Saved locally for this session.'}
          </p>
        ) : null}
      </div>
    </SurfacePanel>
  )
}
