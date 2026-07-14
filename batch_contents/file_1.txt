import { supabase } from '../supabaseClient'
import { auditLogRepository } from '../repositories/auditLogRepository'
import { preferenceRepository } from '../repositories/preferenceRepository'

export interface SignUpResult {
  success: boolean
  error: string | null
  needsVerification: boolean
}

export interface SignInResult {
  success: boolean
  error: string | null
}

export interface ForgotPasswordResult {
  success: boolean
  error: string | null
}

export const authService = {
  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      return { success: false, error: error.message, needsVerification: false }
    }
    if (data.user && !data.session) {
      return { success: true, error: null, needsVerification: true }
    }
    if (data.user && data.session) {
      try {
        await preferenceRepository.upsert({ preferred_currency: 'SAR', preferred_language: 'ar' })
        await auditLogRepository.create({ action: 'sign_up', entity_type: 'auth' })
      } catch { }
    }
    return { success: true, error: null, needsVerification: false }
  },

  async signIn(email: string, password: string): Promise<SignInResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return { success: false, error: error.message }
    }
    try {
      await auditLogRepository.create({ action: 'sign_in', entity_type: 'auth' })
    } catch { }
    return { success: true, error: null }
  },

  async signOut(): Promise<void> {
    try {
      await auditLogRepository.create({ action: 'sign_out', entity_type: 'auth' })
    } catch { }
    await supabase.auth.signOut()
  },

  async resetPassword(email: string): Promise<ForgotPasswordResult> {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, error: null }
  },

  async resendVerification(email: string): Promise<{ success: boolean; error: string | null }> {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) {
      return { success: false, error: error.message }
    }
    return { success: true, error: null }
  },

  async getSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  async getCurrentUser() {
    const { data } = await supabase.auth.getUser()
    return data.user
  },
}
