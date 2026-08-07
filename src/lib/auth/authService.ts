import { supabase } from '../supabaseClient'
import { auditLogRepository } from '../repositories/auditLogRepository'
import { preferenceRepository } from '../repositories/preferenceRepository'
import { mapAuthErrorMessage } from './authValidation'
import {
  clearDemoSession,
  isDemoAuthEnabled,
  writeDemoSession,
} from './demoAuth'

function emitDemoAuthChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('rahhal:demo-auth'))
  }
}

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

export interface UpdateProfileInput {
  fullName: string
}

export interface AuthActionResult {
  success: boolean
  error: string | null
}

export const authService = {
  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      return { success: false, error: mapAuthErrorMessage(error), needsVerification: false }
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
      return { success: false, error: mapAuthErrorMessage(error) }
    }
    clearDemoSession()
    try {
      await auditLogRepository.create({ action: 'sign_in', entity_type: 'auth' })
    } catch { }
    return { success: true, error: null }
  },

  /** Local demo session — only when VITE_DEMO_AUTH=true. */
  async signInDemo(email = 'demo@rahhal.local'): Promise<SignInResult> {
    if (!isDemoAuthEnabled()) {
      return { success: false, error: 'Demo auth is disabled' }
    }
    writeDemoSession(email)
    emitDemoAuthChanged()
    return { success: true, error: null }
  },

  async signOut(): Promise<void> {
    try {
      await auditLogRepository.create({ action: 'sign_out', entity_type: 'auth' })
    } catch { }
    clearDemoSession()
    emitDemoAuthChanged()
    try {
      await supabase.auth.signOut()
    } catch { }
  },

  async resetPassword(email: string): Promise<ForgotPasswordResult> {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      return { success: false, error: mapAuthErrorMessage(error) }
    }
    return { success: true, error: null }
  },

  async resendVerification(email: string): Promise<{ success: boolean; error: string | null }> {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) {
      return { success: false, error: mapAuthErrorMessage(error) }
    }
    return { success: true, error: null }
  },

  async updateProfile(input: UpdateProfileInput): Promise<AuthActionResult> {
    const { error } = await supabase.auth.updateUser({
      data: { full_name: input.fullName },
    })
    if (error) {
      return { success: false, error: mapAuthErrorMessage(error) }
    }
    try {
      await auditLogRepository.create({ action: 'update_profile', entity_type: 'auth' })
    } catch { }
    return { success: true, error: null }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthActionResult> {
    const user = await this.getCurrentUser()
    const email = user?.email
    if (!email) {
      return { success: false, error: 'تعذر التحقق من هوية المستخدم' }
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (reauthError) {
      return { success: false, error: mapAuthErrorMessage(reauthError) }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      return { success: false, error: mapAuthErrorMessage(error) }
    }
    try {
      await auditLogRepository.create({ action: 'change_password', entity_type: 'auth' })
    } catch { }
    return { success: true, error: null }
  },

  async deleteAccount(): Promise<AuthActionResult> {
    try {
      await auditLogRepository.create({ action: 'delete_account', entity_type: 'auth' })
    } catch { }

    const { error } = await supabase.rpc('delete_own_account')
    if (error) {
      return { success: false, error: mapAuthErrorMessage(error) }
    }

    try {
      await supabase.auth.signOut()
    } catch { }

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
