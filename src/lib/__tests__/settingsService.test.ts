import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { settingsService } from '../settings/settingsService'
import { preferenceRepository } from '../repositories/preferenceRepository'
import { auditLogRepository } from '../repositories/auditLogRepository'
import { authService } from '../auth/authService'
import type { PreferenceRow } from '../types'

function samplePrefs(overrides: Partial<PreferenceRow> = {}): PreferenceRow {
  return {
    id: 'pref-1',
    user_id: 'user-1',
    preferred_currency: 'SAR',
    preferred_language: 'ar',
    theme: 'light',
    notification_enabled: true,
    notify_email: true,
    notify_trip_updates: true,
    notify_marketing: false,
    privacy_analytics: true,
    privacy_personalization: true,
    privacy_share_activity: false,
    created_at: '2026-07-15T00:00:00.000Z',
    updated_at: '2026-07-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('settingsService integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loadForCurrentUser merges auth profile and preferences', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue({
      id: 'user-1',
      email: 'sami@example.com',
      user_metadata: { full_name: 'Sami Alamoudi' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-07-01T00:00:00.000Z',
    } as Awaited<ReturnType<typeof authService.getCurrentUser>>)

    vi.spyOn(preferenceRepository, 'getForUser').mockResolvedValue(
      samplePrefs({ preferred_currency: 'AED', preferred_language: 'en' }),
    )

    const result = await settingsService.loadForCurrentUser()
    expect(result.form.email).toBe('sami@example.com')
    expect(result.form.fullName).toBe('Sami Alamoudi')
    expect(result.form.preferredCurrency).toBe('AED')
    expect(result.form.preferredLanguage).toBe('en')
    expect(result.preferences?.id).toBe('pref-1')
  })

  it('savePreferences upserts and audits', async () => {
    const upserted = samplePrefs({ preferred_currency: 'EUR' })
    const upsertSpy = vi.spyOn(preferenceRepository, 'upsert').mockResolvedValue(upserted)
    const auditSpy = vi.spyOn(auditLogRepository, 'create').mockResolvedValue(null)

    const form = (await import('../settings/settingsHelpers')).defaultSettingsForm('a@b.com', 'Name')
    form.preferredCurrency = 'EUR'
    form.notifyMarketing = true

    const result = await settingsService.savePreferences(form)
    expect(result.success).toBe(true)
    expect(result.preferences?.preferred_currency).toBe('EUR')
    expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({
      preferred_currency: 'EUR',
      notify_marketing: true,
    }))
    expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update_preferences',
    }))
  })

  it('savePreferences returns error on repository failure', async () => {
    vi.spyOn(preferenceRepository, 'upsert').mockRejectedValue(new Error('db down'))
    const form = (await import('../settings/settingsHelpers')).defaultSettingsForm()
    const result = await settingsService.savePreferences(form)
    expect(result.success).toBe(false)
    expect(result.error).toContain('db down')
  })

  it('saveProfile validates then delegates to authService', async () => {
    const updateSpy = vi.spyOn(authService, 'updateProfile').mockResolvedValue({
      success: true,
      error: null,
    })

    const invalid = await settingsService.saveProfile(' ')
    expect(invalid.success).toBe(false)
    expect(updateSpy).not.toHaveBeenCalled()

    const valid = await settingsService.saveProfile('أحمد')
    expect(valid.success).toBe(true)
    expect(updateSpy).toHaveBeenCalledWith({ fullName: 'أحمد' })
  })
})
