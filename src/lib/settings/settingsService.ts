import { preferenceRepository } from '../repositories/preferenceRepository'
import { auditLogRepository } from '../repositories/auditLogRepository'
import { authService } from '../auth/authService'
import type { PreferenceRow } from '../types'
import {
  formStateToPreferencesInput,
  preferencesToFormState,
  type SettingsFormState,
  validateFullName,
} from './settingsHelpers'

export interface LoadSettingsResult {
  form: SettingsFormState
  preferences: PreferenceRow | null
}

export interface SaveSettingsResult {
  success: boolean
  error: string | null
  preferences: PreferenceRow | null
}

export const settingsService = {
  async loadForCurrentUser(): Promise<LoadSettingsResult> {
    const user = await authService.getCurrentUser()
    const email = user?.email ?? ''
    const fullName =
      typeof user?.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : typeof user?.user_metadata?.name === 'string'
          ? user.user_metadata.name
          : ''

    const preferences = await preferenceRepository.getForUser()
    return {
      preferences,
      form: preferencesToFormState(preferences, email, fullName),
    }
  },

  async savePreferences(form: SettingsFormState): Promise<SaveSettingsResult> {
    try {
      const preferences = await preferenceRepository.upsert(formStateToPreferencesInput(form))
      try {
        await auditLogRepository.create({
          action: 'update_preferences',
          entity_type: 'preferences',
        })
      } catch {
        // non-blocking
      }
      return { success: true, error: null, preferences }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'تعذر حفظ التفضيلات',
        preferences: null,
      }
    }
  },

  async saveProfile(fullName: string): Promise<{ success: boolean; error: string | null }> {
    const nameError = validateFullName(fullName)
    if (nameError) return { success: false, error: nameError }
    return authService.updateProfile({ fullName: fullName.trim() })
  },
}
