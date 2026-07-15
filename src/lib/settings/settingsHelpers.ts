import type { PreferenceRow } from '../types'
import type { UpdatePreferencesInput } from '../repositories/preferenceRepository'

export type SettingsCurrency = 'SAR' | 'USD' | 'EUR' | 'GBP' | 'AED'
export type SettingsLanguage = 'ar' | 'en'
export type SettingsTheme = 'light' | 'dark' | 'system'

export const SETTINGS_CURRENCIES: SettingsCurrency[] = ['SAR', 'USD', 'EUR', 'GBP', 'AED']
export const SETTINGS_LANGUAGES: SettingsLanguage[] = ['ar', 'en']
export const SETTINGS_THEMES: SettingsTheme[] = ['light', 'dark', 'system']

export interface SettingsFormState {
  fullName: string
  email: string
  preferredCurrency: SettingsCurrency
  preferredLanguage: SettingsLanguage
  theme: SettingsTheme
  notificationEnabled: boolean
  notifyEmail: boolean
  notifyTripUpdates: boolean
  notifyMarketing: boolean
  privacyAnalytics: boolean
  privacyPersonalization: boolean
  privacyShareActivity: boolean
}

export interface SettingsValidationError {
  field: string
  message: string
}

export function isSettingsCurrency(value: string): value is SettingsCurrency {
  return (SETTINGS_CURRENCIES as string[]).includes(value)
}

export function isSettingsLanguage(value: string): value is SettingsLanguage {
  return (SETTINGS_LANGUAGES as string[]).includes(value)
}

export function isSettingsTheme(value: string): value is SettingsTheme {
  return (SETTINGS_THEMES as string[]).includes(value)
}

export function normalizeCurrency(value: string | null | undefined): SettingsCurrency {
  if (value && isSettingsCurrency(value)) return value
  return 'SAR'
}

export function normalizeLanguage(value: string | null | undefined): SettingsLanguage {
  if (value && isSettingsLanguage(value)) return value
  return 'ar'
}

export function normalizeTheme(value: string | null | undefined): SettingsTheme {
  if (value && isSettingsTheme(value)) return value
  return 'light'
}

export function defaultSettingsForm(email = '', fullName = ''): SettingsFormState {
  return {
    fullName,
    email,
    preferredCurrency: 'SAR',
    preferredLanguage: 'ar',
    theme: 'light',
    notificationEnabled: true,
    notifyEmail: true,
    notifyTripUpdates: true,
    notifyMarketing: false,
    privacyAnalytics: true,
    privacyPersonalization: true,
    privacyShareActivity: false,
  }
}

export function preferencesToFormState(
  prefs: PreferenceRow | null | undefined,
  email: string,
  fullName: string,
): SettingsFormState {
  const base = defaultSettingsForm(email, fullName)
  if (!prefs) return base
  return {
    ...base,
    preferredCurrency: normalizeCurrency(prefs.preferred_currency),
    preferredLanguage: normalizeLanguage(prefs.preferred_language),
    theme: normalizeTheme(prefs.theme),
    notificationEnabled: prefs.notification_enabled !== false,
    notifyEmail: prefs.notify_email !== false,
    notifyTripUpdates: prefs.notify_trip_updates !== false,
    notifyMarketing: prefs.notify_marketing === true,
    privacyAnalytics: prefs.privacy_analytics !== false,
    privacyPersonalization: prefs.privacy_personalization !== false,
    privacyShareActivity: prefs.privacy_share_activity === true,
  }
}

export function formStateToPreferencesInput(form: SettingsFormState): UpdatePreferencesInput {
  return {
    preferred_currency: form.preferredCurrency,
    preferred_language: form.preferredLanguage,
    theme: form.theme,
    notification_enabled: form.notificationEnabled,
    notify_email: form.notifyEmail,
    notify_trip_updates: form.notifyTripUpdates,
    notify_marketing: form.notifyMarketing,
    privacy_analytics: form.privacyAnalytics,
    privacy_personalization: form.privacyPersonalization,
    privacy_share_activity: form.privacyShareActivity,
  }
}

export function validateFullName(fullName: string): string | null {
  const trimmed = fullName.trim()
  if (!trimmed) return 'الاسم مطلوب'
  if (trimmed.length < 2) return 'الاسم يجب أن يكون حرفين على الأقل'
  if (trimmed.length > 80) return 'الاسم طويل جداً'
  return null
}

export function validateChangePasswordForm(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): SettingsValidationError[] {
  const errors: SettingsValidationError[] = []
  if (!currentPassword) {
    errors.push({ field: 'currentPassword', message: 'كلمة المرور الحالية مطلوبة' })
  }
  if (!newPassword) {
    errors.push({ field: 'password', message: 'كلمة المرور الجديدة مطلوبة' })
  } else if (newPassword.length < 6) {
    errors.push({ field: 'password', message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' })
  }
  if (newPassword && currentPassword && newPassword === currentPassword) {
    errors.push({ field: 'password', message: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' })
  }
  if (newPassword !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'كلمتا المرور غير متطابقتين' })
  }
  return errors
}

export function applyLanguageDirection(language: SettingsLanguage, root: HTMLElement = document.documentElement): void {
  root.lang = language
  root.dir = language === 'ar' ? 'rtl' : 'ltr'
}

export function currencyLabel(currency: SettingsCurrency): string {
  const labels: Record<SettingsCurrency, string> = {
    SAR: 'ريال سعودي (SAR)',
    USD: 'دولار أمريكي (USD)',
    EUR: 'يورو (EUR)',
    GBP: 'جنيه إسترليني (GBP)',
    AED: 'درهم إماراتي (AED)',
  }
  return labels[currency]
}

export function languageLabel(language: SettingsLanguage): string {
  return language === 'ar' ? 'العربية' : 'English'
}

export function themeLabel(theme: SettingsTheme): string {
  if (theme === 'dark') return 'داكن'
  if (theme === 'system') return 'حسب النظام'
  return 'فاتح'
}
