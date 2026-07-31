import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, useAuth } from '../lib/auth'
import { settingsService } from '../lib/settings/settingsService'
import { ProductPageShell, TravelPreferencesPanel } from '../components/productUx'
import { VoiceExperienceSettingsPanel } from '../components/settings/VoiceExperienceSettingsPanel'
import { isUiNewExperienceEnabled, productCopy } from '../lib/productUx'
import {
  SETTINGS_CURRENCIES,
  SETTINGS_LANGUAGES,
  SETTINGS_THEMES,
  applyLanguageDirection,
  currencyLabel,
  defaultSettingsForm,
  languageLabel,
  themeLabel,
  validateChangePasswordForm,
  validateFullName,
  type SettingsCurrency,
  type SettingsFormState,
  type SettingsLanguage,
  type SettingsTheme,
} from '../lib/settings/settingsHelpers'

export default function Settings() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm] = useState<SettingsFormState>(() =>
    defaultSettingsForm(user?.email ?? '', typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''),
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null)
  const [prefsError, setPrefsError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({})

  const [signingOut, setSigningOut] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await settingsService.loadForCurrentUser()
      setForm(result.form)
      applyLanguageDirection(result.form.preferredLanguage)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'تعذر تحميل الإعدادات')
      setForm(defaultSettingsForm(user?.email ?? ''))
    } finally {
      setLoading(false)
    }
  }, [user?.email])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const updateForm = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setProfileMessage(null)
    setProfileError(null)
    const nameError = validateFullName(form.fullName)
    if (nameError) {
      setProfileError(nameError)
      return
    }
    setProfileSaving(true)
    const result = await settingsService.saveProfile(form.fullName)
    setProfileSaving(false)
    if (!result.success) {
      setProfileError(result.error ?? 'تعذر حفظ الملف الشخصي')
      return
    }
    setProfileMessage('تم حفظ الملف الشخصي')
  }

  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault()
    setPrefsMessage(null)
    setPrefsError(null)
    setPrefsSaving(true)
    const result = await settingsService.savePreferences(form)
    setPrefsSaving(false)
    if (!result.success) {
      setPrefsError(result.error ?? 'تعذر حفظ التفضيلات')
      return
    }
    applyLanguageDirection(form.preferredLanguage)
    setPrefsMessage('تم حفظ التفضيلات')
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)
    setPasswordError(null)
    const errors = validateChangePasswordForm(currentPassword, newPassword, confirmPassword)
    if (errors.length > 0) {
      const map: Record<string, string> = {}
      for (const err of errors) map[err.field] = err.message
      setPasswordFieldErrors(map)
      return
    }
    setPasswordFieldErrors({})
    setPasswordSaving(true)
    const result = await authService.changePassword(currentPassword, newPassword)
    setPasswordSaving(false)
    if (!result.success) {
      setPasswordError(result.error ?? 'تعذر تغيير كلمة المرور')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage('تم تغيير كلمة المرور بنجاح')
  }

  const handleSignOut = async () => {
    setAccountError(null)
    setSigningOut(true)
    try {
      await authService.signOut()
      navigate('/login')
    } catch (e) {
      setAccountError(e instanceof Error ? e.message : 'تعذر تسجيل الخروج')
      setSigningOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    setAccountError(null)
    if (deleteConfirm.trim() !== 'حذف') {
      setAccountError('اكتب كلمة "حذف" للتأكيد')
      return
    }
    setDeleting(true)
    const result = await authService.deleteAccount()
    if (!result.success) {
      setAccountError(result.error ?? 'تعذر حذف الحساب')
      setDeleting(false)
      return
    }
    navigate('/login')
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20'
  const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'
  const sectionClass = 'rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6'
  const toggleRowClass = 'flex items-start justify-between gap-4 py-3 border-b border-slate-50 last:border-0'
  const newExperienceOn = isUiNewExperienceEnabled()

  const settingsBody = (
      <>
        {loading && (
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-8 text-center shadow-sm">
            <p className="text-sm text-slate-400">جاري تحميل الإعدادات...</p>
          </div>
        )}

        {loadError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void loadSettings()}
              className="mt-2 text-xs font-medium text-amber-900 underline"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {!loading && (
          <>
            {newExperienceOn ? (
              <TravelPreferencesPanel
                locale="ar"
                initial={{
                  language: form.preferredLanguage === 'en' ? 'en' : 'ar',
                }}
              />
            ) : null}
            <section className={sectionClass}>
              <h2 className="text-sm font-bold text-slate-900">الملف الشخصي</h2>
              <p className="mt-1 text-xs text-slate-400">حدّث اسمك الظاهر في الحساب</p>
              <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
                <div>
                  <label className={labelClass} htmlFor="settings-full-name">الاسم الكامل</label>
                  <input
                    id="settings-full-name"
                    type="text"
                    value={form.fullName}
                    onChange={(e) => updateForm('fullName', e.target.value)}
                    className={inputClass}
                    autoComplete="name"
                    placeholder="مثال: أحمد العتيبي"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="settings-email">البريد الإلكتروني</label>
                  <input
                    id="settings-email"
                    type="email"
                    value={form.email}
                    readOnly
                    className={`${inputClass} bg-slate-50 text-slate-600`}
                  />
                </div>
                {profileError && <p className="text-sm text-rose-600">{profileError}</p>}
                {profileMessage && <p className="text-sm text-emerald-700">{profileMessage}</p>}
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-300 sm:w-auto"
                >
                  {profileSaving ? 'جاري الحفظ...' : 'حفظ الملف الشخصي'}
                </button>
              </form>
            </section>

            <section className={sectionClass}>
              <h2 className="text-sm font-bold text-slate-900">تغيير كلمة المرور</h2>
              <p className="mt-1 text-xs text-slate-400">أدخل كلمة المرور الحالية ثم الجديدة</p>
              <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                <div>
                  <label className={labelClass} htmlFor="settings-current-password">كلمة المرور الحالية</label>
                  <input
                    id="settings-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="current-password"
                  />
                  {passwordFieldErrors.currentPassword && (
                    <p className="mt-1 text-xs text-rose-600">{passwordFieldErrors.currentPassword}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="settings-new-password">كلمة المرور الجديدة</label>
                    <input
                      id="settings-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                      autoComplete="new-password"
                    />
                    {passwordFieldErrors.password && (
                      <p className="mt-1 text-xs text-rose-600">{passwordFieldErrors.password}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="settings-confirm-password">تأكيد كلمة المرور</label>
                    <input
                      id="settings-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                      autoComplete="new-password"
                    />
                    {passwordFieldErrors.confirmPassword && (
                      <p className="mt-1 text-xs text-rose-600">{passwordFieldErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>
                {passwordError && <p className="text-sm text-rose-600">{passwordError}</p>}
                {passwordMessage && <p className="text-sm text-emerald-700">{passwordMessage}</p>}
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-300 sm:w-auto"
                >
                  {passwordSaving ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                </button>
              </form>
            </section>

            <VoiceExperienceSettingsPanel />

            <section className={sectionClass}>
              <h2 className="text-sm font-bold text-slate-900">اللغة والعملة والمظهر</h2>
              <p className="mt-1 text-xs text-slate-400">تفضيلات العرض والتخطيط</p>
              <form onSubmit={handleSavePreferences} className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelClass} htmlFor="settings-language">اللغة</label>
                    <select
                      id="settings-language"
                      value={form.preferredLanguage}
                      onChange={(e) => updateForm('preferredLanguage', e.target.value as SettingsLanguage)}
                      className={inputClass}
                    >
                      {SETTINGS_LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>{languageLabel(lang)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="settings-currency">العملة</label>
                    <select
                      id="settings-currency"
                      value={form.preferredCurrency}
                      onChange={(e) => updateForm('preferredCurrency', e.target.value as SettingsCurrency)}
                      className={inputClass}
                    >
                      {SETTINGS_CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>{currencyLabel(currency)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="settings-theme">المظهر</label>
                    <select
                      id="settings-theme"
                      value={form.theme}
                      onChange={(e) => updateForm('theme', e.target.value as SettingsTheme)}
                      className={inputClass}
                    >
                      {SETTINGS_THEMES.map((theme) => (
                        <option key={theme} value={theme}>{themeLabel(theme)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-slate-800">تفضيلات الإشعارات</h3>
                  <div className="mt-1">
                    <div className={toggleRowClass}>
                      <div>
                        <p className="text-sm font-medium text-slate-800">تفعيل الإشعارات</p>
                        <p className="text-xs text-slate-400">التحكم الرئيسي بظهور الإشعارات داخل التطبيق</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.notificationEnabled}
                        onChange={(e) => updateForm('notificationEnabled', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600"
                        aria-label="تفعيل الإشعارات"
                      />
                    </div>
                    <div className={toggleRowClass}>
                      <div>
                        <p className="text-sm font-medium text-slate-800">إشعارات البريد</p>
                        <p className="text-xs text-slate-400">رسائل حول الحساب والأنشطة المهمة</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.notifyEmail}
                        disabled={!form.notificationEnabled}
                        onChange={(e) => updateForm('notifyEmail', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 disabled:opacity-40"
                        aria-label="إشعارات البريد"
                      />
                    </div>
                    <div className={toggleRowClass}>
                      <div>
                        <p className="text-sm font-medium text-slate-800">تحديثات الرحلات</p>
                        <p className="text-xs text-slate-400">تنبيهات حول الخطط والرحلات المحفوظة</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.notifyTripUpdates}
                        disabled={!form.notificationEnabled}
                        onChange={(e) => updateForm('notifyTripUpdates', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 disabled:opacity-40"
                        aria-label="تحديثات الرحلات"
                      />
                    </div>
                    <div className={toggleRowClass}>
                      <div>
                        <p className="text-sm font-medium text-slate-800">العروض التسويقية</p>
                        <p className="text-xs text-slate-400">نصائح وعروض اختيارية غير ضرورية</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.notifyMarketing}
                        disabled={!form.notificationEnabled}
                        onChange={(e) => updateForm('notifyMarketing', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 disabled:opacity-40"
                        aria-label="العروض التسويقية"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-semibold text-slate-800">إعدادات الخصوصية</h3>
                  <div className="mt-1">
                    <div className={toggleRowClass}>
                      <div>
                        <p className="text-sm font-medium text-slate-800">تحليلات الاستخدام</p>
                        <p className="text-xs text-slate-400">المساعدة على تحسين تجربة رحّال</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.privacyAnalytics}
                        onChange={(e) => updateForm('privacyAnalytics', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600"
                        aria-label="تحليلات الاستخدام"
                      />
                    </div>
                    <div className={toggleRowClass}>
                      <div>
                        <p className="text-sm font-medium text-slate-800">التخصيص</p>
                        <p className="text-xs text-slate-400">اقتراحات مبنية على تفضيلاتك السابقة</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.privacyPersonalization}
                        onChange={(e) => updateForm('privacyPersonalization', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600"
                        aria-label="التخصيص"
                      />
                    </div>
                    <div className={toggleRowClass}>
                      <div>
                        <p className="text-sm font-medium text-slate-800">مشاركة النشاط</p>
                        <p className="text-xs text-slate-400">السماح بمشاركة نشاط البحث بشكل مجهول لتحسين النتائج</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.privacyShareActivity}
                        onChange={(e) => updateForm('privacyShareActivity', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600"
                        aria-label="مشاركة النشاط"
                      />
                    </div>
                  </div>
                </div>

                {prefsError && <p className="text-sm text-rose-600">{prefsError}</p>}
                {prefsMessage && <p className="text-sm text-emerald-700">{prefsMessage}</p>}
                <button
                  type="submit"
                  disabled={prefsSaving}
                  className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-300 sm:w-auto"
                >
                  {prefsSaving ? 'جاري الحفظ...' : 'حفظ التفضيلات'}
                </button>
              </form>
            </section>

            <section className={`${sectionClass} border-rose-100`}>
              <h2 className="text-sm font-bold text-slate-900">إدارة الحساب</h2>
              <p className="mt-1 text-xs text-slate-400">تسجيل الخروج أو حذف الحساب نهائياً</p>

              <div className="mt-4 space-y-4">
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut || deleting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                >
                  {signingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
                </button>

                <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                  <p className="text-sm font-semibold text-rose-800">حذف الحساب</p>
                  <p className="mt-1 text-xs leading-relaxed text-rose-700">
                    سيؤدي هذا إلى حذف حسابك وبياناتك المرتبطة به. اكتب كلمة «حذف» للتأكيد.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="اكتب: حذف"
                    className={`${inputClass} mt-3 border-rose-200 bg-white`}
                    aria-label="تأكيد حذف الحساب"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDeleteAccount()}
                    disabled={deleting || signingOut}
                    className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:bg-slate-300 sm:w-auto"
                  >
                    {deleting ? 'جاري الحذف...' : 'حذف الحساب نهائياً'}
                  </button>
                </div>

                {accountError && <p className="text-sm text-rose-600">{accountError}</p>}
              </div>
            </section>
          </>
        )}
      </>
  )

  if (newExperienceOn) {
    return (
      <ProductPageShell
        locale="ar"
        title={productCopy('ar', 'settingsTitle')}
        subtitle={productCopy('ar', 'settingsSubtitle')}
        onBack={() => navigate('/')}
        trailing={
          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={loading}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            تحديث
          </button>
        }
        mainClassName="space-y-4 sm:space-y-5"
      >
        {settingsBody}
      </ProductPageShell>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/50 via-white to-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="رجوع"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900">الإعدادات</h1>
              <p className="text-[10px] text-slate-400">الملف الشخصي والتفضيلات والخصوصية</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadSettings()}
            disabled={loading}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            تحديث
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:space-y-5 sm:px-6">
        {settingsBody}
      </main>
    </div>
  )
}
