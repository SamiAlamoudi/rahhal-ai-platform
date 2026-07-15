import { describe, it, expect } from 'vitest'
import {
  applyLanguageDirection,
  currencyLabel,
  defaultSettingsForm,
  formStateToPreferencesInput,
  languageLabel,
  normalizeCurrency,
  normalizeLanguage,
  normalizeTheme,
  preferencesToFormState,
  themeLabel,
  validateChangePasswordForm,
  validateFullName,
} from '../settings/settingsHelpers'
import type { PreferenceRow } from '../types'

function samplePrefs(overrides: Partial<PreferenceRow> = {}): PreferenceRow {
  return {
    id: 'pref-1',
    user_id: 'user-1',
    preferred_currency: 'USD',
    preferred_language: 'en',
    theme: 'dark',
    notification_enabled: true,
    notify_email: false,
    notify_trip_updates: true,
    notify_marketing: true,
    privacy_analytics: false,
    privacy_personalization: true,
    privacy_share_activity: true,
    created_at: '2026-07-15T00:00:00.000Z',
    updated_at: '2026-07-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('settingsHelpers: normalize', () => {
  it('normalizes currency/language/theme with safe defaults', () => {
    expect(normalizeCurrency('EUR')).toBe('EUR')
    expect(normalizeCurrency('BTC')).toBe('SAR')
    expect(normalizeLanguage('en')).toBe('en')
    expect(normalizeLanguage('fr')).toBe('ar')
    expect(normalizeTheme('system')).toBe('system')
    expect(normalizeTheme('neon')).toBe('light')
  })

  it('maps labels for UI selects', () => {
    expect(currencyLabel('AED')).toContain('AED')
    expect(languageLabel('ar')).toBe('العربية')
    expect(languageLabel('en')).toBe('English')
    expect(themeLabel('dark')).toBe('داكن')
  })
})

describe('settingsHelpers: form mapping', () => {
  it('defaults form when preferences missing', () => {
    const form = preferencesToFormState(null, 'a@b.com', 'Sami')
    expect(form.email).toBe('a@b.com')
    expect(form.fullName).toBe('Sami')
    expect(form.preferredCurrency).toBe('SAR')
    expect(form.notifyMarketing).toBe(false)
    expect(form.privacyShareActivity).toBe(false)
  })

  it('maps preference row into form state', () => {
    const form = preferencesToFormState(samplePrefs(), 'u@test.com', 'User')
    expect(form.preferredCurrency).toBe('USD')
    expect(form.preferredLanguage).toBe('en')
    expect(form.theme).toBe('dark')
    expect(form.notifyEmail).toBe(false)
    expect(form.notifyMarketing).toBe(true)
    expect(form.privacyAnalytics).toBe(false)
    expect(form.privacyShareActivity).toBe(true)
  })

  it('converts form state back to repository input', () => {
    const form = defaultSettingsForm('x@y.com', 'Name')
    form.preferredCurrency = 'GBP'
    form.notifyMarketing = true
    form.privacyShareActivity = true
    const input = formStateToPreferencesInput(form)
    expect(input.preferred_currency).toBe('GBP')
    expect(input.notify_marketing).toBe(true)
    expect(input.privacy_share_activity).toBe(true)
    expect(input.notification_enabled).toBe(true)
  })
})

describe('settingsHelpers: validation', () => {
  it('validateFullName enforces length rules', () => {
    expect(validateFullName('')).not.toBeNull()
    expect(validateFullName('أ')).not.toBeNull()
    expect(validateFullName('أحمد')).toBeNull()
    expect(validateFullName('x'.repeat(81))).not.toBeNull()
  })

  it('validateChangePasswordForm covers mismatch and reuse', () => {
    expect(validateChangePasswordForm('', 'secret1', 'secret1').some((e) => e.field === 'currentPassword')).toBe(true)
    expect(validateChangePasswordForm('oldpass', '123', '123').some((e) => e.field === 'password')).toBe(true)
    expect(validateChangePasswordForm('same12', 'same12', 'same12').some((e) => e.field === 'password')).toBe(true)
    expect(validateChangePasswordForm('oldpass', 'newpass', 'other').some((e) => e.field === 'confirmPassword')).toBe(true)
    expect(validateChangePasswordForm('oldpass', 'newpass', 'newpass')).toHaveLength(0)
  })
})

describe('settingsHelpers: language direction', () => {
  it('applies rtl/ltr on a document root mock', () => {
    const root = { lang: '', dir: '' } as HTMLElement
    applyLanguageDirection('ar', root)
    expect(root.lang).toBe('ar')
    expect(root.dir).toBe('rtl')
    applyLanguageDirection('en', root)
    expect(root.lang).toBe('en')
    expect(root.dir).toBe('ltr')
  })
})
